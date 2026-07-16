import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { HomeBanner } from "../components/HomeBanner";
import { CompactMenuCard, ScrollRow, ShopCategoryCard, type HomeShopProduct } from "../components/HomeScroll";
import { HOURS, isOpenNow, MAPS_EMBED, WHATSAPP_URL } from "../components/Layout";
import { Img } from "../components/Img";
import { OffersSignup } from "../components/OffersSignup";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { api } from "../lib/api";
import { MACHINE_CATS } from "./Shop";
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
    api
      .get<FeaturedSection>("/api/featured")
      .then(setFeatured)
      .catch(() => {});
    api
      .get<DoughnutPromo>("/api/doughnuts/promo")
      .then(setDoughnutPromo)
      .catch(() => {});
    api
      .get<Room[]>("/api/rooms")
      .then(setRooms)
      .catch(() => {});
    api
      .get<{ products: HomeShopProduct[]; categories: { id: number; name: string }[] }>("/api/shop")
      .then(setShop)
      .catch(() => {});
  }, []);

  // One tile per shop category (photo from a featured product when possible),
  // with the lowest price — customers see the whole range at a glance and
  // click through into /shop to browse the category.
  const shopCategoryTiles = useMemo(() => {
    type P = HomeShopProduct & { featured?: boolean };
    const byCat = new Map<string, { rep: P; from: number }>();
    for (const p of shop.products as P[]) {
      const cur = byCat.get(p.category);
      if (!cur) byCat.set(p.category, { rep: p, from: p.price });
      else {
        cur.from = Math.min(cur.from, p.price);
        if (p.featured && !cur.rep.featured) cur.rep = p;
      }
    }
    const tiles = shop.categories.flatMap((c) => {
      const e = byCat.get(c.name);
      return e ? [{ name: c.name, image: e.rep.images[0] ?? "", from: e.from }] : [];
    });
    // Alternate coffee / machine tiles so the row shows the full range up front.
    const machineSet = new Set(MACHINE_CATS);
    const coffee = tiles.filter((t) => !machineSet.has(t.name));
    const machines = tiles.filter((t) => machineSet.has(t.name));
    const mixed: typeof tiles = [];
    for (let i = 0; i < Math.max(coffee.length, machines.length); i++) {
      if (coffee[i]) mixed.push(coffee[i]);
      if (machines[i]) mixed.push(machines[i]);
    }
    return mixed;
  }, [shop]);

  const studyRoom = rooms.find((r) => r.type === "STUDY");
  const confRoom = rooms.find((r) => r.type === "CONFERENCE");

  return (
    <div>
      <HomeBanner />

      {/* Hero */}
      <section className="bg-oat relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle at 50% 30%, rgb(255 255 255 / 0.7), transparent 55%)",
          }}
          aria-hidden
        />
        {/* floating 3D beans */}
        <img src="/bean.png" alt="" aria-hidden className="float-bean absolute top-16 left-[6%] w-16 opacity-80 md:block" />
        <img src="/bean.png" alt="" aria-hidden className="float-bean absolute top-28 right-[8%] w-12 opacity-70 md:block" style={{ animationDelay: "1.4s" }} />
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
          className="float-bean absolute right-[18%] bottom-20 w-14 opacity-75 lg:block"
          style={{ animationDelay: "0.7s" }}
        />
        <img src="/bean.png" alt="" aria-hidden className="float-bean absolute top-10 left-[28%] w-9 opacity-60 lg:block" style={{ animationDelay: "2.1s" }} />
        <img src="/bean.png" alt="" aria-hidden className="float-bean absolute top-20 right-[30%] w-8 opacity-50 lg:block" style={{ animationDelay: "3.4s" }} />
        <img
          src="/bean.png"
          alt=""
          aria-hidden
          className="float-bean absolute bottom-24 left-[3%] w-12 opacity-70 md:block"
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
          className="float-bean absolute bottom-6 left-[44%] w-7 opacity-50 lg:block"
          style={{ animationDelay: "0.4s" }}
        />
        <img
          src="/bean.png"
          alt=""
          aria-hidden
          className="float-bean absolute top-1/2 right-[14%] w-9 opacity-55 lg:block"
          style={{ animationDelay: "2.5s" }}
        />
        <div className="relative mx-auto max-w-6xl px-4 py-16 text-center sm:py-24">
          <img src="/logo.png" alt="Bean Avenue — Brews, Bonds and Business" className="fade-up mx-auto w-full max-w-lg drop-shadow-xl sm:max-w-xl" />
          <p className="fade-up text-charcoal/80 mx-auto mt-6 max-w-xl text-lg" style={{ animationDelay: "0.1s" }}>
            Freshly brewed coffee and quiet rooms to get things done — all on one avenue.
          </p>
          <div className="fade-up mt-8 flex flex-wrap justify-center gap-4" style={{ animationDelay: "0.2s" }}>
            <Link to="/menu" className="btn-3d bg-terracotta text-cream rounded-full px-9 py-3.5 font-semibold">
              Order Now
            </Link>
            <Link to="/book" className="btn-3d bg-espresso text-cream rounded-full px-9 py-3.5 font-semibold">
              Book a Room
            </Link>
          </div>
        </div>
      </section>

      {/* Featured menu — compact horizontal carousel (manager-curated) */}
      {featured.visible && featured.items.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-10">
          <div className="mb-5 flex items-end justify-between gap-3">
            <h2 className="font-display text-espresso text-2xl font-bold sm:text-3xl">{featured.title}</h2>
            <Link to="/menu" className="btn-3d bg-espresso text-cream hover:bg-mocha shrink-0 rounded-full px-4 py-2 text-sm font-semibold">
              View Full Menu →
            </Link>
          </div>
          <ScrollRow>
            {featured.items.map((item) => (
              <CompactMenuCard key={item.id} item={item} />
            ))}
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
                <span className="inline-block rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold tracking-[0.2em] text-white uppercase">
                  Hanson Doughnuts
                </span>
                <h2 className="font-display mt-4 text-3xl font-bold text-white sm:text-4xl">{doughnutPromo.title}</h2>
                <p className="mt-3 text-white/70">{doughnutPromo.description}</p>
                <Link
                  to="/doughnuts"
                  className="btn-3d bg-terracotta hover:bg-terracotta-dark mt-6 inline-block rounded-full px-8 py-3 font-semibold text-white shadow-[0_0_24px_rgba(242,100,25,0.35)] transition"
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
            <Img src="/photos/study-room-whiteboard.jpg" alt="The Study Room" className="h-52 w-full" />
            <div className="p-8">
              <h3 className="font-display text-espresso text-2xl font-bold">Book a Study Room</h3>
              <p className="text-charcoal/70 mt-2">Quiet private space for studying, meetings, or work.</p>
              <p className="font-display text-terracotta mt-4 text-xl font-semibold">From ${studyRoom?.pricePerHour ?? 5}/hour</p>
              <Link to="/book?room=STUDY" className="btn-3d bg-espresso text-cream mt-5 inline-block rounded-full px-6 py-2.5 font-semibold">
                Book Now
              </Link>
            </div>
          </div>
          <div className="card-lift overflow-hidden rounded-2xl bg-white shadow-sm">
            <Img src="/photos/conference-room.jpg" alt="The Conference Room" className="h-52 w-full" />
            <div className="p-8">
              <h3 className="font-display text-espresso text-2xl font-bold">Book a Conference Room</h3>
              <p className="text-charcoal/70 mt-2">Perfect for meetings, presentations, and group work.</p>
              <p className="font-display text-terracotta mt-4 text-xl font-semibold">From ${confRoom?.pricePerHour ?? 20}/hour</p>
              <Link to="/book?room=CONFERENCE" className="btn-3d bg-espresso text-cream mt-5 inline-block rounded-full px-6 py-2.5 font-semibold">
                Book Now
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Shop — one tile per category; browsing happens inside /shop */}
      {shopCategoryTiles.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-10">
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-espresso text-2xl font-bold sm:text-3xl">Take Bean Avenue Home.</h2>
              <p className="text-charcoal/55 mt-1 text-sm">illy capsules, machines, beans & more — for pickup or preorder.</p>
            </div>
            <Link to="/shop" className="btn-3d bg-terracotta text-cream hover:bg-terracotta-dark shrink-0 rounded-full px-4 py-2 text-sm font-semibold">
              Full Shop →
            </Link>
          </div>
          <ScrollRow>
            {shopCategoryTiles.map((t) => (
              <ShopCategoryCard key={t.name} title={t.name} image={t.image} fromPrice={t.from} />
            ))}
          </ScrollRow>
        </section>
      )}

      {/* Why Bean Avenue */}
      <section className="mx-auto max-w-6xl px-4 py-16 text-center">
        <h2 className="font-display text-espresso text-3xl font-bold">Why Bean Avenue</h2>
        <div className="mt-8 grid gap-8 sm:grid-cols-3">
          {[
            ["📶", "Fast Wi-Fi", "Stream, sync, and ship without the spinner."],
            ["🔌", "Power at every seat", "No more hovering by the one outlet."],
            ["☕", "Bottomless coffee nearby", "The refill is never far away."],
          ].map(([icon, title, blurb]) => (
            <div key={title}>
              <p className="text-4xl">{icon}</p>
              <h3 className="text-espresso mt-3 font-semibold">{title}</h3>
              <p className="text-charcoal/70 mt-1 text-sm">{blurb}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Loyalty teaser */}
      <section className="bg-sage/15 py-14">
        <div className="mx-auto max-w-3xl px-4 text-center">
          {account ? (
            <>
              <h2 className="font-display text-espresso text-3xl font-bold">
                Hey {account.name} — you have {account.beanBalance} beans ☕
              </h2>
              <p className="text-charcoal/70 mt-3">Keep sipping to earn more, then trade your beans for free drinks, pastries, and study hours.</p>
              <Link to="/loyalty" className="btn-3d bg-terracotta text-cream mt-6 inline-block rounded-full px-8 py-3 font-semibold">
                View my rewards
              </Link>
            </>
          ) : (
            <>
              <h2 className="font-display text-espresso text-3xl font-bold">Every cup earns you beans.</h2>
              <p className="text-charcoal/70 mt-3">
                Earn 1 bean per $1 — on coffee <em>and</em> room bookings. Trade them for free drinks, pastries, and study hours.
              </p>
              <Link to="/loyalty" className="btn-3d bg-terracotta text-cream mt-6 inline-block rounded-full px-8 py-3 font-semibold">
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
            <h2 className="font-display text-espresso text-3xl font-bold">Find us</h2>
            <p className="text-charcoal/80 mt-3">Aley, Lebanon</p>
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
                  <tr key={h.day} className="border-oat border-b">
                    <td className="py-1.5 font-medium">{h.day}</td>
                    <td className="text-charcoal/70 py-1.5 text-right">
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
        <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="btn-3d bg-sage text-cream mt-4 inline-block rounded-full px-8 py-3 font-semibold">
          💬 WhatsApp us
        </a>
      </section>
    </div>
  );
}
