import { useEffect, useState } from "react";
import { WHATSAPP_URL } from "../components/Layout";
import { Img } from "../components/Img";
import { OffersSignup } from "../components/OffersSignup";
import { api, money } from "../lib/api";
import type { EventItem } from "../types";

function formatEventDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

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
    <div className="mx-auto max-w-5xl px-4 py-12">
      <header className="text-center">
        <h1 className="font-display text-4xl font-bold text-espresso sm:text-5xl">
          Events & Workshops
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-charcoal/70">
          Study nights, workshops, game nights, tastings and more — come be part of the avenue.
        </p>
      </header>

      {loading ? (
        <p className="mt-12 text-center text-charcoal/60">Loading events…</p>
      ) : events.length === 0 ? (
        <div className="mt-12 rounded-2xl bg-white p-10 text-center shadow-sm">
          <p className="text-4xl">📅</p>
          <p className="mt-3 font-semibold text-espresso">No events scheduled right now.</p>
          <p className="mt-1 text-sm text-charcoal/60">
            Check back soon — or message us on WhatsApp to host your own.
          </p>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noreferrer"
            className="btn-3d mt-5 inline-block rounded-full bg-sage px-6 py-2.5 font-semibold text-cream"
          >
            💬 Message us
          </a>
        </div>
      ) : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {events.map((e) => {
            const soldOut = e.spots !== null && e.spots <= 0;
            return (
              <div key={e.id} className="card-lift overflow-hidden rounded-2xl bg-white shadow-sm">
                <Img src={e.image} alt={e.title} className="h-44 w-full" />
                <div className="p-6">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-display text-xl font-bold text-espresso">{e.title}</h2>
                    <span className="shrink-0 rounded-full bg-oat px-3 py-1 text-sm font-bold text-espresso">
                      {e.price > 0 ? money(e.price) : "Free"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-terracotta">
                    🗓 {formatEventDate(e.startTime)}
                  </p>
                  {e.description && (
                    <p className="mt-2 text-sm text-charcoal/70">{e.description}</p>
                  )}
                  {e.spots !== null && (
                    <p className="mt-2 text-xs font-semibold text-charcoal/60">
                      {soldOut ? "Fully booked" : `${e.spots} spots available`}
                    </p>
                  )}
                  <a
                    href={`${WHATSAPP_URL.split("?")[0]}?text=${encodeURIComponent(
                      `Hi Bean Avenue! I'd like to book a spot for "${e.title}".`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className={`btn-3d mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-2.5 font-semibold text-cream ${
                      soldOut ? "pointer-events-none bg-oat text-charcoal/40" : "bg-terracotta"
                    }`}
                  >
                    {soldOut ? "Fully booked" : "Book on WhatsApp"}
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-12">
        <OffersSignup />
      </div>
    </div>
  );
}
