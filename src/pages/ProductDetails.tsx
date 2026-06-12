import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Img } from "../components/Img";
import { MenuItemCard } from "../components/MenuItemCard";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { api, money } from "../lib/api";
import type { MenuItem, SelectedOption } from "../types";

export function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { add } = useCart();
  const toast = useToast();

  const [item, setItem] = useState<MenuItem | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [choices, setChoices] = useState<Record<string, string>>({});

  useEffect(() => {
    setItem(null);
    setQuantity(1);
    setChoices({});
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
  }, [id]);

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

  const unitPrice = item.price + selectedOptions.reduce((s, o) => s + o.priceDelta, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link to="/menu" className="text-sm font-semibold text-terracotta hover:underline">
        ← Menu
      </Link>
      <div className="mt-4 grid gap-10 md:grid-cols-2">
        <Img src={item.photo} alt={item.name} className="h-80 w-full rounded-2xl md:h-[26rem]" />
        <div>
          <div className="flex items-start justify-between gap-4">
            <h1 className="font-display text-3xl font-bold text-espresso">{item.name}</h1>
            <span className="font-display text-2xl font-semibold text-terracotta">
              {money(unitPrice)}
            </span>
          </div>
          <div className="mt-2 flex gap-1">
            {item.tags.map((t) => (
              <span key={t} className="rounded-full bg-sage/20 px-2 py-0.5 text-xs font-semibold text-sage-dark">
                {t}
              </span>
            ))}
          </div>
          <p className="mt-4 text-charcoal/80">{item.description}</p>

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
              disabled={!item.inStock}
              onClick={() => {
                add(item, quantity, selectedOptions);
                toast(`${item.name} added to cart ☕`);
                navigate("/menu");
              }}
              className="btn-3d flex-1 rounded-full bg-espresso px-6 py-3 font-semibold text-cream disabled:cursor-not-allowed disabled:opacity-50"
            >
              {item.inStock ? `Add to Cart · ${money(unitPrice * quantity)}` : "Sold out"}
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
    </div>
  );
}
