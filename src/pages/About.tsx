import { Link } from "react-router-dom";
import { Img } from "../components/Img";

const GALLERY: { src: string; alt: string }[] = [
  { src: "/photos/coffee-lane-counter.jpg", alt: "The Coffee Lane counter and pastry display" },
  { src: "/photos/cafe-seating.jpg", alt: "Café seating under the gold light fixtures" },
  { src: "/photos/spiral-staircase.jpg", alt: "Lounge seating beside the spiral staircase" },
  { src: "/photos/coffee-bar.jpg", alt: "The espresso bar with illy beans and syrups" },
  { src: "/photos/cafe-nook.jpg", alt: "A quiet café seating nook" },
  { src: "/photos/lounge-corner.jpg", alt: "A cozy lounge corner" },
];

export function About() {
  return (
    <div>
      {/* Hero image */}
      <section className="relative">
        <Img
          src="/photos/storefront-sign.jpg"
          alt="Inside Bean Avenue — the gold storefront sign and seating"
          className="h-72 w-full sm:h-96"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-espresso/70 to-espresso/10" />
        <div className="absolute inset-0 flex items-end">
          <div className="mx-auto w-full max-w-5xl px-4 pb-8">
            <h1 className="font-display text-3xl font-bold text-cream drop-shadow sm:text-4xl">
              Come for the coffee, stay for the calm.
            </h1>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="space-y-4 text-charcoal/80">
          <p>
            Most cafés sell coffee. Bean Avenue sells coffee <strong>and</strong> the space to use it
            well. We're two businesses in one warm room: a café that takes its beans seriously, and a
            workspace with quiet rooms you can book by the hour.
          </p>
          <p>
            We built this place for students cramming for exams, freelancers escaping noisy homes,
            small teams who need a room for a couple of hours, and regulars who just want their
            usual — made right, every time.
          </p>
          <p>
            Fast Wi-Fi. Power at every seat. Bottomless coffee a few steps away. And the good kind of
            silence when you need it.
          </p>
        </div>
      </div>

      {/* A look around */}
      <section className="mx-auto max-w-5xl px-4 pb-12">
        <h2 className="font-display text-2xl font-bold text-espresso">A look around</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {GALLERY.map((photo) => (
            <Img
              key={photo.src}
              src={photo.src}
              alt={photo.alt}
              className="card-lift h-52 w-full rounded-2xl shadow-sm"
            />
          ))}
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 pb-16">
        <div className="flex flex-wrap gap-3">
          <Link
            to="/menu"
            className="btn-3d rounded-full bg-espresso px-7 py-3 font-semibold text-cream"
          >
            See the menu
          </Link>
          <Link
            to="/rooms"
            className="btn-3d rounded-full bg-terracotta px-7 py-3 font-semibold text-cream"
          >
            Tour the rooms
          </Link>
        </div>
      </div>
    </div>
  );
}
