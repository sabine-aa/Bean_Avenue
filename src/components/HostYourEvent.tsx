import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, money } from "../lib/api";
import type { Room } from "../types";
import { Img } from "./Img";

// Fallback photos if a room has none set in the admin.
const ROOM_PHOTOS: Record<string, string> = {
  STUDY: "/photos/study-room-whiteboard.jpg",
  CONFERENCE: "/photos/conference-room.jpg",
};

const SPACES = [
  {
    type: "STUDY",
    name: "Study Room",
    suited: ["Private study sessions", "Tutoring", "Small group work", "Focused meetings"],
    button: "View Study Room",
  },
  {
    type: "CONFERENCE",
    name: "Conference Room",
    suited: ["Business meetings", "Workshops", "Presentations", "Team sessions", "Small private events"],
    button: "View Conference Room",
  },
];

/** "Host Your Event at Bean Avenue" — promotes the bookable rooms with real photos. */
export function HostYourEvent() {
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    api
      .get<Room[]>("/api/rooms")
      .then(setRooms)
      .catch(() => setRooms([]));
  }, []);

  return (
    <section className="bg-espresso text-cream rounded-3xl px-6 py-12 sm:px-12">
      <h2 className="font-display text-3xl font-bold sm:text-4xl">Host Your Event at Bean Avenue</h2>
      <p className="text-cream/80 mt-3 max-w-2xl text-lg">
        Looking for a comfortable place to organize a meeting, workshop, study session, presentation, or small private gathering? Our spaces can be booked by
        the hour.
      </p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {SPACES.map((s) => {
          const room = rooms.find((r) => r.type === s.type);
          const photo = room?.images?.[0] ?? ROOM_PHOTOS[s.type];
          return (
            <div key={s.type} className="border-cream/15 bg-cream text-charcoal flex flex-col overflow-hidden rounded-2xl border shadow-xl">
              <Img src={photo} alt={s.name} className="bg-oat aspect-[16/9] w-full" />
              <div className="flex flex-1 flex-col p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-espresso text-2xl font-bold">{s.name}</h3>
                  {room && <span className="bg-terracotta text-cream rounded-full px-3 py-1 text-sm font-bold">{money(room.pricePerHour)}/hr</span>}
                </div>
                {room && (
                  <p className="text-charcoal/60 mt-1 text-sm font-semibold">
                    Seats {room.capacityMin}–{room.capacityMax} people
                  </p>
                )}

                <p className="text-charcoal/40 mt-4 text-xs font-bold tracking-wide uppercase">Suitable for</p>
                <ul className="text-charcoal/80 mt-2 flex-1 space-y-1.5">
                  {s.suited.map((u) => (
                    <li key={u} className="flex items-start gap-2">
                      <span className="bg-terracotta mt-2 h-1.5 w-1.5 shrink-0 rounded-full" />
                      {u}
                    </li>
                  ))}
                </ul>

                <Link to="/rooms" className="btn-3d bg-espresso text-cream mt-6 inline-block rounded-full px-6 py-3 text-center text-base font-semibold">
                  {s.button}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
