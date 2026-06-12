import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { WHATSAPP_URL } from "../components/Layout";
import { api, formatDate, formatTime, money } from "../lib/api";
import type { Booking } from "../types";

function calendarUrl(b: Booking): string {
  const fmt = (iso: string) =>
    new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Bean Avenue · ${b.room?.name ?? "Room"} (${b.number})`,
    dates: `${fmt(b.startTime)}/${fmt(b.endTime)}`,
    location: "Bean Avenue, 123 Avenue Street",
    details: "Brew. Focus. Repeat.",
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function BookingSuccess() {
  const { number } = useParams();
  const location = useLocation();
  const [booking, setBooking] = useState<Booking | null>(location.state?.booking ?? null);

  useEffect(() => {
    if (!booking && number) {
      api.get<Booking>(`/api/bookings/track/${number}`).then(setBooking).catch(() => {});
    }
  }, [number, booking]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <p className="pop-in text-6xl">🎉</p>
      <h1 className="mt-4 font-display text-3xl font-bold text-espresso">
        You're booked. The room's all yours.
      </h1>
      <p className="mt-2 text-lg font-semibold text-terracotta">{number}</p>

      {booking && (
        <div className="mt-8 rounded-2xl bg-white p-6 text-left shadow-sm">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="font-semibold text-espresso">Room</dt>
              <dd>{booking.room?.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="font-semibold text-espresso">Date</dt>
              <dd>{formatDate(booking.startTime)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="font-semibold text-espresso">Time</dt>
              <dd>
                {formatTime(booking.startTime)} – {formatTime(booking.endTime)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="font-semibold text-espresso">People</dt>
              <dd>{booking.peopleCount}</dd>
            </div>
            <div className="flex justify-between border-t border-oat pt-2 text-base font-bold text-espresso">
              <dt>Total</dt>
              <dd>{money(booking.total)}</dd>
            </div>
          </dl>
          {booking.beansEarned > 0 && (
            <p className="mt-4 rounded-xl bg-sage/15 p-3 text-sm text-sage-dark">
              🫘 You earned <strong>{booking.beansEarned} beans</strong> on this booking!
            </p>
          )}
          <p className="mt-4 text-xs text-charcoal/50">
            Need to cancel? It's free up to 2 hours before your start time — just message us.
          </p>
        </div>
      )}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {booking && (
          <a
            href={calendarUrl(booking)}
            target="_blank"
            rel="noreferrer"
            className="btn-3d rounded-full bg-espresso px-6 py-2.5 font-semibold text-cream"
          >
            📅 Add to Calendar
          </a>
        )}
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noreferrer"
          className="btn-3d rounded-full bg-sage px-6 py-2.5 font-semibold text-cream"
        >
          💬 Message us on WhatsApp
        </a>
        <Link
          to="/"
          className="rounded-full border border-espresso px-6 py-2.5 font-semibold text-espresso transition hover:bg-espresso hover:text-cream"
        >
          Back home
        </Link>
      </div>
    </div>
  );
}
