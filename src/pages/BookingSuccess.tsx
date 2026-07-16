import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { WHATSAPP_URL } from "../components/Layout";
import { api, formatDate, formatTime, money } from "../lib/api";
import type { Booking } from "../types";

function calendarUrl(b: Booking): string {
  const fmt = (iso: string) =>
    new Date(iso)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
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
      api
        .get<Booking>(`/api/bookings/track/${number}`)
        .then(setBooking)
        .catch(() => {});
    }
  }, [number, booking]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <p className="pop-in text-6xl">🎉</p>
      <h1 className="font-display text-espresso mt-4 text-3xl font-bold">You're booked. The room's all yours.</h1>
      <p className="text-terracotta mt-2 text-lg font-semibold">{number}</p>

      {booking && (
        <div className="mt-8 rounded-2xl bg-white p-6 text-left shadow-sm">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-espresso font-semibold">Room</dt>
              <dd>{booking.room?.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-espresso font-semibold">Date</dt>
              <dd>{formatDate(booking.startTime)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-espresso font-semibold">Time</dt>
              <dd>
                {formatTime(booking.startTime)} – {formatTime(booking.endTime)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-espresso font-semibold">People</dt>
              <dd>{booking.peopleCount}</dd>
            </div>
            <div className="border-oat text-espresso flex justify-between border-t pt-2 text-base font-bold">
              <dt>Total</dt>
              <dd>{money(booking.total)}</dd>
            </div>
          </dl>
          {booking.beansEarned > 0 && (
            <p className="bg-sage/15 text-sage-dark mt-4 rounded-xl p-3 text-sm">
              🫘 You earned <strong>{booking.beansEarned} beans</strong> on this booking!
            </p>
          )}
          <p className="text-charcoal/50 mt-4 text-xs">Need to cancel? It's free up to 2 hours before your start time — just message us.</p>
        </div>
      )}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {booking && (
          <a href={calendarUrl(booking)} target="_blank" rel="noreferrer" className="btn-3d bg-espresso text-cream rounded-full px-6 py-2.5 font-semibold">
            📅 Add to Calendar
          </a>
        )}
        <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="btn-3d bg-sage text-cream rounded-full px-6 py-2.5 font-semibold">
          💬 Message us on WhatsApp
        </a>
        <Link to="/" className="border-espresso text-espresso hover:bg-espresso hover:text-cream rounded-full border px-6 py-2.5 font-semibold transition">
          Back home
        </Link>
      </div>
    </div>
  );
}
