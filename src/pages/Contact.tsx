import { Link } from "react-router-dom";
import { ADDRESS, HOURS, INSTAGRAM_URL, isOpenNow, MAPS_EMBED, MAPS_LINK, PHONE_DISPLAY, PHONE_TEL, WHATSAPP_URL } from "../components/Layout";
import { InstagramIcon, MapPinIcon, PhoneIcon, WhatsAppIcon } from "../components/icons";
import { SuggestionBox } from "../components/SuggestionBox";

export function Contact() {
  const open = isOpenNow();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
      <header className="text-center">
        <h1 className="font-display text-espresso text-4xl font-bold sm:text-5xl">Say hello</h1>
        <p className="text-charcoal/70 mx-auto mt-3 max-w-xl">For orders, room bookings, and questions, contact us anytime.</p>
      </header>

      <div className="mt-10 grid gap-6 lg:grid-cols-2 lg:items-start">
        {/* Left column: WhatsApp, Call, Instagram — three equal-size cards stacked */}
        <div className="grid gap-6 sm:auto-rows-fr">
          {/* WhatsApp — the main contact method */}
          <div className="bg-espresso text-cream flex flex-col rounded-2xl p-6 shadow-md">
            <div className="flex items-start gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#25D366] text-white shadow">
                <WhatsAppIcon className="h-8 w-8" />
              </span>
              <div>
                <h2 className="font-display text-xl font-bold">WhatsApp us</h2>
                <p className="text-oat mt-0.5 text-sm">The fastest way to reach the counter — we reply quickly.</p>
                <p className="mt-2 text-lg font-semibold tracking-wide">{PHONE_DISPLAY}</p>
              </div>
            </div>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noreferrer"
              className="btn-3d mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-3 font-semibold text-white transition hover:bg-[#1ebe5b]"
            >
              <WhatsAppIcon className="h-5 w-5" />
              Message us on WhatsApp
            </a>
          </div>

          {/* Call us */}
          <a href={`tel:${PHONE_TEL}`} className="card-lift flex items-center gap-5 rounded-2xl bg-white p-6 shadow-sm transition hover:shadow-md">
            <span className="bg-sage/15 text-sage-dark flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl">
              <PhoneIcon className="h-7 w-7" />
            </span>
            <div>
              <h2 className="font-display text-espresso text-xl font-bold">Call us</h2>
              <p className="text-charcoal/80 mt-0.5 text-lg font-semibold">{PHONE_DISPLAY}</p>
              <p className="text-charcoal/60 mt-0.5 text-sm">For bookings and big orders.</p>
            </div>
          </a>

          {/* Instagram */}
          <div className="flex flex-col rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center gap-5">
              <span
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow"
                style={{
                  background: "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
                }}
              >
                <InstagramIcon className="h-7 w-7" />
              </span>
              <div>
                <h2 className="font-display text-espresso text-xl font-bold">Instagram</h2>
                <p className="text-terracotta mt-0.5 text-sm font-semibold">@beanavenue.lb</p>
                <p className="text-charcoal/60 mt-0.5 text-sm">See what's brewing.</p>
              </div>
            </div>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noreferrer"
              className="btn-3d bg-espresso text-cream hover:bg-mocha mt-5 inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-semibold transition"
            >
              <InstagramIcon className="h-5 w-5" />
              Follow us on Instagram
            </a>
          </div>
        </div>

        {/* Right column: visit us + map + hours */}
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <span className="bg-terracotta/15 text-terracotta-dark flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl">
              <MapPinIcon className="h-7 w-7" />
            </span>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-espresso text-xl font-bold">Visit us</h2>
                <span
                  className={`rounded-full px-3 py-0.5 text-xs font-semibold ${open ? "bg-sage/25 text-sage-dark" : "bg-terracotta/15 text-terracotta-dark"}`}
                >
                  {open ? "● Open now" : "● Closed"}
                </span>
              </div>
              <p className="text-charcoal/80 mt-1">{ADDRESS}</p>
            </div>
          </div>

          <div className="border-oat mt-4 overflow-hidden rounded-xl border">
            <iframe
              title="Bean Avenue location — Aley, Lebanon"
              src={MAPS_EMBED}
              className="h-52 w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>

          <a
            href={MAPS_LINK}
            target="_blank"
            rel="noreferrer"
            className="btn-3d bg-terracotta text-cream hover:bg-terracotta-dark mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 font-semibold transition"
          >
            <MapPinIcon className="h-5 w-5" />
            Open in Google Maps
          </a>

          <h3 className="font-display text-espresso mt-6 text-lg font-bold">Opening hours</h3>
          <table className="mt-2 w-full text-sm">
            <tbody>
              {HOURS.map((h) => (
                <tr key={h.day} className="border-oat border-b last:border-0">
                  <td className="text-charcoal/80 py-1.5 font-medium">{h.day}</td>
                  <td className="text-charcoal/70 py-1.5 text-right">
                    {h.open} – {h.close}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Book a room — highlighted */}
      <section className="from-mocha to-espresso mt-6 overflow-hidden rounded-3xl bg-gradient-to-br shadow-lg">
        <div className="text-cream flex flex-col items-center gap-5 p-8 text-center sm:flex-row sm:justify-between sm:gap-8 sm:p-10 sm:text-left">
          <div>
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Need a space to focus?</h2>
            <p className="text-oat mt-2 max-w-xl">Reserve our Study Room or Conference Room for studying, meetings, and group work — coffee just steps away.</p>
          </div>
          <Link
            to="/book"
            className="btn-3d bg-terracotta text-cream hover:bg-terracotta-dark inline-flex w-full items-center justify-center rounded-full px-8 py-3.5 font-semibold transition sm:w-auto"
          >
            Book a Room
          </Link>
        </div>
      </section>

      {/* Suggestion box */}
      <SuggestionBox />
    </div>
  );
}
