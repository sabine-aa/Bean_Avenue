import { FormEvent, useEffect, useMemo, useState } from "react";
import { ImageField } from "../components/ImageField";
import { Img } from "../components/Img";
import { useToast } from "../context/ToastContext";
import { api, money } from "../lib/api";

type ShopCategory = { id: number; name: string; sortOrder: number; isHidden: boolean };
type Status = "IN_STOCK" | "LOW" | "OUT" | "PREORDER" | "HIDDEN";
type ShopProduct = {
  id: number; name: string; category: string; brand: string | null; description: string; images: string[];
  price: number; costPrice: number; sku: string | null; quantity: number; minQty: number;
  availableOnline: boolean; availablePos: boolean; allowPreorder: boolean; preorderEta: string | null;
  featured: boolean; sortOrder: number; isHidden: boolean; status: Status;
};

const STATUS_STYLE: Record<Status, string> = {
  IN_STOCK: "bg-sage/20 text-sage-dark", LOW: "bg-amber-100 text-amber-700",
  OUT: "bg-terracotta/15 text-terracotta-dark", PREORDER: "bg-[#5b3fd6]/15 text-[#5b3fd6]", HIDDEN: "bg-oat text-charcoal/50",
};
const STATUS_LABEL: Record<Status, string> = { IN_STOCK: "In stock", LOW: "Low", OUT: "Out", PREORDER: "Preorder", HIDDEN: "Hidden" };

const blank = () => ({
  name: "", category: "", brand: "Illy", description: "", image: "", price: "", costPrice: "", sku: "",
  quantity: "", minQty: "", availableOnline: true, availablePos: true, allowPreorder: false, preorderEta: "", featured: false, isHidden: false,
});

