import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { INSTAGRAM_URL, WHATSAPP_URL } from "../components/Layout";
import { HostYourEvent } from "../components/HostYourEvent";
import { Img } from "../components/Img";
import { CalendarIcon, InstagramIcon, WhatsAppIcon } from "../components/icons";
import { OffersSignup } from "../components/OffersSignup";
import { SuggestEvent } from "../components/SuggestEvent";
import { VoteForNext } from "../components/VoteForNext";
import { api, formatDate, formatTime, money } from "../lib/api";
import { canBook, eventStatus, formatDuration, STATUS_META, whatsappBookingLink } from "../lib/events";
import type { EventItem } from "../types";

export function Events() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<EventItem[]>("/api/events")
      .then(setEvents)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <header className="text-center">
        <h1 className="font-display text-4xl font-bold text-espresso sm:text-5xl">
          Events &amp; Workshops
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-charcoal/70">
          Discover upcoming workshops, gatherings, and community experiences at Bean Avenue.
        </p>
      </header>

      {loading ? (
        <p className="mt-12 text-center text-charcoal/60">Loading events…</p>
      ) : events.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      )}

      {/* Vote for What's Next — self-hides when nothing is up for vote */}
      <VoteForNext />

      {/* Host Your Event — always near the bottom of the page */}
      <div className="mt-14">
        <HostYourEvent />
      </div>

      {/* Suggest an Event */}
      <div className="mt-10">
        <SuggestEvent />
      </div>

      <div className="mt-12">
        <OffersSignup />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto mt-10 max-w-3xl rounded-3xl border border-oat bg-white px-6 py-10 text-center shadow-sm sm:px-10">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-oat text-espresso">
        <CalendarIcon className="h-9 w-9" />
      </span>
      <h2 className="mt-5 font-display text-3xl font-bold text-espresso sm:text-4xl">
        Something is brewing.
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-lg text-charcoal/75">
        We do not have any upcoming events announced yet. Follow Bean Avenue or check back soon
        to see what is coming next.
      </p>
      <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noreferrer"
          className="btn-3d inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-espresso px-7 py-3.5 text-base font-semibold text-cream sm:w-auto"
        >
          <InstagramIcon className="h-5 w-5" />
          Follow Us on Instagram
        </a>
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noreferrer"
          className="btn-3d inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-sage px-7 py-3.5 text-base font-semibold text-cream sm:w-auto"
        >
          <WhatsAppIcon className="h-5 w-5" />
          Contact Us on WhatsApp
        </a>
      </div>
    </div>
  );
}

function EventCard({ event: e }: { event: EventItem }) {
  const status = eventStatus(e);
  const meta = STATUS_META[status];
  const bookable = canBook(status);
  const duration = formatDuration(e.durationMins);

  return (
    <div className="card-lift flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm">
      <Link to={`/events/${e.id}`} className="relative block">
        <Img src={e.image} alt={e.title} className="aspect-[16/10] w-full bg-oat/30" />
        <span className={`absolute right-3 top-3 rounded-full px-3 py-1 text-xs font-bold ${meta.badge}`}>
          {meta.label}
        </span>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        {e.category && (
          <span className="text-xs font-bold uppercase tracking-wide text-terracotta">{e.category}</span>
        )}
        <Link
          to={`/events/${e.id}`}
          className="mt-1 font-display text-lg font-bold leading-tight text-espresso hover:text-terracotta"
        >
          {e.title}
        </Link>
        <p className="mt-2 text-sm font-semibold text-charcoal/80">
          🗓 {formatDate(e.startTime)}
        </p>
        <p className="text-sm text-charcoal/70">
          🕑 {formatTime(e.startTime)}
          {duration && ` · ${duration}`}
        </p>
        {e.description && (
          <p className="mt-2 line-clamp-2 flex-1 text-sm text-charcoal/70">{e.description}</p>
        )}

        <div className="mt-3 flex items-center justify-between">
          <span className="rounded-full bg-oat px-3 py-1 text-sm font-bold text-espresso">
            {e.price > 0 ? money(e.price) : "Free"}
          </span>
          {e.spots != null && (
            <span className="text-xs font-semibold text-charcoal/60">
              {e.spots <= 0 ? "Fully booked" : `${e.spots} spot${e.spots === 1 ? "" : "s"} left`}
            </span>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <Link
            to={`/events/${e.id}`}
            className="flex-1 rounded-full border border-oat px-4 py-2.5 text-center text-sm font-semibold text-espresso transition hover:bg-oat"
          >
            View Details
          </Link>
          {bookable ? (
            <a
              href={whatsappBookingLink(e.title)}
              target="_blank"
              rel="noreferrer"
              className="btn-3d flex-1 rounded-full bg-terracotta px-4 py-2.5 text-center text-sm font-semibold text-cream"
            >
              Book
            </a>
          ) : (
            <span className="flex-1 cursor-not-allowed rounded-full bg-oat px-4 py-2.5 text-center text-sm font-semibold text-charcoal/40">
              {meta.label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
