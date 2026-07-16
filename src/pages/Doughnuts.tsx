import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Img } from "../components/Img";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { api, money } from "../lib/api";
import type { MenuItem } from "../types";

type DoughnutItem = MenuItem & { tracked: boolean; remaining: number | null; soldOut: boolean; madeToday: number | null };

export function Doughnuts() {
  const { add } = useCart();
  const toast = useToast();
  const [items, setItems] = useState<DoughnutItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<DoughnutItem[]>("/api/doughnuts")
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 pb-20">
      <Link to="/menu" className="text-terracotta text-sm font-semibold hover:underline">
        ← Back to Bean Avenue Menu
      </Link>

      <header className="mt-4 flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
        <Img src="/hanson-doughnuts-logo.jpg" alt="Hanson Doughnuts" fit="contain" className="h-24 w-24 shrink-0 rounded-full bg-black sm:h-28 sm:w-28" />
        <div>
          <span className="bg-espresso text-cream inline-block rounded-full px-3 py-1 text-xs font-bold tracking-wide uppercase">
            Hanson Doughnuts × Bean Avenue
          </span>
          <h1 className="font-display text-espresso mt-2 text-4xl font-bold sm:text-5xl">Hanson Doughnuts Menu</h1>
          <p className="text-charcoal/70 mt-2 max-w-2xl">Our doughnut selection changes regularly. Check back to discover what's available today.</p>
        </div>
      </header>

      {loading ? (
        <p className="text-charcoal/60 mt-12 text-center">Loading today's doughnuts…</p>
      ) : items.length === 0 ? (
        <div className="mt-12 rounded-2xl bg-white p-10 text-center shadow-sm">
          <Img src="/doughnut-placeholder.svg" alt="" fit="contain" className="mx-auto h-28 w-40 rounded-xl" />
          <p className="text-espresso mt-4 font-semibold">No doughnuts available right now.</p>
          <p className="text-charcoal/60 mt-1 text-sm">Check back soon for today's fresh selection.</p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((d) => {
            const soldOut = d.soldOut || !d.inStock;
            const lowLeft = d.tracked && !soldOut && d.remaining != null && d.remaining <= 5;
            return (
              <div key={d.id} className="card-lift flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm">
                <Link to={`/menu/${d.id}`} className="relative block">
                  <Img
                    src={d.photo}
                    alt={d.name}
                    fit={d.imageFit === "contain" ? "contain" : "cover"}
                    position={`${d.focalX ?? 50}% ${d.focalY ?? 50}%`}
                    className="bg-oat/30 aspect-[4/3] w-full"
                  />
                  {soldOut ? (
                    <span className="bg-terracotta-dark text-cream absolute top-2 left-2 rounded-full px-2.5 py-0.5 text-xs font-bold">Sold Out</span>
                  ) : lowLeft ? (
                    <span className="absolute top-2 left-2 rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-bold text-white">Only {d.remaining} left</span>
                  ) : null}
                </Link>
                <div className="flex flex-1 flex-col p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Link to={`/menu/${d.id}`} className="font-display text-espresso hover:text-terracotta text-lg font-semibold">
                      {d.name}
                    </Link>
                    <span className="text-terracotta font-semibold whitespace-nowrap">{money(d.price)}</span>
                  </div>
                  <p className="text-charcoal/70 mt-1 line-clamp-2 flex-1 text-sm">{d.description}</p>
                  <div className="mt-3 flex gap-2">
                    <Link
                      to={`/menu/${d.id}`}
                      className="border-oat text-espresso hover:bg-oat flex-1 rounded-full border px-3 py-2 text-center text-sm font-semibold transition"
                    >
                      View Details
                    </Link>
                    <button
                      disabled={soldOut}
                      onClick={() => {
                        add(d, 1, []);
                        toast(`${d.name} added to cart 🍩`);
                      }}
                      className="btn-3d bg-espresso text-cream disabled:bg-oat disabled:text-charcoal/40 flex-1 rounded-full px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed"
                    >
                      {soldOut ? "Sold Out" : "Add to Cart"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
