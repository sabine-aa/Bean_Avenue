import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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

const MACHINE_CATS = ["Iperespresso Capsule Machines", "illy Easy Compatible Capsule Machines", "ESE Pod Machines", "Milk Frothers", "Coffee Makers"];
const ALL_COFFEE = "All Coffee";
const ALL_MACHINES = "All Machines & Makers";
const CART_KEY = "beanavenue.shopCart";
const loadCart = (): CartLine[] => { try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); } catch { return []; } };

export function Shop() {
  const toast = useToast();
  const navigate = useNavigate();
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [cats, setCats] = useState<ShopCategory[]>([]);
  const [active, setActive] = useState(ALL_COFFEE);
  const [detail, setDetail] = useState<ShopProduct | null>(null);
  const [cart, setCart] = useState<CartLine[]>(loadCart);
  const [showCart, setShowCart] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [placing, setPlacing] = useState(false);
  const [preorder, setPreorder] = useState<ShopProduct | null>(null);
  const [poQty, setPoQty] = useState(1);
  const [poNotes, setPoNotes] = useState("");
  const [poBusy, setPoBusy] = useState(false);
  const [poDone, setPoDone] = useState<{ number: string } | null>(null);

  useEffect(() => {
    customerApi.get<{ products: ShopProduct[]; categories: ShopCategory[] }>("/api/shop")
      .then((r) => { setProducts(r.products); setCats(r.categories); })
      .catch(() => {});
  }, []);
  useEffect(() => { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }, [cart]);

  const machineSet = useMemo(() => new Set(MACHINE_CATS), []);
  const coffeeCats = useMemo(() => cats.filter((c) => !machineSet.has(c.name)), [cats, machineSet]);
  const machineCats = useMemo(() => cats.filter((c) => machineSet.has(c.name)), [cats, machineSet]);
  const shown = useMemo(() => {
    if (active === ALL_COFFEE) return products.filter((p) => !machineSet.has(p.category));
    if (active === ALL_MACHINES) return products.filter((p) => machineSet.has(p.category));
    return products.filter((p) => p.category === active);
  }, [products, active, machineSet]);
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

  function openPreorder(p: ShopProduct) { setPreorder(p); setPoQty(1); setPoNotes(""); setPoDone(null); setDetail(null); }
  const productAction = (p: ShopProduct) => (p.status === "PREORDER" || (p.status === "OUT" && p.allowPreorder) ? openPreorder(p) : addToCart(p));

  async function submitPreorder() {
    if (!preorder || poBusy) return;
    if (!name.trim()) return toast("Please enter your name.", "error");
    if (!phone.trim()) return toast("Please enter your phone number.", "error");
    setPoBusy(true);
    try {
      const r = await customerApi.post<{ number: string }>("/api/shop/preorder", {
        productId: preorder.id, quantity: poQty, customerName: name.trim(), phone: phone.trim(), notes: poNotes.trim() || undefined,
      });
      setPoDone({ number: r.number });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't place your preorder.", "error");
    } finally {
      setPoBusy(false);
    }
  }

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


  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="text-center">
        <h1 className="font-display text-4xl font-bold text-espresso">Bean Avenue Shop</h1>
        <p className="mt-2 text-charcoal/60">Take illy home — capsules, beans, ground coffee & more. Order online for pickup.</p>
      </div>

      {/* Category nav (illy-style) — Coffee on top, Machines & Makers below */}
      <div className="sticky top-16 z-20 -mx-4 mt-6 border-b border-oat bg-cream/95 px-4 py-3 backdrop-blur">
        <div className="flex gap-5 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[ALL_COFFEE, ...coffeeCats.map((c) => c.name)].map((t) => (
            <button key={t} onClick={() => setActive(t)} className={`text-sm font-semibold transition ${active === t ? "text-espresso underline decoration-terracotta decoration-2 underline-offset-8" : "text-charcoal/55 hover:text-espresso"}`}>{t}</button>
          ))}
        </div>
        {machineCats.length > 0 && (
          <div className="mt-2 flex items-center gap-5 overflow-x-auto whitespace-nowrap border-t border-oat/60 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-charcoal/35">Machines &amp; Makers</span>
            {[ALL_MACHINES, ...machineCats.map((c) => c.name)].map((t) => (
              <button key={t} onClick={() => setActive(t)} className={`text-sm font-semibold transition ${active === t ? "text-espresso underline decoration-terracotta decoration-2 underline-offset-8" : "text-charcoal/55 hover:text-espresso"}`}>{t === ALL_MACHINES ? "All Machines" : t}</button>
            ))}
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((p) => (
          <div key={p.id} className="group flex flex-col rounded-2xl bg-white p-3 shadow-sm transition hover:shadow-md">
            <Link to={`/shop/${p.id}`} className="relative block">
              <Img src={p.images[0] ?? ""} alt={p.name} fit="contain" className="aspect-square w-full rounded-xl bg-[#efe7dc]" />
              {p.featured && <span className="absolute left-2 top-2 rounded-full bg-espresso px-2 py-0.5 text-[10px] font-bold text-cream">BEST SELLER</span>}
            </Link>
            <div className="mt-2 flex flex-1 flex-col">
              <Link to={`/shop/${p.id}`} className="text-left text-sm font-semibold leading-tight text-espresso hover:text-terracotta">{p.name}</Link>
              <p className="mt-0.5 text-xs text-charcoal/45">{p.description.split(" · ").slice(1, 2).join("")}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="font-bold text-terracotta">{money(p.price)}</span>
                <StatusBadge status={p.status} qty={p.quantity} />
              </div>
              <button
                onClick={() => productAction(p)}
                disabled={p.status === "OUT" && !p.allowPreorder}
                className="btn-3d mt-2 w-full rounded-full bg-espresso py-2 text-xs font-bold text-cream disabled:cursor-not-allowed disabled:opacity-40"
              >
                {p.status === "PREORDER" || (p.status === "OUT" && p.allowPreorder) ? "Preorder" : p.status === "OUT" ? "Out of stock" : "Add to Cart"}
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
            <button onClick={() => productAction(detail)} disabled={detail.status === "OUT" && !detail.allowPreorder} className="btn-3d mt-4 w-full rounded-full bg-espresso py-3 font-bold text-cream disabled:opacity-40">
              {detail.status === "PREORDER" || (detail.status === "OUT" && detail.allowPreorder) ? "Preorder" : detail.status === "OUT" ? "Out of stock" : "Add to Cart"}
            </button>
          </div>
        </div>
      )}

      {/* Preorder modal */}
      {preorder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPreorder(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            {poDone ? (
              <div className="text-center">
                <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-[#5b3fd6]/15 text-3xl">📦</div>
                <p className="font-display text-xl font-bold text-espresso">Preorder received!</p>
                <p className="mt-1 text-sm text-charcoal/60">Preorder number</p>
                <p className="text-2xl font-bold text-[#5b3fd6]">{poDone.number}</p>
                <p className="mt-3 text-sm text-charcoal/70">{preorder.name}</p>
                <p className="mt-2 rounded-xl bg-oat/50 px-3 py-2 text-sm text-charcoal/70">We'll contact you on <span className="font-semibold">{phone}</span> when it arrives{preorder.preorderEta ? ` (est. ${preorder.preorderEta})` : ""}.</p>
                <button onClick={() => setPreorder(null)} className="btn-3d mt-4 w-full rounded-full bg-espresso py-3 font-bold text-cream">Done</button>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#5b3fd6]">Preorder</p>
                    <h2 className="font-display text-lg font-bold text-espresso">{preorder.name}</h2>
                  </div>
                  <button onClick={() => setPreorder(null)} className="text-charcoal/40 hover:text-charcoal">✕</button>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <Img src={preorder.images[0] ?? ""} alt="" fit="contain" className="h-20 w-20 rounded-xl bg-[#efe7dc]" />
                  <div>
                    <p className="font-bold text-terracotta">{money(preorder.price)}</p>
                    {preorder.preorderEta && <p className="text-xs text-charcoal/55">Est. availability: {preorder.preorderEta}</p>}
                    <p className="text-xs text-charcoal/45">No payment now — the manager will contact you.</p>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-espresso">Qty</span>
                    <button onClick={() => setPoQty((q) => Math.max(1, q - 1))} className="h-8 w-8 rounded-full bg-oat font-bold">–</button>
                    <span className="w-6 text-center font-semibold">{poQty}</span>
                    <button onClick={() => setPoQty((q) => q + 1)} className="h-8 w-8 rounded-full bg-oat font-bold">+</button>
                  </div>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full rounded-xl border border-oat px-3 py-2 text-sm" />
                  <PhoneInput value={phone} onChange={setPhone} />
                  <input value={poNotes} onChange={(e) => setPoNotes(e.target.value)} placeholder="Notes (colour, model…) — optional" className="w-full rounded-xl border border-oat px-3 py-2 text-sm" />
                </div>
                <button onClick={submitPreorder} disabled={poBusy} className="btn-3d mt-4 w-full rounded-full bg-[#5b3fd6] py-3 font-bold text-cream disabled:opacity-60">
                  {poBusy ? "Submitting…" : `Place preorder · ${money(preorder.price * poQty)}`}
                </button>
              </>
            )}
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
