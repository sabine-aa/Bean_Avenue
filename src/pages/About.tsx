import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Img } from "../components/Img";
import { ADDRESS, MAPS_LINK } from "../components/Layout";
import { CoffeeCupIcon, DoorIcon, LaptopIcon, MapPinIcon, UsersIcon } from "../components/icons";
import { api, money } from "../lib/api";
import type { Room } from "../types";

const GALLERY = [
  { src: "/photos/coffee-lane-counter.jpg", alt: "The coffee counter and pastry display" },
  { src: "/photos/cafe-seating.jpg", alt: "Indoor seating under the warm light fixtures" },
  { src: "/photos/study-room-library.jpg", alt: "The study area" },
  { src: "/photos/conference-room.jpg", alt: "The conference room" },
  { src: "/photos/lounge-corner.jpg", alt: "A cozy lounge corner" },
  { src: "/photos/coffee-bar.jpg", alt: "The espresso bar" },
  { src: "/photos/spiral-staircase.jpg", alt: "Lounge beside the spiral staircase" },
  { src: "/photos/cafe-nook.jpg", alt: "A quiet seating nook" },
];

const FEATURES = [
  {
    Icon: CoffeeCupIcon,
    title: "Quality Coffee",
    text: "Carefully prepared drinks and customer favorites served throughout the day.",
  },
  {
    Icon: LaptopIcon,
    title: "Study and Work Space",
    text: "Comfortable seating, Wi-Fi, power access, and an environment designed for focus.",
  },
  {
    Icon: DoorIcon,
    title: "Bookable Rooms",
    text: "A private study room and conference room for individual work, meetings, and group sessions.",
  },
  {
    Icon: UsersIcon,
    title: "Community",
    text: "A welcoming place for students, professionals, families, and friends.",
  },
];

const ROOM_PHOTOS: Record<string, string> = {
  STUDY: "/photos/study-room-whiteboard.jpg",
  CONFERENCE: "/photos/conference-room.jpg",
};

