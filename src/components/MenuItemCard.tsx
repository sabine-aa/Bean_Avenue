import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { money } from "../lib/api";
import type { MenuItem } from "../types";
import { Img } from "./Img";

export function MenuItemCard({ item }: { item: MenuItem }) {
  const { add, remainingFor } = useCart();
  const toast = useToast();
  const hasOptions = item.options.length > 0;
  const remaining = remainingFor(item); // null = unlimited
  const lowStock = remaining != null && remaining <= 8; // show count for limited items

  return (
    <div className="card-lift flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm">
      <Link to={`/menu/${item.id}`} className="relative block">
        <Img
          src={item.photo}
          alt={item.name}
          fit={item.imageFit === "contain" ? "contain" : "cover"}
          position={`${item.focalX ?? 50}% ${item.focalY ?? 50}%`}
          className="bg-oat/30 aspect-[4/3] w-full"
        />
        {item.isBestSeller && (
          <span className="bg-terracotta text-cream absolute top-2 left-2 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase shadow-sm">
            ★ Best Seller
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/menu/${item.id}`} className="font-display text-espresso hover:text-terracotta text-base leading-tight font-semibold sm:text-lg">
            {item.name}
          </Link>
          <span className="text-terracotta font-semibold whitespace-nowrap">{hasOptions ? `From ${money(item.price)}` : money(item.price)}</span>
        </div>
        <p className="text-charcoal/40 mt-0.5 text-xs font-medium tracking-wide uppercase">{item.category}</p>
        <p className="text-charcoal/70 mt-1 line-clamp-2 flex-1 text-sm">{item.description}</p>
        {item.nutrition?.kcal != null && (
          <p className="text-sage-dark mb-1 text-xs font-semibold">
            {item.nutrition.kcal} kcal{item.nutrition.protein != null ? ` · ${item.nutrition.protein}g protein` : ""}
          </p>
        )}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-1">
            {item.tags.map((t) => (
              <span key={t} className="bg-sage/20 text-sage-dark rounded-full px-2 py-0.5 text-xs font-semibold">
                {t}
              </span>
            ))}
          </div>
          {!item.inStock || remaining === 0 ? (
            <span className="text-charcoal/50 text-sm font-medium">Sold out</span>
          ) : (
            <div className="flex items-center gap-2">
              {lowStock && <span className="text-xs font-semibold whitespace-nowrap text-amber-600">Only {remaining} left</span>}
              {hasOptions ? (
                <Link
                  to={`/menu/${item.id}`}
                  className="bg-oat text-espresso hover:bg-espresso hover:text-cream rounded-full px-4 py-1.5 text-sm font-semibold transition"
                >
                  View
                </Link>
              ) : (
                <button
                  onClick={() => {
                    add(item, 1, []);
                    toast(`${item.name} added to cart ☕`);
                  }}
                  className="btn-3d bg-espresso text-cream rounded-full px-4 py-1.5 text-sm font-semibold"
                >
                  Add to Cart
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
