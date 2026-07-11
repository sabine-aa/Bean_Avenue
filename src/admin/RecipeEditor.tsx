import { useEffect, useMemo, useState } from "react";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import type { MenuItem } from "../types";

type StockItem = { id: number; name: string; unit: string };
type AddonOpt = { id: number; name: string; group: string };
type Comp = { uid: number; size: string | null; addonId: number | null; inventoryItemId: number; quantity: number };
type RecipeData = { menuItem: { id: number; name: string; category: string; sizes: string[] }; addons: AddonOpt[]; stockItems: StockItem[]; components: Omit<Comp, "uid">[] };

const ALL = "__ALL";

export function AdminRecipes() {
  const toast = useToast();
  const [products, setProducts] = useState<MenuItem[]>([]);
  const [covered, setCovered] = useState<Set<number>>(new Set());
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<number | null>(null);
  const [data, setData] = useState<RecipeData | null>(null);
  const [comps, setComps] = useState<Comp[]>([]);
  const [sizeTab, setSizeTab] = useState<string>(ALL);
  const [saving, setSaving] = useState(false);
  const uid = () => Math.floor(Math.random() * 1e9);

  async function loadIndex() {
    const [items, cov] = await Promise.all([
      api.get<MenuItem[]>("/api/menu?all=1"),
      api.get<{ menuItemIds: number[] }>("/api/stock/recipes/coverage"),
    ]);
    setProducts(items.filter((i) => !i.isHidden));
    setCovered(new Set(cov.menuItemIds));
  }
  useEffect(() => {
    loadIndex().catch(() => {});
  }, []);

  async function openProduct(id: number) {
    setSel(id);
    setSizeTab(ALL);
    const d = await api.get<RecipeData>(`/api/stock/recipe/${id}`);
    setData(d);
    setComps(d.components.map((c) => ({ ...c, uid: uid() })));
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return products.filter((p) => s === "" || p.name.toLowerCase().includes(s) || p.category.toLowerCase().includes(s));
  }, [products, q]);

  const unitOf = (invId: number) => data?.stockItems.find((s) => s.id === invId)?.unit ?? "";
  const sizeVal = sizeTab === ALL ? null : sizeTab;
  const baseRows = comps.filter((c) => c.addonId == null && (c.size ?? null) === sizeVal);
  const addonRows = comps.filter((c) => c.addonId != null);

  const update = (u: number, patch: Partial<Comp>) => setComps((cs) => cs.map((c) => (c.uid === u ? { ...c, ...patch } : c)));
  const remove = (u: number) => setComps((cs) => cs.filter((c) => c.uid !== u));
  const addBase = () => setComps((cs) => [...cs, { uid: uid(), size: sizeVal, addonId: null, inventoryItemId: 0, quantity: 0 }]);
  const addAddon = () => data && setComps((cs) => [...cs, { uid: uid(), size: null, addonId: data.addons[0]?.id ?? 0, inventoryItemId: 0, quantity: 0 }]);

  async function save() {
    if (!sel) return;
    setSaving(true);
    try {
      const payload = comps.filter((c) => c.inventoryItemId && c.quantity > 0).map(({ uid: _uid, ...c }) => c);
      await api.put(`/api/stock/recipe/${sel}`, { components: payload });
      toast(payload.length ? "Recipe saved." : "Recipe cleared.");
      setCovered((s) => { const n = new Set(s); payload.length ? n.add(sel) : n.delete(sel); return n; });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save recipe.", "error");
    } finally {
      setSaving(false);
    }
  }

  const stockSelect = (c: Comp) => (
    <select value={c.inventoryItemId} onChange={(e) => update(c.uid, { inventoryItemId: Number(e.target.value) })} className="min-w-0 flex-1 rounded-lg border border-oat bg-white px-2 py-1.5 text-sm">
      <option value={0}>— pick stock item —</option>
      {data?.stockItems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
  );
  const qtyInput = (c: Comp) => (
    <div className="flex items-center gap-1">
      <input type="number" step="0.001" value={c.quantity || ""} onChange={(e) => update(c.uid, { quantity: Number(e.target.value) })} placeholder="0" className="w-20 rounded-lg border border-oat px-2 py-1.5 text-right text-sm" />
      <span className="w-10 text-xs text-charcoal/50">{unitOf(c.inventoryItemId)}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl font-bold text-espresso">Recipes</h1>
        <p className="text-sm text-charcoal/50">Define what each product consumes from stock — by size and by add-on. Selling it auto-deducts these ingredients.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        {/* Product list */}
        <div className="rounded-2xl bg-white p-3 shadow-sm">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" className="mb-2 w-full rounded-xl border border-oat px-3 py-2 text-sm" />
          <div className="max-h-[70vh] space-y-1 overflow-y-auto">
            {filtered.map((p) => (
              <button key={p.id} onClick={() => openProduct(p.id)} className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm ${sel === p.id ? "bg-espresso text-cream" : "hover:bg-oat"}`}>
                <span className="min-w-0 truncate">{p.name}<span className={`block text-xs ${sel === p.id ? "text-cream/60" : "text-charcoal/40"}`}>{p.category}</span></span>
                {covered.has(p.id) && <span className={`shrink-0 text-xs ${sel === p.id ? "text-cream" : "text-sage-dark"}`}>✓</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Editor */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          {!data ? (
            <p className="py-16 text-center text-charcoal/40">Pick a product to edit its recipe.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-xl font-bold text-espresso">{data.menuItem.name}</h2>
                <button onClick={save} disabled={saving} className="btn-3d rounded-full bg-espresso px-6 py-2 text-sm font-semibold text-cream disabled:opacity-50">{saving ? "Saving…" : "Save recipe"}</button>
              </div>

              {/* Base recipe */}
              <h3 className="mt-4 text-sm font-bold text-espresso">Base recipe</h3>
              {data.menuItem.sizes.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[ALL, ...data.menuItem.sizes].map((s) => (
                    <button key={s} onClick={() => setSizeTab(s)} className={`rounded-full px-3 py-1 text-xs font-semibold ${sizeTab === s ? "bg-espresso text-cream" : "bg-oat text-espresso"}`}>{s === ALL ? "All sizes" : s}</button>
                  ))}
                </div>
              )}
              <p className="mt-1.5 text-xs text-charcoal/40">{sizeTab === ALL ? "Consumed for every size (e.g. coffee beans)." : `Consumed only for ${sizeTab} (e.g. milk, cup).`}</p>
              <div className="mt-2 space-y-2">
                {baseRows.map((c) => (
                  <div key={c.uid} className="flex items-center gap-2">
                    {stockSelect(c)}
                    {qtyInput(c)}
                    <button onClick={() => remove(c.uid)} className="text-charcoal/40 hover:text-terracotta">✕</button>
                  </div>
                ))}
                <button onClick={addBase} className="rounded-full border border-dashed border-oat px-3 py-1.5 text-xs font-semibold text-charcoal/60 hover:bg-oat">+ Add ingredient</button>
              </div>

              {/* Add-on recipes */}
              {data.addons.length > 0 && (
                <>
                  <h3 className="mt-6 text-sm font-bold text-espresso">Add-on recipes</h3>
                  <p className="mt-1 text-xs text-charcoal/40">Extra stock consumed when an add-on is chosen (e.g. Oat Milk add-on → oat milk stock).</p>
                  <div className="mt-2 space-y-2">
                    {addonRows.map((c) => (
                      <div key={c.uid} className="flex items-center gap-2">
                        <select value={c.addonId ?? 0} onChange={(e) => update(c.uid, { addonId: Number(e.target.value) })} className="w-40 rounded-lg border border-oat bg-white px-2 py-1.5 text-sm">
                          {data.addons.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                        {stockSelect(c)}
                        {qtyInput(c)}
                        <button onClick={() => remove(c.uid)} className="text-charcoal/40 hover:text-terracotta">✕</button>
                      </div>
                    ))}
                    <button onClick={addAddon} className="rounded-full border border-dashed border-oat px-3 py-1.5 text-xs font-semibold text-charcoal/60 hover:bg-oat">+ Add add-on ingredient</button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
