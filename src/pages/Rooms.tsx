import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Img } from "../components/Img";
import { api, formatHour, money } from "../lib/api";
import type { Room } from "../types";

const FAQS = [
  {
    q: "How long can I book?",
    a: "By the hour — 1, 2, or 3 hours per booking. Need longer? Message us and we'll sort it out.",
  },
  {
    q: "Can I extend my booking?",
    a: "If the room is free after your slot, absolutely. Ask at the counter or on WhatsApp.",
  },
  {
    q: "What if I'm late?",
    a: "Your room is held for the full booking — but the clock starts at your booked time.",
  },
  {
    q: "What's the cancellation policy?",
    a: "Cancel free of charge up to 2 hours before your start time.",
  },
];

export function Rooms() {
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    api.get<Room[]>("/api/rooms").then(setRooms).catch(() => {});
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-4xl font-bold text-espresso">Rooms & Spaces</h1>
      <p className="mt-2 max-w-2xl text-charcoal/70">
        Come for the coffee, stay for the calm. Two private rooms, bookable by the hour, with the
        café a few steps away.
      </p>

      <div className="mt-8 space-y-8">
        {rooms.map((room) => (
          <article
            key={room.id}
            className="grid overflow-hidden rounded-2xl bg-white shadow-sm md:grid-cols-2"
          >
            <Img src={room.images[0] ?? null} alt={room.name} className="h-64 w-full md:h-full" />
            <div className="p-7">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-2xl font-bold text-espresso">{room.name}</h2>
                {!room.isAvailable && (
                  <span className="rounded-full bg-terracotta/15 px-3 py-1 text-xs font-semibold text-terracotta-dark">
                    Temporarily unavailable
                  </span>
                )}
              </div>
              <p className="mt-1 font-display text-xl font-semibold text-terracotta">
                {money(room.pricePerHour)}/hour
              </p>
              <p className="mt-3 text-sm text-charcoal/75">{room.description}</p>

              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex gap-2">
                  <dt className="font-semibold text-espresso">Capacity:</dt>
                  <dd>
                    {room.capacityMin}–{room.capacityMax} people
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-semibold text-espresso">Hours:</dt>
                  <dd>
                    {formatHour(room.openHour)} – {formatHour(room.closeHour)}
                  </dd>
                </div>
              </dl>

              <div className="mt-4">
                <p className="text-sm font-semibold text-espresso">Amenities</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {room.amenities.map((a) => (
                    <span key={a} className="rounded-full bg-oat px-3 py-1 text-xs font-medium">
                      {a}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <p className="text-sm font-semibold text-espresso">House rules</p>
                <ul className="mt-1 list-inside list-disc text-sm text-charcoal/70">
                  {room.rules.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>

              <Link
                to={`/book?room=${room.type}`}
                aria-disabled={!room.isAvailable}
                className={`mt-6 inline-block rounded-full px-7 py-2.5 font-semibold transition ${
                  room.isAvailable
                    ? "btn-3d bg-terracotta text-cream"
                    : "pointer-events-none bg-oat text-charcoal/40"
                }`}
              >
                Book {room.name}
              </Link>
            </div>
          </article>
        ))}
      </div>

      <section className="mt-14">
        <h2 className="font-display text-2xl font-bold text-espresso">Good to know</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {FAQS.map((f) => (
            <div key={f.q} className="rounded-xl bg-white p-5 shadow-sm">
              <p className="font-semibold text-espresso">{f.q}</p>
              <p className="mt-1.5 text-sm text-charcoal/70">{f.a}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
