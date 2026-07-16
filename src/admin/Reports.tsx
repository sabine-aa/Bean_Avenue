import { useEffect, useState } from "react";
import { getToken } from "../lib/api";
import { api, money } from "../lib/api";

interface Summary {
  range: { from: string; to: string };
  revenue: { food: number; rooms: number; total: number };
  orderCount: number;
  bookingCount: number;
  topItems: { name: string; quantity: number; revenue: number }[];
  utilization: { room: string; hoursBooked: number; hoursAvailable: number; utilization: number }[];
  byDay: number[];
  byHour: number[];
  customers: { new: number; returning: number };
  beans: { issued: number; redeemed: number };
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dateStr(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-charcoal/60 w-10 shrink-0">{label}</span>
      <div className="bg-oat/50 h-4 flex-1 overflow-hidden rounded">
        <div className="bg-terracotta/70 h-full rounded" style={{ width: max > 0 ? `${(value / max) * 100}%` : 0 }} />
      </div>
      <span className="w-8 text-right font-semibold">{value}</span>
    </div>
  );
}

export function AdminReports() {
  const [from, setFrom] = useState(dateStr(-29));
  const [to, setTo] = useState(dateStr(0));
  const [data, setData] = useState<Summary | null>(null);

  useEffect(() => {
    api
      .get<Summary>(`/api/reports/summary?from=${from}&to=${to}`)
      .then(setData)
      .catch(() => {});
  }, [from, to]);

  async function exportCsv() {
    const res = await fetch(`/api/reports/export?from=${from}&to=${to}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bean-avenue-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const maxDay = data ? Math.max(...data.byDay, 1) : 1;
  const maxHour = data ? Math.max(...data.byHour, 1) : 1;
  const revenueMax = data ? Math.max(data.revenue.food, data.revenue.rooms, 1) : 1;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-espresso text-3xl font-bold">Sales Reports</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border-oat rounded-full border bg-white px-3 py-1.5"
            aria-label="From date"
          />
          <span className="text-charcoal/50">→</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border-oat rounded-full border bg-white px-3 py-1.5"
            aria-label="To date"
          />
          <button onClick={exportCsv} className="bg-espresso text-cream hover:bg-mocha rounded-full px-4 py-1.5 font-semibold">
            Export CSV
          </button>
        </div>
      </div>

      {!data ? (
        <p className="text-charcoal/60 mt-8">Crunching the numbers…</p>
      ) : (
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          {/* Revenue split */}
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="font-display text-espresso text-lg font-bold">Revenue: Food vs Rooms</h2>
            <p className="font-display text-terracotta mt-1 text-3xl font-bold">{money(data.revenue.total)}</p>
            <div className="mt-4 space-y-3">
              {[
                ["Food", data.revenue.food, "bg-espresso"],
                ["Rooms", data.revenue.rooms, "bg-sage"],
              ].map(([label, value, color]) => (
                <div key={label as string}>
                  <div className="flex justify-between text-sm">
                    <span>
                      {label} <span className="text-charcoal/50">({label === "Food" ? data.orderCount + " orders" : data.bookingCount + " bookings"})</span>
                    </span>
                    <span className="font-semibold">{money(value as number)}</span>
                  </div>
                  <div className="bg-oat/50 mt-1 h-3 overflow-hidden rounded-full">
                    <div className={`h-full rounded-full ${color}`} style={{ width: `${((value as number) / revenueMax) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Top items */}
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="font-display text-espresso text-lg font-bold">Top-selling items</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {data.topItems.length === 0 && <li className="text-charcoal/60">No sales in range.</li>}
              {data.topItems.map((t, i) => (
                <li key={t.name} className="flex justify-between">
                  <span>
                    <span className="text-terracotta mr-2 font-bold">{i + 1}.</span>
                    {t.name} <span className="text-charcoal/50">×{t.quantity}</span>
                  </span>
                  <span className="font-semibold">{money(t.revenue)}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Utilization */}
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="font-display text-espresso text-lg font-bold">Room utilization</h2>
            <div className="mt-3 space-y-3">
              {data.utilization.map((u) => (
                <div key={u.room}>
                  <div className="flex justify-between text-sm">
                    <span>{u.room}</span>
                    <span className="font-semibold">
                      {u.hoursBooked}h / {u.hoursAvailable}h · {u.utilization}%
                    </span>
                  </div>
                  <div className="bg-oat/50 mt-1 h-3 overflow-hidden rounded-full">
                    <div className="bg-terracotta h-full rounded-full" style={{ width: `${Math.min(100, u.utilization)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Customers & beans */}
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="font-display text-espresso text-lg font-bold">Customers & beans</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 text-center">
              {[
                ["New customers", data.customers.new],
                ["Returning", data.customers.returning],
                ["Beans issued", data.beans.issued],
                ["Beans redeemed", data.beans.redeemed],
              ].map(([label, value]) => (
                <div key={label as string} className="bg-oat/50 rounded-xl p-4">
                  <p className="font-display text-espresso text-2xl font-bold">{value}</p>
                  <p className="text-charcoal/60 text-xs">{label}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Busiest days */}
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="font-display text-espresso text-lg font-bold">Busiest days</h2>
            <div className="mt-3 space-y-1.5">
              {data.byDay.map((v, i) => (
                <Bar key={i} value={v} max={maxDay} label={DAY_NAMES[i]} />
              ))}
            </div>
          </section>

          {/* Hour heatmap */}
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="font-display text-espresso text-lg font-bold">Time-of-day heatmap</h2>
            <div className="mt-3 flex h-28 items-end gap-1">
              {data.byHour.map((v, h) => (
                <div key={h} className="flex flex-1 flex-col items-center gap-1" title={`${h}:00 — ${v} sales`}>
                  <div className="bg-terracotta/70 w-full rounded-t" style={{ height: `${(v / maxHour) * 100}%`, minHeight: v > 0 ? 4 : 1 }} />
                  {h % 4 === 0 && <span className="text-charcoal/50 text-[9px]">{h}</span>}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
