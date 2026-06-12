import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MenuItemCard } from "../components/MenuItemCard";
import { useCart } from "../context/CartContext";
import { api, money } from "../lib/api";
import type { MenuItem } from "../types";

export function Menu() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const { count, subtotal } = useCart();

  useEffect(() => {
    api
      .get<MenuItem[]>("/api/menu")
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(items.map((i) => i.category)))],
    [items]
  );

  const filtered = items.filter(
    (i) =>
      (category === "All" || i.category === category) &&
      (search === "" ||
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        i.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 pb-24">
      <h1 className="font-display text-4xl font-bold text-espresso">The Menu</h1>
      <p className="mt-2 text-charcoal/70">Order for pickup — your cup will be waiting.</p>

      <div className="sticky top-[57px] z-30 -mx-4 mt-6 bg-cream/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                category === c ? "bg-espresso text-cream" : "bg-oat text-espresso hover:bg-espresso/15"
              }`}
            >
              {c}
            </button>
          ))}
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search the menu…"
            aria-label="Search the menu"
            className="ml-auto w-full rounded-full border border-oat bg-white px-4 py-1.5 text-sm sm:w-56"
          />
        </div>
      </div>

      {loading ? (
        <p className="mt-12 text-center text-charcoal/60">Brewing the menu…</p>
      ) : filtered.length === 0 ? (
        <p className="mt-12 text-center text-charcoal/60">
          Nothing matched — try another search?
        </p>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <MenuItemCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {count > 0 && (
        <Link
          to="/cart"
          className="btn-3d fixed bottom-4 left-1/2 z-40 flex w-[min(92vw,28rem)] -translate-x-1/2 items-center justify-between rounded-full bg-espresso px-6 py-3 font-semibold text-cream"
        >
          <span>View cart · {count} item{count > 1 ? "s" : ""}</span>
          <span>{money(subtotal)}</span>
        </Link>
      )}
    </div>
  );
}
