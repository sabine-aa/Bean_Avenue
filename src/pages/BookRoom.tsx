import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "../context/ToastContext";
import { api, formatHour, money } from "../lib/api";
import type { Booking, Room } from "../types";

interface BusyWindow {
  start: string;
  end: string;
}

function todayStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function BookRoom() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState<number | null>(null);
  const [date, setDate] = useState(todayStr());
  const [startHour, setStartHour] = useState<number | null>(null);
  const [duration, setDuration] = useState(1);
  const [busy, setBusy] = useState<BusyWindow[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [people, setPeople] = useState(1);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Load rooms; preselect via ?room=STUDY|CONFERENCE
  useEffect(() => {
    api.get<Room[]>("/api/rooms").then((data) => {
      setRooms(data);
      const wanted = params.get("room");
      const match = data.find((r) => r.type === wanted && r.isAvailable);
      if (match) setRoomId(match.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const room = rooms.find((r) => r.id === roomId) ?? null;

  // Live availability for the chosen room + date
  useEffect(() => {
    if (!roomId || !date) return;
    api
      .get<{ busy: BusyWindow[] }>(`/api/bookings/availability?roomId=${roomId}&date=${date}`)
      .then((res) => setBusy(res.busy))
      .catch(() => setBusy([]));
  }, [roomId, date]);

  // Valid start hours for the chosen duration: inside opening hours, not in the
  // past, and not overlapping any existing booking (buffer already included).
  const slots = useMemo(() => {
    if (!room) return [];
    const now = new Date();
    const result: { hour: number; available: boolean }[] = [];
    const [y, m, d] = date.split("-").map(Number);
    for (let h = room.openHour; h + duration <= room.closeHour; h++) {
      const start = new Date(y, m - 1, d, h);
      const end = new Date(y, m - 1, d, h + duration);
      const inPast = start.getTime() <= now.getTime();
      const conflicts = busy.some(
        (w) => start < new Date(w.end) && end > new Date(w.start)
      );
      result.push({ hour: h, available: !inPast && !conflicts });
    }
    return result;
  }, [room, date, duration, busy]);

  // Clear a selected start time that became invalid after changes
  useEffect(() => {
    if (startHour !== null && !slots.some((s) => s.hour === startHour && s.available)) {
      setStartHour(null);
    }
  }, [slots, startHour]);

  const capacityError =
    room && (people < room.capacityMin || people > room.capacityMax)
      ? `That's a crowd! ${room.name} fits ${room.capacityMin}–${room.capacityMax} — try the other room.`
      : null;

  const total = room ? room.pricePerHour * duration : 0;
  const ready = room && startHour !== null && name && phone && !capacityError;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ready || submitting || !room || startHour === null) return;
    setSubmitting(true);
    try {
      const booking = await api.post<Booking>("/api/bookings", {
        roomId: room.id,
        date,
        startHour,
        durationHours: duration,
        customerName: name,
        phone,
        peopleCount: people,
        notes: notes || undefined,
      });
      navigate(`/booking-success/${booking.number}`, { state: { booking } });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong.", "error");
      setSubmitting(false);
      // refresh availability in case someone grabbed the slot
      if (roomId) {
        api
          .get<{ busy: BusyWindow[] }>(`/api/bookings/availability?roomId=${roomId}&date=${date}`)
          .then((res) => setBusy(res.busy))
          .catch(() => {});
      }
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-display text-4xl font-bold text-espresso">Book a Room</h1>
      <p className="mt-2 text-charcoal/70">Three quick steps and the room's all yours.</p>

      <form onSubmit={handleSubmit} className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          {/* Step 1 — Choose your space */}
          <section>
            <h2 className="font-display text-xl font-bold text-espresso">1 · Choose your space</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {rooms.map((r) => (
                <label
                  key={r.id}
                  className={`cursor-pointer rounded-2xl border-2 bg-white p-5 transition ${
                    roomId === r.id
                      ? "border-terracotta shadow-md"
                      : "border-transparent shadow-sm hover:border-oat"
                  } ${!r.isAvailable ? "opacity-50" : ""}`}
                >
                  <input
                    type="radio"
                    name="room"
                    className="sr-only"
                    disabled={!r.isAvailable}
                    checked={roomId === r.id}
                    onChange={() => setRoomId(r.id)}
                  />
                  <p className="font-display text-lg font-bold text-espresso">{r.name}</p>
                  <p className="text-sm text-charcoal/60">
                    {r.capacityMin}–{r.capacityMax} people
                  </p>
                  <p className="mt-2 font-semibold text-terracotta">
                    {money(r.pricePerHour)}/hour
                  </p>
                  {!r.isAvailable && (
                    <p className="mt-1 text-xs text-terracotta-dark">Temporarily unavailable</p>
                  )}
                </label>
              ))}
            </div>
          </section>

          {/* Step 2 — Date & time */}
          <section className={room ? "" : "pointer-events-none opacity-40"}>
            <h2 className="font-display text-xl font-bold text-espresso">2 · Pick date & time</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-espresso" htmlFor="date">
                  Date
                </label>
                <input
                  id="date"
                  type="date"
                  min={todayStr()}
                  max={todayStr(60)}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-oat bg-white px-4 py-2.5"
                />
              </div>
              <div>
                <span className="block text-sm font-semibold text-espresso">Duration</span>
                <div className="mt-1 flex gap-2">
                  {[1, 2, 3].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setDuration(h)}
                      className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                        duration === h
                          ? "border-espresso bg-espresso text-cream"
                          : "border-oat bg-white hover:border-espresso"
                      }`}
                    >
                      {h} hour{h > 1 ? "s" : ""}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4">
              <span className="block text-sm font-semibold text-espresso">Start time</span>
              {slots.length > 0 ? (
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {slots.map((s) => (
                    <button
                      key={s.hour}
                      type="button"
                      disabled={!s.available}
                      onClick={() => setStartHour(s.hour)}
                      className={`rounded-lg border px-2 py-2 text-sm font-medium transition ${
                        startHour === s.hour
                          ? "border-terracotta bg-terracotta text-cream"
                          : s.available
                            ? "border-oat bg-white hover:border-terracotta"
                            : "cursor-not-allowed border-oat bg-oat/50 text-charcoal/30 line-through"
                      }`}
                    >
                      {formatHour(s.hour)}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-charcoal/60">Pick a room and date first.</p>
              )}
              {room && busy.length > 0 && (
                <p className="mt-2 text-xs text-charcoal/50">
                  Crossed-out times are already booked — everything else is yours.
                </p>
              )}
            </div>
          </section>

          {/* Step 3 — Details */}
          <section className={room && startHour !== null ? "" : "pointer-events-none opacity-40"}>
            <h2 className="font-display text-xl font-bold text-espresso">3 · Your details</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-espresso" htmlFor="bname">
                  Name
                </label>
                <input
                  id="bname"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-oat bg-white px-4 py-2.5"
                  autoComplete="name"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-espresso" htmlFor="bphone">
                  Phone
                </label>
                <input
                  id="bphone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-oat bg-white px-4 py-2.5"
                  autoComplete="tel"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-espresso" htmlFor="people">
                  Number of people
                </label>
                <input
                  id="people"
                  type="number"
                  min={1}
                  max={20}
                  value={people}
                  onChange={(e) => setPeople(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-oat bg-white px-4 py-2.5"
                  aria-invalid={Boolean(capacityError)}
                />
                {capacityError && (
                  <p className="mt-1 text-sm text-terracotta-dark">{capacityError}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-espresso" htmlFor="notes">
                  Notes <span className="font-normal text-charcoal/50">(optional)</span>
                </label>
                <input
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder='e.g. "need the TV for a presentation"'
                  className="mt-1 w-full rounded-xl border border-oat bg-white px-4 py-2.5"
                />
              </div>
            </div>
          </section>
        </div>

        {/* Live price box */}
        <aside>
          <div className="sticky top-24 rounded-2xl bg-espresso p-6 text-cream shadow-lg">
            <h2 className="font-display text-lg font-bold">Your booking</h2>
            {room ? (
              <>
                <p className="mt-3 text-sm text-oat">
                  {room.name} · {money(room.pricePerHour)}/hour × {duration} hour
                  {duration > 1 ? "s" : ""}
                </p>
                {startHour !== null && (
                  <p className="mt-1 text-sm text-oat">
                    {new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    · {formatHour(startHour)} – {formatHour(startHour + duration)}
                  </p>
                )}
                <p className="mt-4 font-display text-3xl font-bold text-cream">{money(total)}</p>
              </>
            ) : (
              <p className="mt-3 text-sm text-oat">Choose a space to see the price.</p>
            )}
            <button
              type="submit"
              disabled={!ready || submitting}
              className="btn-3d mt-6 w-full rounded-full bg-terracotta px-6 py-3 font-semibold text-cream disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Confirming…" : "Confirm Booking"}
            </button>
            <p className="mt-3 text-xs text-oat/80">
              Pay at the café. Free cancellation up to 2 hours before your start time.
            </p>
          </div>
        </aside>
      </form>
    </div>
  );
}
