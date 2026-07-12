import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Img } from "../components/Img";
import { PhoneInput } from "../components/PhoneInput";
import { useToast } from "../context/ToastContext";
import { customerApi, money } from "../lib/api";

type Status = "IN_STOCK" | "LOW" | "OUT" | "PREORDER" | "HIDDEN";
type Product = {
  id: number; name: string; category: string; brand: string | null; description: string; images: string[];
  price: number; costPrice: number; sku: string | null; quantity: number; minQty: number;
  allowPreorder: boolean; preorderEta: string | null; status: Status;
};

const CART_KEY = "beanavenue.shopCart";
function addToShopCart(p: Product) {
  let cart: { productId: number; name: string; price: number; image: string; quantity: number }[] = [];
  try { cart = JSON.parse(localStorage.getItem(CART_KEY) || "[]"); } catch { cart = []; }
  const ex = cart.find((l) => l.productId === p.id);
  if (ex) ex.quantity += 1;
  else cart.push({ productId: p.id, name: p.name, price: p.price, image: p.images[0] ?? "", quantity: 1 });
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

export function ShopProduct() {
  const { id } = useParams();
  const toast = useToast();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [img, setImg] = useState(0);

  // Preorder form
  const [showPre, setShowPre] = useState(false);
  const [poName, setPoName] = useState("");
  const [poPhone, setPoPhone] = useState("");
  const [poQty, setPoQty] = useState(1);
  const [poNotes, setPoNotes] = useState("");
  const [poBusy, setPoBusy] = useState(false);
  const [poDone, setPoDone] = useState<{ number: string } | null>(null);

  useEffect(() => {
    setProduct(null); setNotFound(false); setImg(0); setShowPre(false); setPoDone(null);
    window.scrollTo(0, 0);
    customerApi.get<Product>(`/api/shop/${id}`).then((p) => {
      setProduct(p);
      customerApi.get<{ products: Product[] }>("/api/shop").then((r) => setRelated(r.products.filter((x) => x.category === p.category && x.id !== p.id).slice(0, 6))).catch(() => {});
    }).catch(() => setNotFound(true));
  }, [id]);

  const preorder = product ? product.status === "PREORDER" || (product.status === "OUT" && product.allowPreorder) : false;

  async function submitPreorder() {
    if (!product || poBusy) return;
    if (!poName.trim() || !poPhone.trim()) return toast("Name and phone are required.", "error");
    setPoBusy(true);
    try {
      const r = await customerApi.post<{ number: string }>("/api/shop/preorder", { productId: product.id, quantity: poQty, customerName: poName.trim(), phone: poPhone.trim(), notes: poNotes.trim() || undefined });
      setPoDone({ number: r.number });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't place your preorder.", "error");
    } finally {
      setPoBusy(false);
    }
  }

  if (notFound) return (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center">
      <p className="text-charcoal/70">This product isn't available.</p>
      <Link to="/shop" className="mt-4 inline-block font-semibold text-terracotta hover:underline">← Back to the shop</Link>
    </div>
  );
  if (!product) return <div className="mx-auto max-w-5xl px-4 py-24 text-center text-charcoal/50">Loading…</div>;

  const statusBadge =
    product.status === "IN_STOCK" ? ["In stock", "bg-sage/20 text-sage-dark"] :
    product.status === "LOW" ? [`Only ${product.quantity} left`, "bg-amber-100 text-amber-700"] :
    preorder ? ["Available for preorder", "bg-[#5b3fd6]/15 text-[#5b3fd6]"] : ["Out of stock", "bg-terracotta/15 text-terracotta-dark"];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link to="/shop" className="text-sm font-semibold text-charcoal/50 hover:text-espresso">← Back to shop</Link>

      <div className="mt-4 grid gap-8 md:grid-cols-2">
        {/* Gallery */}
        <div>
          <Img src={product.images[img] ?? ""} alt={product.name} fit="contain" className="aspect-square w-full rounded-2xl bg-[#efe7dc]" />
          {product.images.length > 1 && (
            <div className="mt-2 flex gap-2">
              {product.images.map((src, i) => (
                <button key={i} onClick={() => setImg(i)} className={`h-16 w-16 overflow-hidden rounded-xl ring-2 ${i === img ? "ring-terracotta" : "ring-transparent"}`}>
                  <Img src={src} alt="" fit="contain" className="h-full w-full bg-[#efe7dc]" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-charcoal/40">{[product.brand, product.category].filter(Boolean).join(" · ")}</p>
          <h1 className="mt-1 font-display text-3xl font-bold text-espresso">{product.name}</h1>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-3xl font-bold text-terracotta">{money(product.price)}</span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge[1]}`}>{statusBadge[0]}</span>
          </div>
          {preorder && (
            <p className="mt-2 rounded-xl bg-[#5b3fd6]/10 px-3 py-2 text-sm text-[#5b3fd6]">
              📦 Available for preorder{product.preorderEta ? ` · estimated availability ${product.preorderEta}` : ""}. No payment now — we'll contact you when it arrives.
            </p>
          )}
          {product.description && <p className="mt-4 text-charcoal/75">{product.description}</p>}

          {/* Specs */}
          <dl className="mt-4 divide-y divide-oat rounded-2xl border border-oat">
            {product.brand && <Spec label="Brand" value={product.brand} />}
            <Spec label="Category" value={product.category} />
            {product.sku && <Spec label="SKU" value={product.sku} />}
            <Spec label="Availability" value={preorder ? "Preorder" : product.status === "OUT" ? "Out of stock" : `${product.quantity} in stock`} />
          </dl>

          {/* Action */}
          <div className="mt-5">
            {preorder ? (
              <button onClick={() => setShowPre(true)} className="btn-3d w-full rounded-full bg-[#5b3fd6] py-3.5 font-bold text-cream">Preorder now</button>
            ) : product.status === "OUT" ? (
              <button disabled className="w-full rounded-full bg-oat py-3.5 font-bold text-charcoal/40">Out of stock</button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => { addToShopCart(product); toast(`${product.name.split(" - ")[0]} added to cart 🛍`); }} className="btn-3d flex-1 rounded-full bg-espresso py-3.5 font-bold text-cream">Add to Cart</button>
                <button onClick={() => navigate("/shop")} className="rounded-full border border-oat px-5 py-3.5 font-semibold text-espresso hover:bg-oat">View cart</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-xl font-bold text-espresso">More in {product.category}</h2>
          <div className="mt-4 flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {related.map((r) => (
              <Link key={r.id} to={`/shop/${r.id}`} className="card-lift flex w-40 shrink-0 flex-col overflow-hidden rounded-2xl bg-white shadow-sm">
                <Img src={r.images[0] ?? ""} alt={r.name} fit="contain" className="aspect-square w-full bg-[#efe7dc]" />
                <div className="p-2">
                  <p className="line-clamp-2 text-xs font-semibold text-espresso">{r.name}</p>
                  <p className="mt-0.5 text-sm font-bold text-terracotta">{money(r.price)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Preorder modal */}
      {showPre && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowPre(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            {poDone ? (
              <div className="text-center">
                <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-[#5b3fd6]/15 text-3xl">📦</div>
                <p className="font-display text-xl font-bold text-espresso">Preorder received!</p>
                <p className="mt-1 text-sm text-charcoal/60">Preorder number</p>
                <p className="text-2xl font-bold text-[#5b3fd6]">{poDone.number}</p>
                <p className="mt-2 rounded-xl bg-oat/50 px-3 py-2 text-sm text-charcoal/70">We'll contact you on <span className="font-semibold">{poPhone}</span> when it arrives{product.preorderEta ? ` (est. ${product.preorderEta})` : ""}.</p>
                <button onClick={() => setShowPre(false)} className="btn-3d mt-4 w-full rounded-full bg-espresso py-3 font-bold text-cream">Done</button>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#5b3fd6]">Preorder</p>
                    <h2 className="font-display text-lg font-bold text-espresso">{product.name}</h2>
                  </div>
                  <button onClick={() => setShowPre(false)} className="text-charcoal/40 hover:text-charcoal">✕</button>
                </div>
                <p className="mt-1 text-sm text-charcoal/55">{money(product.price)}{product.preorderEta ? ` · est. ${product.preorderEta}` : ""} · no payment now.</p>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-espresso">Qty</span>
                    <button onClick={() => setPoQty((q) => Math.max(1, q - 1))} className="h-8 w-8 rounded-full bg-oat font-bold">–</button>
                    <span className="w-6 text-center font-semibold">{poQty}</span>
                    <button onClick={() => setPoQty((q) => q + 1)} className="h-8 w-8 rounded-full bg-oat font-bold">+</button>
                  </div>
                  <input value={poName} onChange={(e) => setPoName(e.target.value)} placeholder="Your name" className="w-full rounded-xl border border-oat px-3 py-2 text-sm" />
                  <PhoneInput value={poPhone} onChange={setPoPhone} />
                  <input value={poNotes} onChange={(e) => setPoNotes(e.target.value)} placeholder="Notes (colour, model…) — optional" className="w-full rounded-xl border border-oat px-3 py-2 text-sm" />
                </div>
                <button onClick={submitPreorder} disabled={poBusy} className="btn-3d mt-4 w-full rounded-full bg-[#5b3fd6] py-3 font-bold text-cream disabled:opacity-60">
                  {poBusy ? "Submitting…" : `Place preorder · ${money(product.price * poQty)}`}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between px-4 py-2.5 text-sm">
      <dt className="text-charcoal/50">{label}</dt>
      <dd className="font-semibold text-espresso">{value}</dd>
    </div>
  );
}
