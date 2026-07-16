import { FormEvent, useEffect, useState } from "react";
import { useToast } from "../context/ToastContext";
import { api, formatDate, formatTime, money } from "../lib/api";
import type { Booking, BookingStatus, Room } from "../types";

const STATUSES: BookingStatus[] = ["PENDING", "CONFIRMED", "IN_USE", "COMPLETED", "CANCELLED", "NO_SHOW"];

const STATUS_STYLE: Record<BookingStatus, string> = {
  PENDING: "bg-oat text-mocha",
  CONFIRMED: "bg-sage/25 text-sage-dark",
  IN_USE: "bg-terracotta/20 text-terracotta-dark",
  COMPLETED: "bg-oat/60 text-charcoal/60",
  CANCELLED: "bg-charcoal/10 text-charcoal/50",
  NO_SHOW: "bg-terracotta/15 text-terracotta-dark",
};

export function AdminBookings() {
  const toast = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [status, setStatus] = useState("ALL");
  const [roomId, setRoomId] = useState("");
  const [date, setDate] = useState("");
  const [search, setSearch] = useState("");
  const [rescheduling, setRescheduling] = useState<Booking | null>(null);
  const [reForm, setReForm] = useState({ date: "", startHour: 8, durationHours: 1 });

  async function load() {
    const params = new URLSearchParams();
    if (status !== "ALL") params.set("status", status);
    if (roomId) params.set("roomId", roomId);
    if (date) params.set("date", date);
    if (search) params.set("search", search);
    setBookings(await api.get<Booking[]>(`/api/bookings?${params}`));
  }

  useEffect(() => {
    api.get<Room[]>("/api/rooms").then(setRooms);
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, roomId, date, search]);

  async function setBookingStatus(b: Booking, next: BookingStatus) {
    try {
      await api.patch(`/api/bookings/${b.id}/status`, { status: next });
      toast(`${b.number} → ${next.replace("_", " ")}`);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't update.", "error");
    }
  }

  async function submitReschedule(e: FormEvent) {
    e.preventDefault();
    if (!rescheduling) return;
    try {
      await api.patch(`/api/bookings/${rescheduling.id}/reschedule`, reForm);
      toast(`${rescheduling.number} rescheduled.`);
      setRescheduling(null);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't reschedule.", "error");
    }
  }

  return (
    <div>
      <h1 className="font-display text-espresso text-3xl font-bold">Room Bookings</h1>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border-oat rounded-full border bg-white px-3 py-1.5 text-sm"
          aria-label="Filter by status"
        >
          <option value="ALL">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
        <select
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          className="border-oat rounded-full border bg-white px-3 py-1.5 text-sm"
          aria-label="Filter by room"
        >
          <option value="">All rooms</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border-oat rounded-full border bg-white px-3 py-1.5 text-sm"
          aria-label="Filter by date"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or phone…"
          className="border-oat ml-auto w-full rounded-full border bg-white px-4 py-1.5 text-sm sm:w-60"
        />
      </div>

      {rescheduling && (
        <form onSubmit={submitReschedule} className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl bg-white p-5 shadow-md">
          <p className="text-espresso w-full font-semibold">
            Reschedule {rescheduling.number} ({rescheduling.customerName}) — conflict check applies.
          </p>
          <label className="text-espresso text-sm font-semibold">
            Date
            <input
              type="date"
              required
              value={reForm.date}
              onChange={(e) => setReForm({ ...reForm, date: e.target.value })}
              className="border-oat mt-1 block rounded-xl border px-3 py-2 font-normal"
            />
          </label>
          <label className="text-espresso text-sm font-semibold">
            Start hour
            <input
              type="number"
              min={0}
              max={23}
              required
              value={reForm.startHour}
              onChange={(e) => setReForm({ ...reForm, startHour: Number(e.target.value) })}
              className="border-oat mt-1 block w-24 rounded-xl border px-3 py-2 font-normal"
            />
          </label>
          <label className="text-espresso text-sm font-semibold">
            Duration (h)
            <input
              type="number"
              min={1}
              max={12}
              required
              value={reForm.durationHours}
              onChange={(e) => setReForm({ ...reForm, durationHours: Number(e.target.value) })}
              className="border-oat mt-1 block w-24 rounded-xl border px-3 py-2 font-normal"
            />
          </label>
          <button type="submit" className="bg-espresso text-cream hover:bg-mocha rounded-full px-5 py-2 text-sm font-semibold">
            Save
          </button>
          <button
            type="button"
            onClick={() => setRescheduling(null)}
            className="text-charcoal/60 hover:text-terracotta rounded-full px-4 py-2 text-sm font-semibold"
          >
            Cancel
          </button>
        </form>
      )}

      <div className="mt-5 overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full min-w-[56rem] text-sm">
          <thead>
            <tr className="border-oat text-charcoal/50 border-b text-left text-xs tracking-wide uppercase">
              <th className="px-4 py-3">Number</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Room</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {bookings.length === 0 && (
              <tr>
                <td colSpan={9} className="text-charcoal/60 px-4 py-8 text-center">
                  No bookings match these filters.
                </td>
              </tr>
            )}
            {bookings.map((b) => (
              <tr key={b.id} className="border-oat/60 border-b">
                <td className="text-espresso px-4 py-3 font-semibold">{b.number}</td>
                <td className="px-4 py-3">{b.customerName}</td>
                <td className="px-4 py-3">
                  <a href={`tel:${b.phone}`} className="text-terracotta">
                    {b.phone}
                  </a>
                </td>
                <td className="px-4 py-3">{b.room?.name}</td>
                <td className="px-4 py-3">{formatDate(b.startTime)}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {formatTime(b.startTime)}–{formatTime(b.endTime)} ({b.durationHours}h)
                </td>
                <td className="px-4 py-3 font-semibold">{money(b.total)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLE[b.status]}`}>{b.status.replace("_", " ")}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {b.status === "PENDING" && (
                      <button
                        onClick={() => setBookingStatus(b, "CONFIRMED")}
                        className="bg-sage/25 text-sage-dark hover:bg-sage/50 rounded-full px-2.5 py-1 text-xs font-semibold"
                      >
                        Confirm
                      </button>
                    )}
                    {["PENDING", "CONFIRMED", "IN_USE"].includes(b.status) && (
                      <>
                        <button
                          onClick={() => setBookingStatus(b, "COMPLETED")}
                          className="bg-oat hover:bg-espresso hover:text-cream rounded-full px-2.5 py-1 text-xs font-semibold"
                        >
                          Complete
                        </button>
                        <button
                          onClick={() => {
                            setRescheduling(b);
                            const d = new Date(b.startTime);
                            setReForm({
                              date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
                              startHour: d.getHours(),
                              durationHours: b.durationHours,
                            });
                          }}
                          className="bg-oat hover:bg-espresso hover:text-cream rounded-full px-2.5 py-1 text-xs font-semibold"
                        >
                          Edit time
                        </button>
                        <button
                          onClick={() => setBookingStatus(b, "CANCELLED")}
                          className="text-charcoal/50 hover:text-terracotta rounded-full px-2.5 py-1 text-xs font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => setBookingStatus(b, "NO_SHOW")}
                          className="text-charcoal/50 hover:text-terracotta rounded-full px-2.5 py-1 text-xs font-semibold"
                        >
                          No-show
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
