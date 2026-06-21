import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { money } from "../lib/api";
import type { MenuItem } from "../types";
import { Img } from "./Img";

export function MenuItemCard({ item }: { item: MenuItem }) {
  const { add } = useCart();
  const toast = useToast();
  const hasOptions = item.options.length > 0;

  return (
    <div className="card-lift flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm">
      <Link to={`/menu/${item.id}`} className="block">
        <Img
          src={item.photo}
          alt={item.name}
          fit={item.imageFit === "contain" ? "contain" : "cover"}
          position={`${item.focalX ?? 50}% ${item.focalY ?? 50}%`}
          className="aspect-[4/3] w-full bg-oat/30"
        />
      </Link>
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/menu/${item.id}`} className="font-display text-base font-semibold leading-tight text-espresso hover:text-terracotta sm:text-lg">
            {item.name}
          </Link>
          <span className="whitespace-nowrap font-semibold text-terracotta">{money(item.price)}</span>
        </div>
        <p className="mt-1 line-clamp-2 flex-1 text-sm text-charcoal/70">{item.description}</p>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-1">
            {item.tags.map((t) => (
              <span key={t} className="rounded-full bg-sage/20 px-2 py-0.5 text-xs font-semibold text-sage-dark">
                {t}
              </span>
            ))}
          </div>
          {!item.inStock ? (
            <span className="text-sm font-medium text-charcoal/50">Sold out</span>
          ) : hasOptions ? (
            <Link
              to={`/menu/${item.id}`}
              className="rounded-full bg-oat px-4 py-1.5 text-sm font-semibold text-espresso transition hover:bg-espresso hover:text-cream"
            >
              View
            </Link>
          ) : (
            <button
              onClick={() => {
                add(item, 1, []);
                toast(`${item.name} added to cart ☕`);
              }}
              className="btn-3d rounded-full bg-espresso px-4 py-1.5 text-sm font-semibold text-cream"
            >
              Add to Cart
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
