import { useEffect, useState } from "react";
import { Img } from "../components/Img";
import { useToast } from "../context/ToastContext";
import { api, money } from "../lib/api";
import type { MenuItem } from "../types";

interface FeaturedItem {
  id: number;
  sortOrder: number;
  menuItem: MenuItem;
}
interface Settings {
  title: string;
  visible: boolean;
  limit: number;
}

export function AdminFeatured() {
  const toast = useToast();
  const [items, setItems] = useState<FeaturedItem[]>([]);
  const [settings, setSettings] = useState<Settings>({ title: "", visible: true, limit: 6 });
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [pick, setPick] = useState("");

  function load() {
    return api.get<{ settings: Settings; items: FeaturedItem[] }>("/api/featured/admin").then((r) => {
      setItems(r.items);
      setSettings(r.settings);
    });
  }
  useEffect(() => {
    load();
    api.get<MenuItem[]>("/api/menu?all=1").then(setMenu).catch(() => {});
  }, []);

  async function saveSettings(patch: Partial<Settings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      await api.post("/api/featured/settings", patch);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save.", "error");
    }
  }

  async function addItem(menuItemId: number) {
    if (!menuItemId) return;
    await api.post("/api/featured/items", { menuItemId });
    setPick("");
    load();
  }
  async function removeItem(menuItemId: number) {
    await api.delete(`/api/featured/items/${menuItemId}`);
    load();
  }
  async function move(index: number, dir: -1 | 1) {
    const next = [...items];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    await api.patch("/api/featured/order", { ids: next.map((i) => i.menuItem.id) });
  }

  const featuredIds = new Set(items.map((i) => i.menuItem.id));
  const available = menu.filter((m) => !featuredIds.has(m.id) && !m.isHidden);
  const shown = settings.limit > 0 ? Math.min(items.length, settings.limit) : items.length;

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-espresso">Homepage Featured Products</h1>
      <p className="mt-1 text-sm text-charcoal/60">
        Choose which products show in the homepage section. They pull live from the Menu Manager — edit
        a product there and it updates here automatically.
      </p>

      {/* Section settings */}
      <div className="mt-5 grid gap-4 rounded-2xl bg-white p-5 shadow-sm sm:grid-cols-3">
        <label className="text-xs font-semibold text-espresso sm:col-span-1">
          Section title
          <input
            value={settings.title}
            onChange={(e) => setSettings({ ...settings, title: e.target.value })}
            onBlur={(e) => saveSettings({ title: e.target.value })}
            className="mt-1 w-full rounded-lg border border-oat px-3 py-2 font-normal"
          />
        </label>
        <label className="text-xs font-semibold text-espresso">
          How many to show <span className="font-normal text-charcoal/40">(0 = all)</span>
          <input
            type="number"
            min={0}
            value={settings.limit}
            onChange={(e) => setSettings({ ...settings, limit: Number(e.target.value) })}
            onBlur={(e) => saveSettings({ limit: Number(e.target.value) })}
            className="mt-1 w-full rounded-lg border border-oat px-3 py-2 font-normal"
          />
        </label>
        <label className="flex items-end gap-2 text-sm font-semibold text-espresso">
          <input
            type="checkbox"
            checked={settings.visible}
            onChange={(e) => saveSettings({ visible: e.target.checked })}
            className="mb-2.5 h-4 w-4"
          />
          <span className="mb-2">Show section on homepage</span>
        </label>
      </div>

      {/* Add a product */}
      <div className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <label className="text-xs font-semibold text-espresso">
          Add a product
          <select
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            className="mt-1 block w-72 max-w-full rounded-lg border border-oat px-3 py-2 font-normal"
          >
            <option value="">Choose from the menu…</option>
            {available.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} — {m.category}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={() => addItem(Number(pick))}
          disabled={!pick}
          className="rounded-full bg-espresso px-5 py-2 text-sm font-semibold text-cream hover:bg-mocha disabled:opacity-50"
        >
          + Add to homepage
        </button>
      </div>

      {/* Current featured list */}
      <div className="mt-5 space-y-2">
        {items.length === 0 && (
          <p className="rounded-2xl bg-white p-8 text-center text-charcoal/60 shadow-sm">
            No featured products yet — add some above.
          </p>
        )}
        {items.map((f, idx) => {
          const beyondLimit = settings.limit > 0 && idx >= settings.limit;
          return (
            <div
              key={f.id}
              className={`flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ${beyondLimit ? "opacity-50" : ""}`}
            >
              <div className="flex flex-col">
                <button onClick={() => move(idx, -1)} disabled={idx === 0} aria-label="Move up" className="px-1 text-charcoal/40 hover:text-espresso disabled:opacity-30">▲</button>
                <button onClick={() => move(idx, 1)} disabled={idx === items.length - 1} aria-label="Move down" className="px-1 text-charcoal/40 hover:text-espresso disabled:opacity-30">▼</button>
              </div>
              <span className="w-6 text-center text-xs font-bold text-charcoal/40">{idx + 1}</span>
              <Img src={f.menuItem.photo} alt={f.menuItem.name} className="h-14 w-14 rounded-xl" />
              <div className="flex-1">
                <p className="font-semibold text-espresso">
                  {f.menuItem.name}
                  <span className="ml-2 text-xs font-normal text-charcoal/50">{f.menuItem.category}</span>
                  {!f.menuItem.inStock && <span className="ml-2 text-xs text-terracotta-dark">sold out</span>}
                  {beyondLimit && <span className="ml-2 text-xs text-charcoal/40">hidden by limit</span>}
                </p>
                <p className="text-sm text-terracotta">{money(f.menuItem.price)}</p>
              </div>
              <button
                onClick={() => removeItem(f.menuItem.id)}
                className="rounded-full bg-terracotta/15 px-3 py-1 text-xs font-semibold text-terracotta-dark hover:bg-terracotta hover:text-cream"
              >
                Remove
              </button>
            </div>
          );
        })}
        {items.length > 0 && (
          <p className="pt-1 text-xs text-charcoal/50">
            Showing {shown} of {items.length} on the homepage.
          </p>
        )}
      </div>
    </div>
  );
}
