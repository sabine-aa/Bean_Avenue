import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ADDRESS } from "../components/Layout";
import { Img } from "../components/Img";
import { WhatsAppIcon } from "../components/icons";
import { api, formatDate, formatTime, money } from "../lib/api";
import { canBook, eventStatus, formatDuration, STATUS_META, whatsappBookingLink } from "../lib/events";
import type { EventItem } from "../types";

export function EventDetails() {
  const { id } = useParams();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setEvent(null);
    setNotFound(false);
    api
      .get<EventItem>(`/api/events/${id}`)
      .then(setEvent)
      .catch(() => setNotFound(true));
  }, [id]);

  if (notFound) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="text-charcoal/70">That event isn't available right now.</p>
        <Link to="/events" className="text-terracotta mt-4 inline-block font-semibold hover:underline">
          ← Back to events
        </Link>
      </div>
    );
  }
  if (!event) {
    return <p className="text-charcoal/60 py-20 text-center">Loading…</p>;
  }

  const status = eventStatus(event);
  const meta = STATUS_META[status];
  const bookable = canBook(status);
  const duration = formatDuration(event.durationMins);
  const location = event.location || ADDRESS;
  const included = event.included
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link to="/events" className="text-terracotta text-sm font-semibold hover:underline">
        ← Events &amp; Workshops
      </Link>

      <div className="mt-4 grid gap-8 md:grid-cols-2">
        <div className="md:sticky md:top-24 md:self-start">
          <div className="relative overflow-hidden rounded-2xl">
            <Img src={event.image} alt={event.title} className="bg-oat/30 aspect-[4/3] w-full" />
            <span className={`absolute top-3 right-3 rounded-full px-3 py-1 text-xs font-bold ${meta.badge}`}>{meta.label}</span>
          </div>
        </div>

        <div>
          {event.category && <span className="text-terracotta text-xs font-bold tracking-wide uppercase">{event.category}</span>}
          <h1 className="font-display text-espresso mt-1 text-3xl font-bold sm:text-4xl">{event.title}</h1>

          {/* Key facts */}
          <dl className="bg-oat/40 mt-5 grid grid-cols-2 gap-4 rounded-2xl p-5 text-sm">
            <Fact label="Date">{formatDate(event.startTime)}</Fact>
            <Fact label="Time">
              {formatTime(event.startTime)}
              {duration && ` · ${duration}`}
            </Fact>
            <Fact label="Location">{location}</Fact>
            <Fact label="Price">{event.price > 0 ? money(event.price) : "Free"}</Fact>
            {event.spots != null && <Fact label="Available spots">{event.spots <= 0 ? "Fully booked" : `${event.spots} left`}</Fact>}
            <Fact label="Status">{meta.label}</Fact>
          </dl>

          {event.description && (
            <div className="mt-6">
              <h2 className="font-display text-espresso text-lg font-bold">About this event</h2>
              <p className="text-charcoal/80 mt-2 whitespace-pre-line">{event.description}</p>
            </div>
          )}

          {included.length > 0 && (
            <div className="mt-6">
              <h2 className="font-display text-espresso text-lg font-bold">What's included</h2>
              <ul className="text-charcoal/80 mt-2 space-y-1.5">
                {included.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="bg-terracotta mt-2 h-1.5 w-1.5 shrink-0 rounded-full" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Booking */}
          <div className="border-oat mt-8 rounded-2xl border p-5">
            <h2 className="font-display text-espresso text-lg font-bold">How to book</h2>
            {bookable ? (
              <>
                <p className="text-charcoal/70 mt-1 text-sm">
                  To reserve your place, message us on WhatsApp using the button below. We'll confirm your spot and share any final details.
                </p>
                <a
                  href={whatsappBookingLink(event.title)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-3d bg-sage text-cream mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 font-semibold"
                >
                  <WhatsAppIcon className="h-5 w-5" />
                  Book on WhatsApp
                </a>
              </>
            ) : (
              <p className="text-charcoal/60 mt-1 text-sm font-semibold">
                {status === "SOLD_OUT"
                  ? "This event is fully booked."
                  : status === "CANCELLED"
                    ? "This event has been cancelled."
                    : "This event has already taken place."}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-charcoal/50 text-xs font-bold tracking-wide uppercase">{label}</dt>
      <dd className="text-espresso mt-0.5 font-semibold">{children}</dd>
    </div>
  );
}
