import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { HomeBanner } from "../components/HomeBanner";
import { CompactMenuCard, CompactShopCard, ScrollRow, type HomeShopProduct } from "../components/HomeScroll";
import { HOURS, isOpenNow, MAPS_EMBED, WHATSAPP_URL } from "../components/Layout";
import { Img } from "../components/Img";
import { OffersSignup } from "../components/OffersSignup";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { api } from "../lib/api";
import type { MenuItem, Room } from "../types";

interface FeaturedSection {
  title: string;
  visible: boolean;
  items: MenuItem[];
}

interface DoughnutPromo {
  visible: boolean;
  title: string;
  description: string;
  buttonText: string;
  image: string | null;
}

export function Home() {
  const { account } = useCustomerAuth();
  const [featured, setFeatured] = useState<FeaturedSection>({
    title: "The usual suspects.",
    visible: true,
    items: [],
  });
  const [doughnutPromo, setDoughnutPromo] = useState<DoughnutPromo | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [shop, setShop] = useState<{ products: HomeShopProduct[]; categories: { id: number; name: string }[] }>({ products: [], categories: [] });
  const open = isOpenNow();

  useEffect(() => {
    api.get<FeaturedSection>("/api/featured").then(setFeatured).catch(() => {});
    api.get<DoughnutPromo>("/api/doughnuts/promo").then(setDoughnutPromo).catch(() => {});
    api.get<Room[]>("/api/rooms").then(setRooms).catch(() => {});
    api.get<{ products: HomeShopProduct[]; categories: { id: number; name: string }[] }>("/api/shop").then(setShop).catch(() => {});
  }, []);

  // One shop product per category (prefer a featured one), in category order.
  const shopHighlights = useMemo(() => {
    const byCat = new Map<string, HomeShopProduct & { featured?: boolean }>();
    for (const p of shop.products as (HomeShopProduct & { featured?: boolean })[]) {
      const cur = byCat.get(p.category);
      if (!cur || (p.featured && !cur.featured)) byCat.set(p.category, p);
    }
    return shop.categories.map((c) => byCat.get(c.name)).filter(Boolean) as HomeShopProduct[];
  }, [shop]);

  const studyRoom = rooms.find((r) => r.type === "STUDY");
  const confRoom = rooms.find((r) => r.type === "CONFERENCE");

  return (
    <div>
      <HomeBanner />

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
          className="float-bean absolute left-[6%] top-16 w-16 opacity-80 md:block"
        />
        <img
          src="/bean.png"
          alt=""
          aria-hidden
          className="float-bean absolute right-[8%] top-28 w-12 opacity-70 md:block"
          style={{ animationDelay: "1.4s" }}
        />
        <img
          src="/bean.png"
          alt=""
          aria-hidden
          className="float-bean absolute bottom-12 left-[16%] w-10 opacity-60 lg:block"
          style={{ animationDelay: "2.8s" }}
        />
        <img
          src="/bean.png"
          alt=""
          aria-hidden
          className="float-bean absolute bottom-20 right-[18%] w-14 opacity-75 lg:block"
          style={{ animationDelay: "0.7s" }}
        />
        <img
          src="/bean.png"
          alt=""
          aria-hidden
          className="float-bean absolute left-[28%] top-10 w-9 opacity-60 lg:block"
          style={{ animationDelay: "2.1s" }}
        />
        <img
          src="/bean.png"
          alt=""
          aria-hidden
          className="float-bean absolute right-[30%] top-20 w-8 opacity-50 lg:block"
          style={{ animationDelay: "3.4s" }}
        />
        <img
          src="/bean.png"
          alt=""
          aria-hidden
          className="float-bean absolute left-[3%] bottom-24 w-12 opacity-70 md:block"
          style={{ animationDelay: "1.9s" }}
        />
        <img
          src="/bean.png"
          alt=""
          aria-hidden
          className="float-bean absolute right-[4%] bottom-10 w-10 opacity-60 md:block"
          style={{ animationDelay: "3.1s" }}
        />
        <img
          src="/bean.png"
          alt=""
          aria-hidden
          className="float-bean absolute left-[44%] bottom-6 w-7 opacity-50 lg:block"
          style={{ animationDelay: "0.4s" }}
        />
        <img
          src="/bean.png"
          alt=""
          aria-hidden
          className="float-bean absolute right-[14%] top-1/2 w-9 opacity-55 lg:block"
          style={{ animationDelay: "2.5s" }}
        />
        <div className="relative mx-auto max-w-6xl px-4 py-16 text-center sm:py-24">
          <img
            src="/logo.png"
            alt="Bean Avenue — Brews, Bonds and Business"
            className="fade-up mx-auto w-full max-w-lg drop-shadow-xl sm:max-w-xl"
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

      {/* Featured menu — compact horizontal carousel (manager-curated) */}
      {featured.visible && featured.items.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-10">
          <div className="mb-5 flex items-end justify-between gap-3">
            <h2 className="font-display text-2xl font-bold text-espresso sm:text-3xl">{featured.title}</h2>
            <Link to="/menu" className="btn-3d shrink-0 rounded-full bg-espresso px-4 py-2 text-sm font-semibold text-cream hover:bg-mocha">View Full Menu →</Link>
          </div>
          <ScrollRow>
            {featured.items.map((item) => <CompactMenuCard key={item.id} item={item} />)}
          </ScrollRow>
        </section>
      )}

      {/* Today's Hanson Doughnuts promo — black Hanson identity, orange accent */}
      {doughnutPromo?.visible && (
        <section className="mx-auto max-w-6xl px-4 pb-4">
          <div className="overflow-hidden rounded-3xl bg-black shadow-xl ring-1 ring-white/10">
            <div className="grid items-center gap-8 p-8 sm:grid-cols-2 sm:p-10">
              <img
                src={doughnutPromo.image ?? "/doughnut-placeholder.svg"}
                alt="Hanson Doughnuts"
                onError={(e) => (e.currentTarget.src = "/doughnut-placeholder.svg")}
                className="mx-auto h-48 w-48 object-contain drop-shadow-[0_6px_24px_rgba(255,255,255,0.12)] sm:h-60 sm:w-60"
              />
              <div className="text-center sm:text-left">
                <span className="inline-block rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-white">
                  Hanson Doughnuts
                </span>
                <h2 className="mt-4 font-display text-3xl font-bold text-white sm:text-4xl">
                  {doughnutPromo.title}
                </h2>
                <p className="mt-3 text-white/70">{doughnutPromo.description}</p>
                <Link
                  to="/doughnuts"
                  className="btn-3d mt-6 inline-block rounded-full bg-terracotta px-8 py-3 font-semibold text-white shadow-[0_0_24px_rgba(242,100,25,0.35)] transition hover:bg-terracotta-dark"
                >
                  {doughnutPromo.buttonText}
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

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

      {/* Shop — compact horizontal carousel (one product per shop category) */}
      {shopHighlights.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-10">
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold text-espresso sm:text-3xl">Take Bean Avenue Home.</h2>
              <p className="mt-1 text-sm text-charcoal/55">illy capsules, machines, beans & more — for pickup or preorder.</p>
            </div>
            <Link to="/shop" className="btn-3d shrink-0 rounded-full bg-terracotta px-4 py-2 text-sm font-semibold text-cream hover:bg-terracotta-dark">Full Shop →</Link>
          </div>
          <ScrollRow>
            {shopHighlights.map((p) => <CompactShopCard key={p.id} product={p} />)}
          </ScrollRow>
        </section>
      )}

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
          {account ? (
            <>
              <h2 className="font-display text-3xl font-bold text-espresso">
                Hey {account.name} — you have {account.beanBalance} beans ☕
              </h2>
              <p className="mt-3 text-charcoal/70">
                Keep sipping to earn more, then trade your beans for free drinks, pastries, and study
                hours.
              </p>
              <Link
                to="/loyalty"
                className="btn-3d mt-6 inline-block rounded-full bg-terracotta px-8 py-3 font-semibold text-cream"
              >
                View my rewards
              </Link>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </section>

      {/* Offers signup */}
      <section className="mx-auto max-w-4xl px-4 pt-16">
        <OffersSignup />
      </section>

      {/* Location & hours */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl font-bold text-espresso">Find us</h2>
            <p className="mt-3 text-charcoal/80">Aley, Lebanon</p>
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
              title="Bean Avenue location — Aley, Lebanon"
              src={MAPS_EMBED}
              className="h-72 w-full border-0 md:h-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
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