export function AdminShopProducts() {
  const toast = useToast();
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [cats, setCats] = useState<ShopCategory[]>([]);
  const [editing, setEditing] = useState<ShopProduct | "new" | null>(null);
  const [form, setForm] = useState(blank());
  const [newCat, setNewCat] = useState("");
  const [filter, setFilter] = useState("");

  const load = () => {
    api.get<ShopProduct[]>("/api/shop/admin/all").then(setProducts).catch(() => {});
    api.get<ShopCategory[]>("/api/shop/categories").then(setCats).catch(() => {});
  };
  useEffect(load, []);

  function openNew() { setForm({ ...blank() }); setEditing("new"); }
  function openEdit(p: ShopProduct) {
    setForm({
      name: p.name, category: p.category, brand: p.brand ?? "", description: p.description, image: p.images[0] ?? "",
      price: String(p.price), costPrice: p.costPrice ? String(p.costPrice) : "", sku: p.sku ?? "",
      quantity: String(p.quantity), minQty: String(p.minQty), availableOnline: p.availableOnline, availablePos: p.availablePos,
      allowPreorder: p.allowPreorder, preorderEta: p.preorderEta ?? "", featured: p.featured, isHidden: p.isHidden,
    });
    setEditing(p);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return toast("Product name is required.", "error");
    const body = {
      name: form.name, category: form.category, brand: form.brand, description: form.description,
      images: form.image ? [form.image] : [], price: Number(form.price) || 0, costPrice: Number(form.costPrice) || 0,
      sku: form.sku, minQty: Number(form.minQty) || 0, availableOnline: form.availableOnline, availablePos: form.availablePos,
      allowPreorder: form.allowPreorder, preorderEta: form.preorderEta, featured: form.featured, isHidden: form.isHidden,
    };
    try {
      if (editing === "new") {
        // New products can carry an opening quantity directly.
        await api.post("/api/shop", { ...body, quantity: Number(form.quantity) || 0 });
        toast("Product added.");
      } else if (editing) {
        await api.patch(`/api/shop/${editing.id}`, body);
        toast("Product updated.");
      }
      setEditing(null);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save the product.", "error");
    }
  }

  async function del(p: ShopProduct) {
    if (!window.confirm(`Delete “${p.name}”? (Tip: use Hide to keep it but pull it from sale.)`)) return;
    await api.delete(`/api/shop/${p.id}`);
    toast("Product deleted.");
    load();
  }

  async function adjustStock(p: ShopProduct) {
    const raw = window.prompt(`Set “${p.name}” stock to how many? (current: ${p.quantity})`, String(p.quantity));
    if (raw === null) return;
    const amount = Number(raw);
    if (Number.isNaN(amount)) return toast("Enter a number.", "error");
    await api.post(`/api/shop/${p.id}/adjust`, { type: "COUNT", amount, reason: "Manual recount" });
    toast("Stock updated.");
    load();
  }

  async function addCategory() {
    if (!newCat.trim()) return;
    try {
      await api.post("/api/shop/categories", { name: newCat.trim() });
      setNewCat("");
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't add category.", "error");
    }
  }
  async function renameCategory(c: ShopCategory) {
    const name = window.prompt("Rename category:", c.name);
    if (!name?.trim()) return;
    await api.patch(`/api/shop/categories/${c.id}`, { name: name.trim() });
    load();
  }
  async function deleteCategory(c: ShopCategory) {
    if (!window.confirm(`Delete the “${c.name}” category? Products keep their category text.`)) return;
    await api.delete(`/api/shop/categories/${c.id}`);
    load();
  }

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return products.filter((p) => !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || (p.brand ?? "").toLowerCase().includes(q));
  }, [products, filter]);

  const field = "mt-1 w-full rounded-xl border border-oat px-3 py-2 text-sm font-normal";
  const lbl = "block text-xs font-semibold text-espresso";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-espresso">Shop Products</h1>
          <p className="mt-1 text-sm text-charcoal/60">Retail items (Illy capsules, machines, beans, accessories…) — separate from the café menu.</p>
        </div>
        <button onClick={openNew} className="rounded-full bg-terracotta px-5 py-2 font-semibold text-cream hover:bg-terracotta-dark">+ Add product</button>
      </div>

      {/* Categories */}
      <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-espresso">Categories</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {cats.map((c) => (
            <span key={c.id} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${c.isHidden ? "bg-oat text-charcoal/40" : "bg-oat text-espresso"}`}>
              {c.name}
              <button onClick={() => renameCategory(c)} title="Rename" className="text-charcoal/40 hover:text-espresso">✎</button>
              <button onClick={() => api.patch(`/api/shop/categories/${c.id}`, { isHidden: !c.isHidden }).then(load)} title="Show/hide" className="text-charcoal/40 hover:text-espresso">{c.isHidden ? "🙈" : "👁"}</button>
              <button onClick={() => deleteCategory(c)} title="Delete" className="text-charcoal/40 hover:text-terracotta">✕</button>
            </span>
          ))}
          <input value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCategory()} placeholder="New category…" className="rounded-full border border-oat px-3 py-1 text-xs" />
          <button onClick={addCategory} className="rounded-full bg-espresso px-3 py-1 text-xs font-semibold text-cream">Add</button>
        </div>
      </div>

      <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search products…" className="mt-4 w-full max-w-sm rounded-full border border-oat px-4 py-2 text-sm" />

      {/* Product list */}
      <div className="mt-3 space-y-2">
        {shown.map((p) => (
          <div key={p.id} className={`flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ${p.isHidden ? "opacity-60" : ""}`}>
            <Img src={p.images[0] ?? ""} alt={p.name} className="h-14 w-14 shrink-0 rounded-xl bg-oat/30" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-espresso">
                {p.featured && <span className="mr-1 text-terracotta" title="Featured">★</span>}
                {p.name}
                <span className="ml-2 text-xs font-normal text-charcoal/50">{[p.brand, p.category].filter(Boolean).join(" · ")}</span>
              </p>
              <p className="text-sm text-terracotta">{money(p.price)} <span className="ml-2 text-xs text-charcoal/45">stock {p.quantity}{p.minQty ? ` · min ${p.minQty}` : ""}</span></p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[p.status]}`}>{STATUS_LABEL[p.status]}</span>
            <div className="flex gap-1 text-xs">
              {p.availableOnline && <span className="rounded bg-oat px-1.5 py-0.5 font-semibold text-charcoal/60">web</span>}
              {p.availablePos && <span className="rounded bg-oat px-1.5 py-0.5 font-semibold text-charcoal/60">POS</span>}
              {p.allowPreorder && <span className="rounded bg-[#5b3fd6]/15 px-1.5 py-0.5 font-semibold text-[#5b3fd6]">preorder</span>}
            </div>
            <button onClick={() => adjustStock(p)} className="rounded-full bg-oat px-3 py-1 text-xs font-semibold hover:bg-espresso hover:text-cream">Stock</button>
            <button onClick={() => openEdit(p)} className="rounded-full bg-espresso px-4 py-1 text-xs font-semibold text-cream hover:bg-mocha">Edit</button>
            <button onClick={() => del(p)} className="rounded-full px-2 py-1 text-xs font-semibold text-charcoal/40 hover:text-terracotta">🗑</button>
          </div>
        ))}
        {shown.length === 0 && <p className="rounded-2xl bg-white p-6 text-center text-charcoal/50 shadow-sm">No products yet — add your first retail product.</p>}
      </div>

      {/* Editor */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <form onSubmit={save} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-espresso">{editing === "new" ? "New product" : "Edit product"}</h2>
              <button type="button" onClick={() => setEditing(null)} className="text-charcoal/40 hover:text-charcoal">✕</button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className={`${lbl} sm:col-span-2`}>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} /></label>
              <label className={lbl}>Brand<input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className={field} placeholder="Illy" /></label>
              <label className={lbl}>Category
                <input list="shopcats" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={field} placeholder="Illy Capsules…" />
                <datalist id="shopcats">{cats.map((c) => <option key={c.id} value={c.name} />)}</datalist>
              </label>
              <label className={`${lbl} sm:col-span-2`}>Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className={field} /></label>
              <label className={lbl}>Price ($)<input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value.replace(/[^0-9.]/g, "") })} inputMode="decimal" className={field} /></label>
              <label className={lbl}>Cost price ($) <span className="font-normal text-charcoal/40">(optional)</span><input value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value.replace(/[^0-9.]/g, "") })} inputMode="decimal" className={field} /></label>
              <label className={lbl}>SKU <span className="font-normal text-charcoal/40">(optional)</span><input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className={field} /></label>
              <label className={lbl}>{editing === "new" ? "Opening stock qty" : "Stock qty (use Stock button to change)"}<input value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value.replace(/[^0-9.]/g, "") })} inputMode="decimal" disabled={editing !== "new"} className={`${field} disabled:bg-oat/40`} /></label>
              <label className={lbl}>Min stock level<input value={form.minQty} onChange={(e) => setForm({ ...form, minQty: e.target.value.replace(/[^0-9.]/g, "") })} inputMode="decimal" className={field} /></label>
              <label className={lbl}>Preorder ETA <span className="font-normal text-charcoal/40">(if preorder)</span><input value={form.preorderEta} onChange={(e) => setForm({ ...form, preorderEta: e.target.value })} className={field} placeholder="3–7 days" /></label>
              <div className="sm:col-span-2">
                <label className={lbl}>Product image</label>
                <ImageField value={form.image} onChange={(image) => setForm({ ...form, image })} placeholder="Upload a product photo or paste a link" />
              </div>
              <div className="sm:col-span-2 grid grid-cols-2 gap-2 rounded-xl bg-oat/30 p-3 sm:grid-cols-3">
                {([["availableOnline", "Sell online"], ["availablePos", "Sell in POS"], ["allowPreorder", "Allow preorder"], ["featured", "Featured"], ["isHidden", "Hidden"]] as const).map(([k, label]) => (
                  <label key={k} className="flex items-center gap-2 text-sm font-semibold text-espresso">
                    <input type="checkbox" checked={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.checked })} className="h-4 w-4" />{label}
                  </label>
                ))}
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="rounded-full border border-oat px-5 py-2 font-semibold text-charcoal/60">Cancel</button>
              <button type="submit" className="rounded-full bg-terracotta px-6 py-2 font-semibold text-cream hover:bg-terracotta-dark">Save product</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
