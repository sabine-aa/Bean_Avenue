import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Img } from "../components/Img";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { api, money } from "../lib/api";
import type { MenuItem } from "../types";

export function Doughnuts() {
  const { add } = useCart();
  const toast = useToast();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<MenuItem[]>("/api/doughnuts")
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 pb-20">
      <Link to="/menu" className="text-sm font-semibold text-terracotta hover:underline">
        ← Back to Bean Avenue Menu
      </Link>

      <header className="mt-4 flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
        <Img
          src="/hanson-doughnuts-logo.png"
          alt="Hanson Doughnuts"
          className="h-24 w-24 shrink-0 rounded-full bg-espresso sm:h-28 sm:w-28"
        />
        <div>
          <span className="inline-block rounded-full bg-espresso px-3 py-1 text-xs font-bold uppercase tracking-wide text-cream">
            Hanson Doughnuts × Bean Avenue
          </span>
          <h1 className="mt-2 font-display text-4xl font-bold text-espresso sm:text-5xl">
            Hanson Doughnuts Menu
          </h1>
          <p className="mt-2 max-w-2xl text-charcoal/70">
            Our doughnut selection changes regularly. Check back to discover what's available today.
          </p>
        </div>
      </header>

      {loading ? (
        <p className="mt-12 text-center text-charcoal/60">Loading today's doughnuts…</p>
      ) : items.length === 0 ? (
        <div className="mt-12 rounded-2xl bg-white p-10 text-center shadow-sm">
          <Img src="/doughnut-placeholder.svg" alt="" className="mx-auto h-28 w-40 rounded-xl" />
          <p className="mt-4 font-semibold text-espresso">No doughnuts available right now.</p>
          <p className="mt-1 text-sm text-charcoal/60">Check back soon for today's fresh selection.</p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((d) => {
            const soldOut = !d.inStock;
            return (
              <div key={d.id} className="card-lift flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm">
                <Link to={`/menu/${d.id}`} className="relative block">
                  <Img src={d.photo} alt={d.name} className="h-44 w-full" />
                  {soldOut && (
                    <span className="absolute left-2 top-2 rounded-full bg-terracotta-dark px-2.5 py-0.5 text-xs font-bold text-cream">
                      Sold Out
                    </span>
                  )}
                </Link>
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      to={`/menu/${d.id}`}
                      className="font-display text-lg font-semibold text-espresso hover:text-terracotta"
                    >
                      {d.name}
                    </Link>
                    <span className="whitespace-nowrap font-semibold text-terracotta">{money(d.price)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 flex-1 text-sm text-charcoal/70">{d.description}</p>
                  <div className="mt-3 flex gap-2">
                    <Link
                      to={`/menu/${d.id}`}
                      className="flex-1 rounded-full border border-oat px-3 py-2 text-center text-sm font-semibold text-espresso transition hover:bg-oat"
                    >
                      View Details
                    </Link>
                    <button
                      disabled={soldOut}
                      onClick={() => {
                        add(d, 1, []);
                        toast(`${d.name} added to cart 🍩`);
                      }}
                      className="btn-3d flex-1 rounded-full bg-espresso px-3 py-2 text-sm font-semibold text-cream disabled:cursor-not-allowed disabled:bg-oat disabled:text-charcoal/40"
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
