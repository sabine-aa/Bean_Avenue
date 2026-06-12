import { Link } from "react-router-dom";

export function About() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-4xl font-bold text-espresso">
        Come for the coffee, stay for the calm.
      </h1>
      <div className="mt-6 space-y-4 text-charcoal/80">
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
      <div className="mt-10 flex flex-wrap gap-3">
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
  );
}