export function About() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Room[]>("/api/rooms")
      .then(setRooms)
      .catch(() => {});
  }, []);

  const study = rooms.find((r) => r.type === "STUDY");
  const conference = rooms.find((r) => r.type === "CONFERENCE");
  const roomCards = [study, conference].filter(Boolean) as Room[];

  return (
    <div>
      {/* Hero */}
      <section className="relative h-[78vh] min-h-[26rem] w-full overflow-hidden">
        <Img src="/photos/cafe-seating.jpg" alt="Inside Bean Avenue" className="absolute inset-0 h-full w-full" />
        <div className="from-espresso/55 via-espresso/45 to-espresso/75 absolute inset-0 bg-gradient-to-b" />
        <div className="relative mx-auto flex h-full max-w-5xl flex-col items-center justify-center px-4 text-center">
          <span className="bg-cream/15 text-cream rounded-full px-4 py-1 text-xs font-bold tracking-[0.2em] uppercase backdrop-blur">Bean Avenue · Aley</span>
          <h1 className="font-display text-cream mt-4 text-4xl font-bold drop-shadow-lg sm:text-6xl">More than a coffee shop.</h1>
          <p className="text-cream/90 mt-4 max-w-2xl text-lg drop-shadow sm:text-xl">
            A place in Aley to meet, study, work, connect, and enjoy your usual cup.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/menu" className="btn-3d bg-terracotta text-cream rounded-full px-8 py-3.5 font-semibold">
              Explore the Menu
            </Link>
            <Link to="/book" className="btn-3d bg-cream text-espresso rounded-full px-8 py-3.5 font-semibold">
              Book a Room
            </Link>
          </div>
        </div>
      </section>

      {/* Our Story */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="overflow-hidden rounded-3xl shadow-lg">
            <Img src="/photos/spiral-staircase.jpg" alt="Inside Bean Avenue" className="h-72 w-full sm:h-[28rem]" />
          </div>
          <div>
            <p className="text-terracotta text-sm font-bold tracking-[0.2em] uppercase">Our Story</p>
            <h2 className="font-display text-espresso mt-2 text-3xl font-bold sm:text-4xl">The Bean Avenue Story</h2>
            <div className="text-charcoal/80 mt-5 space-y-4">
              <p>
                Bean Avenue was created to offer more than great coffee. We wanted to build a warm and comfortable space where people can meet, study, work, and
                spend time together.
              </p>
              <p>
                Located in Aley, Bean Avenue combines quality drinks and food with comfortable seating, quiet working areas, a study room, a conference room,
                and a welcoming community atmosphere.
              </p>
              <p>
                Whether someone is visiting for their usual coffee, preparing for an exam, meeting a team, or spending time with friends, Bean Avenue should
                feel comfortable and welcoming.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* More Than Your Usual Coffee Stop */}
      <section className="bg-oat/40 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center">
            <h2 className="font-display text-espresso text-3xl font-bold sm:text-4xl">More Than Your Usual Coffee Stop</h2>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ Icon, title, text }) => (
              <div key={title} className="card-lift border-oat flex flex-col rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-xl">
                <span className="bg-espresso text-cream flex h-14 w-14 items-center justify-center rounded-2xl">
                  <Icon className="h-7 w-7" />
                </span>
                <h3 className="font-display text-espresso mt-4 text-xl font-bold">{title}</h3>
                <p className="text-charcoal/70 mt-2 text-sm">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Inside Bean Avenue — gallery */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <h2 className="font-display text-espresso text-3xl font-bold sm:text-4xl">Inside Bean Avenue</h2>
        <p className="text-charcoal/60 mt-2">A look around the counter, seating, study area, and rooms.</p>
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {GALLERY.map((photo) => (
            <button
              key={photo.src}
              onClick={() => setLightbox(photo.src)}
              className="card-lift group relative overflow-hidden rounded-2xl shadow-sm"
              aria-label={`View ${photo.alt}`}
            >
              <Img src={photo.src} alt={photo.alt} className="h-44 w-full transition group-hover:scale-105 sm:h-52" />
              <span className="from-espresso/70 text-cream absolute inset-x-0 bottom-0 bg-gradient-to-t to-transparent p-3 text-left text-xs font-semibold opacity-0 transition group-hover:opacity-100">
                {photo.alt}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* A Space for Every Plan — rooms */}
      <section className="bg-oat/40 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="font-display text-espresso text-3xl font-bold sm:text-4xl">A Space for Every Plan</h2>
          <p className="text-charcoal/60 mt-2">Book a quiet space by the hour — pay at the café.</p>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {roomCards.map((room) => (
              <div key={room.id} className="card-lift overflow-hidden rounded-3xl bg-white shadow-sm transition hover:shadow-xl">
                <Img src={ROOM_PHOTOS[room.type] ?? room.images?.[0] ?? null} alt={room.name} className="h-60 w-full" />
                <div className="p-6">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display text-espresso text-2xl font-bold">{room.name}</h3>
                    <span className="bg-oat text-espresso rounded-full px-3 py-1 text-sm font-bold whitespace-nowrap">{money(room.pricePerHour)}/hr</span>
                  </div>
                  <p className="text-sage-dark mt-1 text-sm font-semibold">
                    Seats {room.capacityMin}–{room.capacityMax} people
                  </p>
                  <p className="text-charcoal/70 mt-3 text-sm">{room.description}</p>
                  <Link to={`/book?room=${room.type}`} className="btn-3d bg-espresso text-cream mt-5 inline-block rounded-full px-6 py-2.5 font-semibold">
                    Book a Room
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden">
        <Img src="/photos/coffee-lane-counter.jpg" alt="" className="absolute inset-0 h-full w-full" />
        <div className="bg-espresso/85 absolute inset-0" />
        <div className="relative mx-auto max-w-3xl px-4 py-20 text-center">
          <h2 className="font-display text-cream text-3xl font-bold sm:text-4xl">Come for the coffee. Stay for the experience.</h2>
          <p className="text-cream/80 mt-3">{ADDRESS}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/menu" className="btn-3d bg-terracotta text-cream rounded-full px-8 py-3.5 font-semibold">
              Order Now
            </Link>
            <a
              href={MAPS_LINK}
              target="_blank"
              rel="noreferrer"
              className="btn-3d bg-cream text-espresso inline-flex items-center gap-2 rounded-full px-8 py-3.5 font-semibold"
            >
              <MapPinIcon className="h-5 w-5" /> Visit Bean Avenue
            </a>
          </div>
        </div>
      </section>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          <button className="text-cream absolute top-4 right-4 rounded-full bg-white/10 px-3 py-1 text-2xl hover:bg-white/20" aria-label="Close">
            ✕
          </button>
          <img src={lightbox} alt="" className="max-h-[90vh] max-w-[92vw] rounded-2xl shadow-2xl" />
        </div>
      )}
    </div>
  );
}
