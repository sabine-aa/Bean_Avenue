import { useEffect, useState } from "react";
import { Img } from "../components/Img";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import type { MenuItem } from "../types";

type PickItem = { id: number; name: string; price: number; inStock: boolean };
type Row = { category: string; menuItemId: number; sortOrder: number; isHidden: boolean; menuItem: MenuItem };
type AdminData = {
  settings: { title: string; visible: boolean; limit: number };
  categories: string[];
  menuByCategory: Record<string, PickItem[]>;
  rows: Row[];
};

export function AdminFeatured() {
  const toast = useToast();
  const [data, setData] = useState<AdminData | null>(null);
  const [title, setTitle] = useState("");
  const [visible, setVisible] = useState(true);
  const [addCat, setAddCat] = useState("");

  const load = () =>
    api.get<AdminData>("/api/featured/admin").then((d) => {
      setData(d);
      setTitle(d.settings.title);
      setVisible(d.settings.visible);
    }).catch(() => {});
  useEffect(() => { load(); }, []);

  async function setProduct(category: string, menuItemId: number) {
    await api.post("/api/featured/set", { category, menuItemId });
    load();
  }
  async function toggleHide(category: string, isHidden: boolean) {
    await api.patch("/api/featured/hide", { category, isHidden });
    load();
  }
  async function remove(category: string) {
    await api.post("/api/featured/set", { category, menuItemId: 0 });
    toast(`${category} removed from the homepage.`);
    load();
  }
  async function move(index: number, dir: -1 | 1) {
    if (!data) return;
    const rows = [...data.rows];
    const t = index + dir;
    if (t < 0 || t >= rows.length) return;
    [rows[index], rows[t]] = [rows[t], rows[index]];
    setData({ ...data, rows });
    await api.patch("/api/featured/order", { categories: rows.map((r) => r.category) });
  }
  async function addCategory() {
    if (!addCat || !data) return;
    const first = data.menuByCategory[addCat]?.[0];
    if (!first) return toast("That category has no products.", "error");
    await api.post("/api/featured/set", { category: addCat, menuItemId: first.id });
    setAddCat("");
    load();
  }
  async function saveSettings() {
    await api.post("/api/featured/settings", { title, visible });
    toast("Homepage section saved.");
    load();
  }

  if (!data) return <p className="text-charcoal/50">Loading…</p>;
  const featuredCats = new Set(data.rows.map((r) => r.category));
  const available = data.categories.filter((c) => !featuredCats.has(c));

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-espresso">Homepage Featured Menu Items</h1>
      <p className="mt-1 text-sm text-charcoal/60">Pick <span className="font-semibold">one product per category</span> for the “{title}” carousel — so it always shows variety.</p>

      {/* Section settings */}
      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <label className="text-sm font-semibold text-espresso">Section title
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 block w-56 rounded-xl border border-oat px-3 py-2 font-normal" />
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-espresso">
          <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="h-4 w-4" /> Show on homepage
        </label>
        <button onClick={saveSettings} className="rounded-full bg-espresso px-5 py-2 text-sm font-semibold text-cream hover:bg-mocha">Save</button>
      </div>

      {/* Category → product table */}
      <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="hidden grid-cols-[1.4fr,2fr,auto] gap-3 border-b border-oat px-4 py-2 text-xs font-bold uppercase tracking-wide text-charcoal/45 sm:grid">
          <span>Category</span><span>Featured item</span><span>Order · show · remove</span>
        </div>
        {data.rows.map((r, i) => {
          const opts = data.menuByCategory[r.category] ?? [];
          return (
            <div key={r.category} className={`grid grid-cols-1 items-center gap-3 border-b border-oat/60 px-4 py-3 sm:grid-cols-[1.4fr,2fr,auto] ${r.isHidden ? "opacity-50" : ""}`}>
              <span className="font-semibold text-espresso">{r.category}</span>
              <div className="flex items-center gap-2">
                <Img src={r.menuItem.photo} alt="" className="h-10 w-10 shrink-0 rounded-lg bg-oat/30" />
                <select value={r.menuItemId} onChange={(e) => setProduct(r.category, Number(e.target.value))} className="min-w-0 flex-1 rounded-xl border border-oat px-3 py-2 text-sm">
                  {opts.map((o) => <option key={o.id} value={o.id}>{o.name}{!o.inStock ? " (sold out)" : ""}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-1 justify-self-start sm:justify-self-end">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded-full bg-oat px-2 py-1 text-xs font-bold disabled:opacity-30">↑</button>
                <button onClick={() => move(i, 1)} disabled={i === data.rows.length - 1} className="rounded-full bg-oat px-2 py-1 text-xs font-bold disabled:opacity-30">↓</button>
                <button onClick={() => toggleHide(r.category, !r.isHidden)} className="rounded-full bg-oat px-3 py-1 text-xs font-semibold hover:bg-espresso hover:text-cream">{r.isHidden ? "Show" : "Hide"}</button>
                <button onClick={() => remove(r.category)} className="rounded-full px-2 py-1 text-xs font-semibold text-charcoal/40 hover:text-terracotta">✕</button>
              </div>
            </div>
          );
        })}
        {data.rows.length === 0 && <p className="p-6 text-center text-charcoal/50">No categories featured yet — add one below.</p>}
      </div>

      {/* Add a category */}
      {available.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select value={addCat} onChange={(e) => setAddCat(e.target.value)} className="rounded-xl border border-oat px-3 py-2 text-sm">
            <option value="">+ Add a category…</option>
            {available.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={addCategory} disabled={!addCat} className="rounded-full bg-terracotta px-4 py-2 text-sm font-semibold text-cream hover:bg-terracotta-dark disabled:opacity-40">Add</button>
        </div>
      )}
    </div>
  );
}
