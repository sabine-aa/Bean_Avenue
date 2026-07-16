import { ReactNode, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { money } from "../lib/api";
import type { MenuItem } from "../types";
import { Img } from "./Img";

export type ShopStatus = "IN_STOCK" | "LOW" | "OUT" | "PREORDER" | "HIDDEN";
export type HomeShopProduct = {
  id: number;
  name: string;
  category: string;
  images: string[];
  price: number;
  quantity: number;
  allowPreorder: boolean;
  status: ShopStatus;
};

// Horizontal scroll row with desktop arrows (mobile = native swipe).
export function ScrollRow({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * 340, behavior: "smooth" });
  return (
    <div className="group/row relative">
      <div ref={ref} className="flex snap-x [scrollbar-width:none] gap-4 overflow-x-auto scroll-smooth pb-2 [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
      <button
        aria-label="Scroll left"
        onClick={() => scroll(-1)}
        className="text-espresso ring-oat hover:bg-espresso hover:text-cream absolute top-[38%] -left-4 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-xl font-bold shadow-md ring-1 transition lg:flex"
      >
        ‹
      </button>
      <button
        aria-label="Scroll right"
        onClick={() => scroll(1)}
        className="text-espresso ring-oat hover:bg-espresso hover:text-cream absolute top-[38%] -right-4 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-xl font-bold shadow-md ring-1 transition lg:flex"
      >
        ›
      </button>
    </div>
  );
}

// Compact café-menu card for the home carousel.
export function CompactMenuCard({ item }: { item: MenuItem }) {
  const { add } = useCart();
  const toast = useToast();
  const hasOptions = item.options.length > 0;
  return (
    <div className="card-lift flex w-52 shrink-0 snap-start flex-col overflow-hidden rounded-2xl bg-white shadow-sm sm:w-56">
      <Link to={`/menu/${item.id}`} className="relative block">
        <Img
          src={item.photo}
          alt={item.name}
          fit={item.imageFit === "contain" ? "contain" : "cover"}
          position={`${item.focalX ?? 50}% ${item.focalY ?? 50}%`}
          className="bg-oat/30 aspect-square w-full"
        />
        {item.isBestSeller && (
          <span className="bg-terracotta text-cream absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase shadow-sm">
            ★ Best
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-3">
        <Link to={`/menu/${item.id}`} className="font-display text-espresso hover:text-terracotta text-sm leading-tight font-semibold">
          {item.name}
        </Link>
        <p className="text-charcoal/40 mt-0.5 text-[10px] font-semibold tracking-wide uppercase">{item.category}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-terracotta font-semibold">{hasOptions ? `From ${money(item.price)}` : money(item.price)}</span>
          {!item.inStock ? (
            <span className="text-charcoal/50 text-xs font-medium">Sold out</span>
          ) : hasOptions ? (
            <Link to={`/menu/${item.id}`} className="bg-oat text-espresso hover:bg-espresso hover:text-cream rounded-full px-3 py-1 text-xs font-semibold">
              View
            </Link>
          ) : (
            <button
              onClick={() => {
                add(item, 1, []);
                toast(`${item.name} added ☕`);
              }}
              className="btn-3d bg-espresso text-cream rounded-full px-3 py-1 text-xs font-semibold"
            >
              Add
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Category showcase tile for the home carousel — shows the breadth of the
// shop (one tile per category) and sends the customer into /shop to browse.
export function ShopCategoryCard({ title, image, fromPrice }: { title: string; image: string; fromPrice: number }) {
  return (
    <Link
      to={`/shop?cat=${encodeURIComponent(title)}`}
      className="card-lift group flex w-44 shrink-0 snap-start flex-col overflow-hidden rounded-2xl bg-white shadow-sm sm:w-48"
    >
      <div className="relative">
        <Img src={image} alt={title} fit="contain" className="aspect-square w-full bg-[#efe7dc]" />
      </div>
      <div className="flex flex-1 flex-col p-3">
        <p className="text-espresso group-hover:text-terracotta line-clamp-2 text-sm leading-tight font-semibold transition">{title}</p>
        <p className="text-charcoal/50 mt-0.5 mb-2 text-xs">from {money(fromPrice)}</p>
        <span className="bg-oat text-espresso group-hover:bg-espresso group-hover:text-cream mt-auto flex w-full items-center justify-center rounded-full py-1.5 text-xs font-bold transition">
          Shop →
        </span>
      </div>
    </Link>
  );
}

const SHOP_CART_KEY = "beanavenue.shopCart";
type ShopCartLine = { productId: number; name: string; price: number; image: string; quantity: number };
function addToShopCart(p: HomeShopProduct) {
  let cart: ShopCartLine[] = [];
  try {
    cart = JSON.parse(localStorage.getItem(SHOP_CART_KEY) || "[]");
  } catch {
    cart = [];
  }
  const ex = cart.find((l) => l.productId === p.id);
  if (ex) ex.quantity += 1;
  else cart.push({ productId: p.id, name: p.name, price: p.price, image: p.images[0] ?? "", quantity: 1 });
  localStorage.setItem(SHOP_CART_KEY, JSON.stringify(cart));
}

// Compact retail-shop card for the home carousel.
export function CompactShopCard({ product }: { product: HomeShopProduct }) {
  const toast = useToast();
  const navigate = useNavigate();
  const preorder = product.status === "PREORDER" || (product.status === "OUT" && product.allowPreorder);
  const badge =
    product.status === "IN_STOCK"
      ? ["In stock", "bg-sage/20 text-sage-dark"]
      : product.status === "LOW"
        ? [`Only ${product.quantity} left`, "bg-amber-100 text-amber-700"]
        : preorder
          ? ["Preorder", "bg-[#5b3fd6]/15 text-[#5b3fd6]"]
          : ["Out", "bg-terracotta/15 text-terracotta-dark"];
  return (
    <div className="card-lift flex w-44 shrink-0 snap-start flex-col overflow-hidden rounded-2xl bg-white shadow-sm sm:w-48">
      <button onClick={() => navigate(`/shop/${product.id}`)} className="block">
        <Img src={product.images[0] ?? ""} alt={product.name} fit="contain" className="aspect-square w-full bg-[#efe7dc]" />
      </button>
      <div className="flex flex-1 flex-col p-3">
        <p className="text-espresso line-clamp-2 text-xs leading-tight font-semibold">{product.name}</p>
        <p className="text-charcoal/40 mt-0.5 text-[10px] font-semibold tracking-wide uppercase">{product.category}</p>
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-terracotta text-sm font-bold">{money(product.price)}</span>
          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${badge[1]}`}>{badge[0]}</span>
        </div>
        <button
          onClick={() =>
            preorder || product.status === "OUT"
              ? navigate(`/shop/${product.id}`)
              : (addToShopCart(product), toast(`${product.name.split(" - ")[0]} added — checkout in the shop 🛍`))
          }
          className="btn-3d bg-espresso text-cream mt-2 w-full rounded-full py-1.5 text-xs font-bold"
        >
          {preorder ? "Preorder" : product.status === "OUT" ? "View" : "Add to Cart"}
        </button>
      </div>
    </div>
  );
}
