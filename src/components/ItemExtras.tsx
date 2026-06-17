import { money } from "../lib/api";

interface Extra {
  name: string;
  price: number;
  quantity: number;
}
interface Option {
  group: string;
  choice: string;
}

/** Renders an order/cart line's options, add-ons, and special instructions. */
export function ItemExtras({
  options,
  addons,
  instructions,
  className = "",
}: {
  options?: Option[];
  addons?: Extra[];
  instructions?: string | null;
  className?: string;
}) {
  const hasOptions = options && options.length > 0;
  const hasAddons = addons && addons.length > 0;
  if (!hasOptions && !hasAddons && !instructions) return null;

  return (
    <div className={`mt-0.5 space-y-0.5 text-xs text-charcoal/60 ${className}`}>
      {hasOptions && <p>{options!.map((o) => `${o.group}: ${o.choice}`).join(" · ")}</p>}
      {hasAddons &&
        addons!.map((a, i) => (
          <p key={i}>
            + {a.quantity > 1 ? `${a.quantity}× ` : ""}
            {a.name}
            {a.price > 0 && (
              <span className="text-charcoal/45"> (+{money(a.price * a.quantity)})</span>
            )}
          </p>
        ))}
      {instructions && <p className="italic text-charcoal/70">“{instructions}”</p>}
    </div>
  );
}
