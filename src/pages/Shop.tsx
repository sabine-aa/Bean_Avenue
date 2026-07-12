import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Img } from "../components/Img";
import { PhoneInput } from "../components/PhoneInput";
import { useToast } from "../context/ToastContext";
import { customerApi, money } from "../lib/api";

type Status = "IN_STOCK" | "LOW" | "OUT" | "PREORDER" | "HIDDEN";
type ShopProduct = {
  id: number; name: string; category: string; brand: string | null; description: string; images: string[];
  price: number; quantity: number; minQty: number; allowPreorder: boolean; preorderEta: string | null;
  featured: boolean; status: Status;
};
type ShopCategory = { id: number; name: string };
type CartLine = { productId: number; name: string; price: number; image: string; quantity: number };

const CART_KEY = "beanavenue.shopCart";
const loadCart = (): CartLine[] => { try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); } catch { return []; } };

export function Shop() {
  const toast = useToast();
  const navigate = useNavigate();
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [cats, setCats] = useState<ShopCategory[]>([]);
  const [active, setActive] = useState("All Coffee");
  const [detail, setDetail] = useState<ShopProduct | null>(null);
  const [cart, setCart] = useState<CartLine[]>(loadCart);
  const [showCart, setShowCart] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    customerApi.get<{ products: ShopProduct[]; categories: ShopCategory[] }>("/api/shop")
      .then((r) => { setProducts(r.products); setCats(r.categories); })
      .catch(() => {});
  }, []);
  useEffect(() => { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }, [cart]);

  const shown = useMemo(() => (active === "All Coffee" ? products : products.filter((p) => p.category === active)), [products, active]);
  const cartCount = cart.reduce((s, l) => s + l.quantity, 0);
  const cartTotal = Math.round(cart.reduce((s, l) => s + l.price * l.quantity, 0) * 100) / 100;

  function addToCart(p: ShopProduct) {
    if (p.status === "OUT") return;
    setCart((c) => {
      const ex = c.find((l) => l.productId === p.id);
      if (ex) return c.map((l) => (l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l));
      return [...c, { productId: p.id, name: p.name, price: p.price, image: p.images[0] ?? "", quantity: 1 }];
    });
    toast(`Added ${p.name.split(" - ")[0]} to cart.`);
  }
  const setQty = (id: number, delta: number) => setCart((c) => c.flatMap((l) => (l.productId === id ? (l.quantity + delta <= 0 ? [] : [{ ...l, quantity: l.quantity + delta }]) : [l])));

  async function placeOrder() {
    if (placing) return;
    if (!name.trim()) return toast("Please enter your name.", "error");
    if (!phone.trim()) return toast("Please enter your phone number.", "error");
    setPlacing(true);
    try {
      const r = await customerApi.post<{ number: string }>("/api/shop/order", {
        customerName: name.trim(), phone: phone.trim(), items: cart.map((l) => ({ productId: l.productId, quantity: l.quantity })),
      });
      setCart([]); setCheckout(false); setShowCart(false);
      navigate(`/order-success/${r.number}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't place your order.", "error");
    } finally {
      setPlacing(false);
    }
  }

  const tabs = ["All Coffee", ...cats.map((c) => c.name)];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="text-center">
        <h1 className="font-display text-4xl font-bold text-espresso">Bean Avenue Shop</h1>
        <p className="mt-2 text-charcoal/60">Take illy home — capsules, beans, ground coffee & more. Order online for pickup.</p>
      </div>

      {/* Category nav (illy-style) */}
      <div className="sticky top-16 z-20 -mx-4 mt-6 overflow-x-auto border-b border-oat bg-cream/95 px-4 py-3 backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-6 whitespace-nowrap">
          {tabs.map((t) => (
            <button key={t} onClick={() => setActive(t)} className={`text-sm font-semibold transition ${active === t ? "text-espresso underline decoration-terracotta decoration-2 underline-offset-8" : "text-charcoal/55 hover:text-espresso"}`}>{t}</button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((p) => (
          <div key={p.id} className="group flex flex-col rounded-2xl bg-white p-3 shadow-sm transition hover:shadow-md">
            <button onClick={() => setDetail(p)} className="relative">
              <Img src={p.images[0] ?? ""} alt={p.name} fit="contain" className="aspect-square w-full rounded-xl bg-[#efe7dc]" />
              {p.featured && <span className="absolute left-2 top-2 rounded-full bg-espresso px-2 py-0.5 text-[10px] font-bold text-cream">BEST SELLER</span>}
            </button>
            <div className="mt-2 flex flex-1 flex-col">
              <button onClick={() => setDetail(p)} className="text-left text-sm font-semibold leading-tight text-espresso hover:text-terracotta">{p.name}</button>
              <p className="mt-0.5 text-xs text-charcoal/45">{p.description.split(" · ").slice(1, 2).join("")}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="font-bold text-terracotta">{money(p.price)}</span>
                <StatusBadge status={p.status} qty={p.quantity} />
              </div>
              <button
                onClick={() => addToCart(p)}
                disabled={p.status === "OUT"}
                className="btn-3d mt-2 w-full rounded-full bg-espresso py-2 text-xs font-bold text-cream disabled:cursor-not-allowed disabled:opacity-40"
              >
                {p.status === "PREORDER" ? "Preorder" : p.status === "OUT" ? "Out of stock" : "Add to Cart"}
              </button>
            </div>
          </div>
        ))}
        {shown.length === 0 && <p className="col-span-full py-16 text-center text-charcoal/50">No products in this category yet.</p>}
      </div>

      {/* Floating cart button */}
      {cartCount > 0 && (
        <button onClick={() => setShowCart(true)} className="btn-3d fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-terracotta px-5 py-3 font-bold text-cream shadow-lg">
          🛒 {cartCount} · {money(cartTotal)}
        </button>
      )}

      {/* Product detail */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDetail(null)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end"><button onClick={() => setDetail(null)} className="text-charcoal/40 hover:text-charcoal">✕</button></div>
            <Img src={detail.images[0] ?? ""} alt={detail.name} fit="contain" className="mx-auto aspect-square w-64 rounded-xl bg-[#efe7dc]" />
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-charcoal/40">{detail.brand} · {detail.category}</p>
            <h2 className="font-display text-2xl font-bold text-espresso">{detail.name}</h2>
            <p className="mt-2 text-sm text-charcoal/70">{detail.description}</p>
            <div className="mt-3 flex items-center gap-3">
              <span className="text-2xl font-bold text-terracotta">{money(detail.price)}</span>
              <StatusBadge status={detail.status} qty={detail.quantity} />
            </div>
            {detail.status === "PREORDER" && detail.preorderEta && <p className="mt-1 text-sm text-[#5b3fd6]">Available for preorder · est. {detail.preorderEta}</p>}
            <button onClick={() => { addToCart(detail); setDetail(null); }} disabled={detail.status === "OUT"} className="btn-3d mt-4 w-full rounded-full bg-espresso py-3 font-bold text-cream disabled:opacity-40">
              {detail.status === "PREORDER" ? "Preorder" : detail.status === "OUT" ? "Out of stock" : "Add to Cart"}
            </button>
          </div>
        </div>
      )}

      {/* Cart drawer */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setShowCart(false)}>
          <div className="flex h-full w-full max-w-sm flex-col bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-oat px-4 py-3">
              <h2 className="font-display text-lg font-bold text-espresso">Your cart</h2>
              <button onClick={() => setShowCart(false)} className="text-charcoal/40 hover:text-charcoal">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {cart.length === 0 ? <p className="py-12 text-center text-charcoal/40">Your cart is empty.</p> : cart.map((l) => (
                <div key={l.productId} className="flex items-center gap-3 border-b border-oat/60 py-2">
                  <Img src={l.image} alt={l.name} fit="contain" className="h-14 w-14 rounded-lg bg-[#efe7dc]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-espresso">{l.name}</p>
                    <p className="text-xs text-terracotta">{money(l.price)}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <button onClick={() => setQty(l.productId, -1)} className="h-6 w-6 rounded-full bg-oat font-bold">–</button>
                      <span className="w-5 text-center text-sm font-semibold">{l.quantity}</span>
                      <button onClick={() => setQty(l.productId, 1)} className="h-6 w-6 rounded-full bg-oat font-bold">+</button>
                    </div>
                  </div>
                  <span className="text-sm font-bold">{money(l.price * l.quantity)}</span>
                </div>
              ))}
            </div>
            {cart.length > 0 && (
              <div className="border-t border-oat p-4">
                {!checkout ? (
                  <>
                    <div className="mb-3 flex items-center justify-between text-lg font-bold text-espresso"><span>Total</span><span className="text-terracotta">{money(cartTotal)}</span></div>
                    <button onClick={() => setCheckout(true)} className="btn-3d w-full rounded-full bg-terracotta py-3 font-semibold text-cream">Checkout · pickup</button>
                  </>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-espresso">Pickup order · pay at the counter</p>
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full rounded-xl border border-oat px-3 py-2 text-sm" />
                    <PhoneInput value={phone} onChange={setPhone} />
                    <button onClick={placeOrder} disabled={placing} className="btn-3d w-full rounded-full bg-terracotta py-3 font-semibold text-cream disabled:opacity-60">
                      {placing ? "Placing…" : `Place pickup order · ${money(cartTotal)}`}
                    </button>
                    <button onClick={() => setCheckout(false)} className="w-full rounded-full py-2 text-sm font-semibold text-charcoal/50">Back</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, qty }: { status: Status; qty: number }) {
  if (status === "IN_STOCK") return <span className="rounded-full bg-sage/20 px-2 py-0.5 text-[10px] font-semibold text-sage-dark">In stock</span>;
  if (status === "LOW") return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Only {qty} left</span>;
  if (status === "PREORDER") return <span className="rounded-full bg-[#5b3fd6]/15 px-2 py-0.5 text-[10px] font-semibold text-[#5b3fd6]">Preorder</span>;
  return <span className="rounded-full bg-terracotta/15 px-2 py-0.5 text-[10px] font-semibold text-terracotta-dark">Out</span>;
}
