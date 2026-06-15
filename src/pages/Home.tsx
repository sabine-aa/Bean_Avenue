import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { HOURS, isOpenNow, WHATSAPP_URL } from "../components/Layout";
import { Img } from "../components/Img";
import { MenuItemCard } from "../components/MenuItemCard";
import { api } from "../lib/api";
import type { MenuItem, Room } from "../types";

export function Home() {
  const [popular, setPopular] = useState<MenuItem[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const open = isOpenNow();

  useEffect(() => {
    api
      .get<MenuItem[]>("/api/menu")
      .then((items) => setPopular(items.filter((i) => i.inStock).slice(0, 6)))
      .catch(() => {});
    api.get<Room[]>("/api/rooms").then(setRooms).catch(() => {});
  }, []);

  const studyRoom = rooms.find((r) => r.type === "STUDY");
  const confRoom = rooms.find((r) => r.type === "CONFERENCE");

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-oat">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 50% 30%, rgb(255 255 255 / 0.7), transparent 55%)",
          }}
          aria-hidden
        />
        {/* floating 3D beans */}
        <img
          src="/bean.png"
          alt=""
          aria-hidden
          className="float-bean absolute left-[6%] top-16 hidden w-16 opacity-80 md:block"
        />
        <img
          src="/bean.png"
          alt=""
          aria-hidden
          className="float-bean absolute right-[8%] top-28 hidden w-12 opacity-70 md:block"
          style={{ animationDelay: "1.4s" }}
        />
        <img
          src="/bean.png"
          alt=""
          aria-hidden
          className="float-bean absolute bottom-12 left-[16%] hidden w-10 opacity-60 lg:block"
          style={{ animationDelay: "2.8s" }}
        />
        <img
          src="/bean.png"
          alt=""
          aria-hidden
          className="float-bean absolute bottom-20 right-[18%] hidden w-14 opacity-75 lg:block"
          style={{ animationDelay: "0.7s" }}
        />
        <div className="relative mx-auto max-w-6xl px-4 py-16 text-center sm:py-24">
          <img
            src="/logo.png"
            alt="Bean Avenue — Brews, Bonds and Business"
            className="fade-up mx-auto w-full max-w-md drop-shadow-xl sm:max-w-lg"
          />
          <p
            className="fade-up mx-auto mt-6 max-w-xl text-lg text-charcoal/80"
            style={{ animationDelay: "0.1s" }}
          >
            Freshly brewed coffee and quiet rooms to get things done — all on one avenue.
          </p>
          <div
            className="fade-up mt-8 flex flex-wrap justify-center gap-4"
            style={{ animationDelay: "0.2s" }}
          >
            <Link
              to="/menu"
              className="btn-3d rounded-full bg-terracotta px-9 py-3.5 font-semibold text-cream"
            >
              Order Now
            </Link>
            <Link
              to="/book"
              className="btn-3d rounded-full bg-espresso px-9 py-3.5 font-semibold text-cream"
            >
              Book a Room
            </Link>
          </div>
        </div>
      </section>

      {/* Popular items */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-3xl font-bold text-espresso">The usual suspects.</h2>
          <Link to="/menu" className="text-sm font-semibold text-terracotta hover:underline">
            Full menu →
          </Link>
        </div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {popular.map((item) => (
            <MenuItemCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      {/* Room teasers */}
      <section className="bg-oat/60 py-16">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 md:grid-cols-2">
          <div className="card-lift overflow-hidden rounded-2xl bg-white shadow-sm">
            <Img
              src="/photos/study-room-whiteboard.jpg"
              alt="The Study Room"
              className="h-52 w-full"
            />
            <div className="p-8">
              <h3 className="font-display text-2xl font-bold text-espresso">Book a Study Room</h3>
              <p className="mt-2 text-charcoal/70">
                Quiet private space for studying, meetings, or work.
              </p>
              <p className="mt-4 font-display text-xl font-semibold text-terracotta">
                From ${studyRoom?.pricePerHour ?? 5}/hour
              </p>
              <Link
                to="/book?room=STUDY"
                className="btn-3d mt-5 inline-block rounded-full bg-espresso px-6 py-2.5 font-semibold text-cream"
              >
                Book Now
              </Link>
            </div>
          </div>
          <div className="card-lift overflow-hidden rounded-2xl bg-white shadow-sm">
            <Img
              src="/photos/conference-room.jpg"
              alt="The Conference Room"
              className="h-52 w-full"
            />
            <div className="p-8">
              <h3 className="font-display text-2xl font-bold text-espresso">Book a Conference Room</h3>
              <p className="mt-2 text-charcoal/70">
                Perfect for meetings, presentations, and group work.
              </p>
              <p className="mt-4 font-display text-xl font-semibold text-terracotta">
                From ${confRoom?.pricePerHour ?? 20}/hour
              </p>
              <Link
                to="/book?room=CONFERENCE"
                className="btn-3d mt-5 inline-block rounded-full bg-espresso px-6 py-2.5 font-semibold text-cream"
              >
                Book Now
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Why Bean Avenue */}
      <section className="mx-auto max-w-6xl px-4 py-16 text-center">
        <h2 className="font-display text-3xl font-bold text-espresso">Why Bean Avenue</h2>
        <div className="mt-8 grid gap-8 sm:grid-cols-3">
          {[
            ["📶", "Fast Wi-Fi", "Stream, sync, and ship without the spinner."],
            ["🔌", "Power at every seat", "No more hovering by the one outlet."],
            ["☕", "Bottomless coffee nearby", "The refill is never far away."],
          ].map(([icon, title, blurb]) => (
            <div key={title}>
              <p className="text-4xl">{icon}</p>
              <h3 className="mt-3 font-semibold text-espresso">{title}</h3>
              <p className="mt-1 text-sm text-charcoal/70">{blurb}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Loyalty teaser */}
      <section className="bg-sage/15 py-14">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="font-display text-3xl font-bold text-espresso">
            Every cup earns you beans.
          </h2>
          <p className="mt-3 text-charcoal/70">
            Earn 1 bean per $1 — on coffee <em>and</em> room bookings. Trade them for free drinks,
            pastries, and study hours.
          </p>
          <Link
            to="/loyalty"
            className="btn-3d mt-6 inline-block rounded-full bg-terracotta px-8 py-3 font-semibold text-cream"
          >
            Join Free
          </Link>
        </div>
      </section>

      {/* Location & hours */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl font-bold text-espresso">Find us</h2>
            <p className="mt-3 text-charcoal/80">123 Avenue Street, Your City</p>
            <span
              className={`mt-3 inline-block rounded-full px-3 py-1 text-sm font-semibold ${
                open ? "bg-sage/25 text-sage-dark" : "bg-terracotta/15 text-terracotta-dark"
              }`}
            >
              {open ? "● Open now" : "● Closed"}
            </span>
            <table className="mt-5 w-full max-w-sm text-sm">
              <tbody>
                {HOURS.map((h) => (
                  <tr key={h.day} className="border-b border-oat">
                    <td className="py-1.5 font-medium">{h.day}</td>
                    <td className="py-1.5 text-right text-charcoal/70">
                      {h.open} – {h.close}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="overflow-hidden rounded-2xl shadow-sm">
            <iframe
              title="Bean Avenue location map"
              src="https://www.openstreetmap.org/export/embed.html?bbox=-0.13%2C51.50%2C-0.11%2C51.52&layer=mapnik"
              className="h-72 w-full border-0 md:h-full"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* Contact strip */}
      <section className="mx-auto max-w-6xl px-4 pb-4 text-center">
        <p className="text-charcoal/70">Questions? Message us — we reply fast.</p>
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noreferrer"
          className="btn-3d mt-4 inline-block rounded-full bg-sage px-8 py-3 font-semibold text-cream"
        >
          💬 WhatsApp us
        </a>
      </section>
    </div>
  );
}
