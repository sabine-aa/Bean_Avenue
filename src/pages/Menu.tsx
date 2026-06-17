import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MenuItemCard } from "../components/MenuItemCard";
import { useCart } from "../context/CartContext";
import { api, money } from "../lib/api";
import type { MenuItem } from "../types";

export function Menu() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [category, setCategory] = useState<string | null>(null); // null until first load
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const { count, subtotal } = useCart();

  useEffect(() => {
    Promise.all([
      api.get<MenuItem[]>("/api/menu"),
      api.get<string[]>("/api/categories").catch(() => [] as string[]),
    ])
      .then(([its, cats]) => {
        setItems(its);
        setOrder(cats);
      })
      .finally(() => setLoading(false));
  }, []);

  const catIndex = (c: string) => {
    const i = order.indexOf(c);
    return i === -1 ? 999 : i;
  };

  // Categories that actually have items, in the manager's display order.
  const presentCategories = useMemo(() => {
    const present = Array.from(new Set(items.map((i) => i.category)));
    return present.sort((a, b) => catIndex(a) - catIndex(b) || a.localeCompare(b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, order]);

  // Default to the first category (Espresso Based) — not "All".
  useEffect(() => {
    if (category === null && presentCategories.length) setCategory(presentCategories[0]);
  }, [presentCategories, category]);

  const active = category ?? presentCategories[0] ?? "All";

  const filtered = items
    .filter(
      (i) =>
        (active === "All" || i.category === active) &&
        (search === "" ||
          i.name.toLowerCase().includes(search.toLowerCase()) ||
          i.description.toLowerCase().includes(search.toLowerCase()))
    )
    .sort((a, b) => catIndex(a.category) - catIndex(b.category) || a.sortOrder - b.sortOrder);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 pb-24">
      <h1 className="font-display text-4xl font-bold text-espresso">The Menu</h1>
      <p className="mt-2 text-charcoal/70">Order for pickup — your cup will be waiting.</p>

      <div className="sticky top-[57px] z-30 -mx-4 mt-6 bg-cream/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          {presentCategories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                active === c ? "bg-espresso text-cream" : "bg-oat text-espresso hover:bg-espresso/15"
              }`}
            >
              {c}
            </button>
          ))}
          {/* "All" stays available but at the end, and isn't selected on open */}
          <button
            onClick={() => setCategory("All")}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              active === "All" ? "bg-espresso text-cream" : "bg-oat text-espresso hover:bg-espresso/15"
            }`}
          >
            All
          </button>
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
        <p className="mt-12 text-center text-charcoal/60">Nothing matched — try another search?</p>
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
