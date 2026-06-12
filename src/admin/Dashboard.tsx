import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatTime, money } from "../lib/api";
import type { Booking, Order, Room } from "../types";

interface DashboardData {
  openOrders: Order[];
  todaysBookings: Booking[];
  ordersToday: number;
  revenueToday: number;
  newCustomersToday: number;
  rooms: Room[];
}

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: "bg-sage/30",
  IN_USE: "bg-terracotta/40",
  PENDING: "bg-oat",
  COMPLETED: "bg-oat/60",
};

export function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = () =>
      api.get<DashboardData>("/api/reports/dashboard").then(setData).catch((e) => setError(e.message));
    load();
    const interval = setInterval(load, 30_000); // live-ish feed
    return () => clearInterval(interval);
  }, []);

  if (error) return <p className="text-terracotta-dark">{error}</p>;
  if (!data) return <p className="text-charcoal/60">Loading today's picture…</p>;

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-espresso">Today at a glance</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Open orders", String(data.openOrders.length), "/admin/orders"],
          ["Bookings today", String(data.todaysBookings.length), "/admin/bookings"],
          ["Revenue today", money(data.revenueToday), "/admin/reports"],
          ["New loyalty sign-ups", String(data.newCustomersToday), "/admin/customers"],
        ].map(([label, value, to]) => (
          <Link key={label} to={to} className="card-lift rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-charcoal/60">{label}</p>
            <p className="mt-1 font-display text-3xl font-bold text-espresso">{value}</p>
          </Link>
        ))}
      </div>

      {/* Room timeline */}
      <section className="mt-8">
        <h2 className="font-display text-xl font-bold text-espresso">Rooms by hour</h2>
        <div className="mt-3 space-y-3 overflow-x-auto rounded-2xl bg-white p-5 shadow-sm">
          {data.rooms.map((room) => {
            const hours = Array.from(
              { length: room.closeHour - room.openHour },
              (_, i) => room.openHour + i
            );
            return (
              <div key={room.id} className="flex min-w-[40rem] items-center gap-3">
                <span className="w-32 shrink-0 text-sm font-semibold text-espresso">
                  {room.name}
                </span>
                <div className="flex flex-1">
                  {hours.map((h) => {
                    const booking = data.todaysBookings.find(
                      (b) =>
                        b.roomId === room.id &&
                        !["CANCELLED", "NO_SHOW"].includes(b.status) &&
                        new Date(b.startTime).getHours() <= h &&
                        new Date(b.endTime).getHours() > h
                    );
                    return (
                      <div
                        key={h}
                        title={
                          booking
                            ? `${booking.number} · ${booking.customerName} (${booking.status})`
                            : `${h}:00 free`
                        }
                        className={`h-9 flex-1 border-r border-cream text-center text-[10px] leading-9 ${
                          booking ? STATUS_COLORS[booking.status] ?? "bg-sage/30" : "bg-oat/30"
                        }`}
                      >
                        {h}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <p className="text-xs text-charcoal/50">
            Numbers are hours of the day · colored blocks are bookings (hover for details).
          </p>
        </div>
      </section>

      {/* Live feed */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-espresso">Open orders</h2>
            <Link to="/admin/orders" className="text-sm font-semibold text-terracotta">
              All orders →
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {data.openOrders.length === 0 && (
              <p className="rounded-xl bg-white p-4 text-sm text-charcoal/60 shadow-sm">
                No open orders. Enjoy the quiet ☕
              </p>
            )}
            {data.openOrders.slice(0, 6).map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
                <div>
                  <p className="font-semibold text-espresso">
                    {o.number} · {o.customerName}
                  </p>
                  <p className="text-xs text-charcoal/60">
                    {o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{money(o.total)}</p>
                  <p className="text-xs font-medium text-terracotta">{o.status}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-espresso">Today's bookings</h2>
            <Link to="/admin/bookings" className="text-sm font-semibold text-terracotta">
              All bookings →
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {data.todaysBookings.length === 0 && (
              <p className="rounded-xl bg-white p-4 text-sm text-charcoal/60 shadow-sm">
                No bookings today yet.
              </p>
            )}
            {data.todaysBookings.slice(0, 6).map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
                <div>
                  <p className="font-semibold text-espresso">
                    {b.number} · {b.customerName}
                  </p>
                  <p className="text-xs text-charcoal/60">
                    {b.room?.name} · {formatTime(b.startTime)}–{formatTime(b.endTime)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{money(b.total)}</p>
                  <p className="text-xs font-medium text-terracotta">{b.status.replace("_", " ")}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
