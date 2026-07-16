import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MenuItemCard } from "../components/MenuItemCard";
import { ChevronRightIcon } from "../components/icons";
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

  // Mobile category bar: show a "scroll for more" hint until swiped to the end.
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const updateScrollHint = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    Promise.all([api.get<MenuItem[]>("/api/menu"), api.get<string[]>("/api/categories").catch(() => [] as string[])])
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

  // Categories in display order, with "All" appended at the very end. Used by
  // both the desktop sidebar and the mobile horizontal bar.
  const allCategories = useMemo(() => [...presentCategories, "All"], [presentCategories]);

  // Re-evaluate the mobile scroll hint when categories load or the window resizes.
  useEffect(() => {
    updateScrollHint();
    window.addEventListener("resize", updateScrollHint);
    return () => window.removeEventListener("resize", updateScrollHint);
  }, [allCategories]);

  const filtered = items
    .filter(
      (i) =>
        (active === "All" || i.category === active) &&
        (search === "" || i.name.toLowerCase().includes(search.toLowerCase()) || i.description.toLowerCase().includes(search.toLowerCase())),
    )
    .sort((a, b) => catIndex(a.category) - catIndex(b.category) || a.sortOrder - b.sortOrder);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 pb-24 sm:py-8">
      <h1 className="font-display text-espresso text-3xl font-bold sm:text-4xl">The Menu</h1>
      <p className="text-charcoal/70 mt-1 text-sm sm:text-base">Order for pickup — your cup will be waiting.</p>

      {/* Search — full width on mobile, compact on larger screens */}
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search the menu…"
        aria-label="Search the menu"
        className="border-oat mt-4 w-full rounded-full border bg-white px-4 py-2 text-sm sm:max-w-sm"
      />

      {/* Mobile / tablet: one horizontally swipeable category row, sticky on scroll */}
      <div className="bg-cream/95 sticky top-16 z-30 -mx-4 mt-3 px-4 py-2 backdrop-blur lg:hidden">
        <div className="relative">
          <div ref={scrollerRef} onScroll={updateScrollHint} className="no-scrollbar flex gap-2 overflow-x-auto scroll-smooth pr-8">
            {allCategories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition ${
                  active === c ? "bg-espresso text-cream shadow-md" : "bg-oat text-espresso hover:bg-espresso/15"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          {/* "Swipe for more" hint — fades out once scrolled to the end */}
          {canScrollRight && (
            <div className="from-cream via-cream/90 pointer-events-none absolute inset-y-0 right-0 flex items-center bg-gradient-to-l to-transparent pr-1 pl-8">
              <ChevronRightIcon className="text-espresso h-5 w-5 animate-pulse" />
            </div>
          )}
        </div>
      </div>

      {/* Body: desktop category sidebar on the left, products on the right */}
      <div className="mt-4 lg:mt-5 lg:flex lg:gap-8">
        <aside className="hidden lg:block lg:w-56 lg:shrink-0">
          <nav className="sticky top-20 flex flex-col gap-1">
            {allCategories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-xl px-4 py-2 text-left text-sm font-semibold transition ${
                  active === c ? "bg-espresso text-cream" : "text-espresso hover:bg-oat"
                }`}
              >
                {c}
              </button>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          {loading ? (
            <p className="text-charcoal/60 mt-12 text-center">Brewing the menu…</p>
          ) : filtered.length === 0 ? (
            <p className="text-charcoal/60 mt-12 text-center">Nothing matched — try another search?</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
              {filtered.map((item) => (
                <MenuItemCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </div>

      {count > 0 && (
        <Link
          to="/cart"
          className="btn-3d bg-espresso text-cream fixed bottom-4 left-1/2 z-40 flex w-[min(92vw,28rem)] -translate-x-1/2 items-center justify-between rounded-full px-6 py-3 font-semibold"
        >
          <span>
            View cart · {count} item{count > 1 ? "s" : ""}
          </span>
          <span>{money(subtotal)}</span>
        </Link>
      )}
    </div>
  );
}
