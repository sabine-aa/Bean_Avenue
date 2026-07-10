import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Img } from "../components/Img";
import { MenuItemCard } from "../components/MenuItemCard";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { api, money, resolveApiUrl } from "../lib/api";
import type { AddonGroup, MenuItem, SelectedAddon, SelectedOption } from "../types";

export function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { add } = useCart();
  const toast = useToast();

  const [item, setItem] = useState<MenuItem | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [addonGroups, setAddonGroups] = useState<AddonGroup[]>([]);
  const [selected, setSelected] = useState<Record<number, number>>({}); // addonId -> quantity
  const [instructions, setInstructions] = useState("");
  const [zoomed, setZoomed] = useState(false); // full-size image lightbox

  // Close the lightbox on Escape.
  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setZoomed(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomed]);

  useEffect(() => {
    setItem(null);
    setQuantity(1);
    setChoices({});
    setAddonGroups([]);
    setSelected({});
    setInstructions("");
    setNotFound(false);
    api
      .get<MenuItem>(`/api/menu/${id}`)
      .then((data) => {
        setItem(data);
        // Preselect the first (usually free) choice in each group
        const initial: Record<string, string> = {};
        for (const g of data.options) initial[g.name] = g.choices[0]?.label ?? "";
        setChoices(initial);
      })
      .catch(() => setNotFound(true));
    api.get<AddonGroup[]>(`/api/addons/for/${id}`).then(setAddonGroups).catch(() => {});
  }, [id]);

  const countSelected = (group: AddonGroup) =>
    group.addons.filter((a) => (selected[a.id] ?? 0) > 0).length;

  // Add-on selection helpers.
  function setSingle(group: AddonGroup, addonId: number) {
    setSelected((prev) => {
      const next = { ...prev };
      const wasOn = (prev[addonId] ?? 0) > 0;
      for (const a of group.addons) delete next[a.id]; // clear the group
      if (!wasOn) next[addonId] = 1; // toggle on (clicking the active one clears it)
      return next;
    });
  }
  function toggleMulti(group: AddonGroup, addonId: number) {
    const turningOn = (selected[addonId] ?? 0) === 0;
    if (turningOn && group.maxSelect > 0 && countSelected(group) >= group.maxSelect) {
      toast(`You can pick up to ${group.maxSelect} from ${group.name}.`, "error");
      return;
    }
    setSelected((prev) => {
      const next = { ...prev };
      if ((next[addonId] ?? 0) > 0) delete next[addonId];
      else next[addonId] = 1;
      return next;
    });
  }
  function setQty(group: AddonGroup, addonId: number, max: number, qty: number) {
    const turningOn = (selected[addonId] ?? 0) === 0 && qty > 0;
    if (turningOn && group.maxSelect > 0 && countSelected(group) >= group.maxSelect) {
      toast(`You can pick up to ${group.maxSelect} from ${group.name}.`, "error");
      return;
    }
    setSelected((prev) => {
      const next = { ...prev };
      const q = Math.max(0, Math.min(max, qty));
      if (q === 0) delete next[addonId];
      else next[addonId] = q;
      return next;
    });
  }

  // Groups whose minimum isn't met yet — block Add to Cart until satisfied.
  const unmetGroups = addonGroups.filter(
    (g) => g.minSelect > 0 && countSelected(g) < g.minSelect
  );

  const selectedAddons: SelectedAddon[] = addonGroups.flatMap((g) =>
    g.addons
      .filter((a) => (selected[a.id] ?? 0) > 0)
      .map((a) => ({ addonId: a.id, name: a.name, price: a.price, quantity: selected[a.id] }))
  );
  const addonTotal = selectedAddons.reduce((s, a) => s + a.price * a.quantity, 0);

  const selectedOptions: SelectedOption[] = useMemo(() => {
    if (!item) return [];
    return item.options.map((g) => {
      const choice = g.choices.find((c) => c.label === choices[g.name]) ?? g.choices[0];
      return { group: g.name, choice: choice.label, priceDelta: choice.priceDelta };
    });
  }, [item, choices]);

  if (notFound) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="text-charcoal/70">That item seems to have wandered off the menu.</p>
        <Link to="/menu" className="mt-4 inline-block font-semibold text-terracotta hover:underline">
          ← Back to the menu
        </Link>
      </div>
    );
  }
  if (!item) {
    return <p className="py-20 text-center text-charcoal/60">Pouring…</p>;
  }

  const unitPrice =
    item.price + selectedOptions.reduce((s, o) => s + o.priceDelta, 0) + addonTotal;

  const isDoughnut = item.category === "Hanson Doughnuts";
  const backTo = isDoughnut ? "/doughnuts" : "/menu";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link to={backTo} className="text-sm font-semibold text-terracotta hover:underline">
        ← {isDoughnut ? "Hanson Doughnuts" : "Menu"}
      </Link>
      <div className="mt-4 grid gap-10 md:grid-cols-2">
        <div className="md:sticky md:top-24 md:self-start">
          <button
            type="button"
            onClick={() => item.photo && setZoomed(true)}
            className="group relative block w-full cursor-zoom-in overflow-hidden rounded-2xl"
            aria-label={`View larger image of ${item.name}`}
          >
            <Img
              src={item.photo}
              alt={item.name}
              fit={item.imageFit === "contain" ? "contain" : "cover"}
              position={`${item.focalX ?? 50}% ${item.focalY ?? 50}%`}
              className={`h-96 w-full rounded-2xl bg-oat/30 md:h-[32rem] ${
                item.imageFit === "contain" ? "p-2" : ""
              }`}
            />
            {item.photo && (
              <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-espresso/80 px-3 py-1 text-xs font-semibold text-cream opacity-0 transition group-hover:opacity-100">
                Click to enlarge
              </span>
            )}
          </button>
        </div>
        <div>
          <div className="flex items-start justify-between gap-4">
            <h1 className="font-display text-3xl font-bold text-espresso">{item.name}</h1>
            <span className="font-display text-2xl font-semibold text-terracotta">
              {money(unitPrice)}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {item.isBestSeller && (
              <span className="rounded-full bg-terracotta px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-cream">
                ★ Best Seller
              </span>
            )}
            {item.tags.map((t) => (
              <span key={t} className="rounded-full bg-sage/20 px-2 py-0.5 text-xs font-semibold text-sage-dark">
                {t}
              </span>
            ))}
          </div>
          <p className="mt-4 text-charcoal/80">{item.description}</p>

          {item.ingredients && (
            <div className="mt-4 rounded-xl bg-oat/40 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-charcoal/50">
                Ingredients &amp; allergens
              </p>
              <p className="mt-1 text-sm text-charcoal/80">{item.ingredients}</p>
            </div>
          )}

          {item.nutrition && Object.values(item.nutrition).some((v) => v != null) && (
            <div className="mt-4 rounded-xl bg-sage/10 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-charcoal/50">Nutrition</p>
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {(
                  [
                    ["Calories", item.nutrition.kcal != null ? String(item.nutrition.kcal) : null],
                    ["Protein", item.nutrition.protein != null ? `${item.nutrition.protein}g` : null],
                    ["Carbs", item.nutrition.carbs != null ? `${item.nutrition.carbs}g` : null],
                    ["Fat", item.nutrition.fat != null ? `${item.nutrition.fat}g` : null],
                    ["Fibers", item.nutrition.fibers != null ? `${item.nutrition.fibers}g` : null],
                  ] as [string, string | null][]
                )
                  .filter(([, v]) => v != null)
                  .map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-white px-2 py-2 text-center shadow-sm">
                      <span className="block font-display text-base font-bold text-espresso">{value}</span>
                      <span className="block text-[10px] font-semibold uppercase tracking-wide text-charcoal/50">{label}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {item.options.map((group) => (
            <fieldset key={group.name} className="mt-6">
              <legend className="font-semibold text-espresso">{group.name}</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {group.choices.map((c) => (
                  <label
                    key={c.label}
                    className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                      choices[group.name] === c.label
                        ? "border-espresso bg-espresso text-cream"
                        : "border-oat bg-white text-charcoal hover:border-espresso"
                    }`}
                  >
                    <input
                      type="radio"
                      name={group.name}
                      value={c.label}
                      checked={choices[group.name] === c.label}
                      onChange={() => setChoices((prev) => ({ ...prev, [group.name]: c.label }))}
                      className="sr-only"
                    />
                    {c.label}
                    {c.priceDelta > 0 && ` +${money(c.priceDelta)}`}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}

          {/* Add-ons */}
          {addonGroups.map((group) => (
            <fieldset key={group.id} className="mt-6">
              <legend className="font-semibold text-espresso">
                {group.name}
                <span className="ml-2 text-xs font-normal text-charcoal/50">
                  {group.minSelect > 0
                    ? `Pick at least ${group.minSelect}`
                    : group.selection === "SINGLE"
                      ? "Pick one (optional)"
                      : "Optional"}
                  {group.maxSelect > 0 && group.selection !== "SINGLE" && ` · up to ${group.maxSelect}`}
                </span>
              </legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {group.addons.map((a) => {
                  const qty = selected[a.id] ?? 0;
                  const active = qty > 0;
                  const isStepper = group.selection !== "SINGLE" && a.maxQuantity > 1;
                  if (isStepper) {
                    return (
                      <div
                        key={a.id}
                        className={`flex items-center gap-3 rounded-full border px-3 py-1.5 text-sm transition ${
                          active ? "border-espresso bg-espresso/5" : "border-oat bg-white"
                        }`}
                      >
                        <span className="font-medium text-charcoal">
                          {a.name} {a.price > 0 && <span className="text-charcoal/60">+{money(a.price)}</span>}
                        </span>
                        <div className="flex items-center rounded-full border border-oat">
                          <button
                            type="button"
                            onClick={() => setQty(group, a.id, a.maxQuantity, qty - 1)}
                            className="px-2 font-bold text-espresso"
                            aria-label={`Less ${a.name}`}
                          >
                            −
                          </button>
                          <span className="w-5 text-center font-semibold">{qty}</span>
                          <button
                            type="button"
                            onClick={() => setQty(group, a.id, a.maxQuantity, qty + 1)}
                            className="px-2 font-bold text-espresso"
                            aria-label={`More ${a.name}`}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <button
                      type="button"
                      key={a.id}
                      onClick={() =>
                        group.selection === "SINGLE" ? setSingle(group, a.id) : toggleMulti(group, a.id)
                      }
                      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                        active
                          ? "border-espresso bg-espresso text-cream"
                          : "border-oat bg-white text-charcoal hover:border-espresso"
                      }`}
                    >
                      {a.name}
                      {a.price > 0 && ` +${money(a.price)}`}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}

          {/* Special instructions */}
          <div className="mt-6">
            <label className="font-semibold text-espresso" htmlFor="notes">
              Special instructions <span className="text-xs font-normal text-charcoal/50">(optional)</span>
            </label>
            <textarea
              id="notes"
              rows={2}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. less sweet, no foam, extra hot, do not mix"
              className="mt-1 w-full rounded-xl border border-oat px-4 py-2.5"
            />
          </div>

          <div className="mt-8 flex items-center gap-4">
            <div className="flex items-center rounded-full border border-oat bg-white">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="px-4 py-2 text-lg font-bold text-espresso"
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span className="w-8 text-center font-semibold" aria-live="polite">{quantity}</span>
              <button
                onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                className="px-4 py-2 text-lg font-bold text-espresso"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
            <button
              disabled={!item.inStock || unmetGroups.length > 0}
              onClick={() => {
                add(item, quantity, selectedOptions, selectedAddons, instructions);
                toast(`${item.name} added to cart ☕`);
                navigate(backTo);
              }}
              className="btn-3d flex-1 rounded-full bg-espresso px-6 py-3 font-semibold text-cream disabled:cursor-not-allowed disabled:opacity-50"
            >
              {!item.inStock
                ? "Sold out"
                : unmetGroups.length > 0
                  ? `Choose your ${unmetGroups[0].name}`
                  : `Add to Cart · ${money(unitPrice * quantity)}`}
            </button>
          </div>
        </div>
      </div>

      {item.suggestions && item.suggestions.length > 0 && (
        <section className="mt-16">
          <h2 className="font-display text-2xl font-bold text-espresso">You might also like</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {item.suggestions.map((s) => (
              <MenuItemCard key={s.id} item={s} />
            ))}
          </div>
        </section>
      )}

      {/* Full-size image lightbox */}
      {zoomed && item.photo && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${item.name} — full size`}
          onClick={() => setZoomed(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/80 p-4 backdrop-blur-sm"
        >
          <button
            type="button"
            onClick={() => setZoomed(false)}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-cream/90 text-2xl font-bold text-espresso hover:bg-cream"
          >
            ×
          </button>
          <img
            src={resolveApiUrl(item.photo)}
            alt={item.name}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-full cursor-zoom-out rounded-2xl object-contain shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
