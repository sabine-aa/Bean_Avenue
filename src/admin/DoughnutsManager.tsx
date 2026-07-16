import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Img } from "../components/Img";
import { useToast } from "../context/ToastContext";
import { api, money } from "../lib/api";
import type { MenuItem } from "../types";

const CATEGORY = "Hanson Doughnuts";
const PLACEHOLDER = "/doughnut-placeholder.svg";

interface DoughForm {
  name: string;
  description: string;
  price: number;
  ingredients: string;
  image: string;
}
const BLANK: DoughForm = { name: "", description: "", price: 2.5, ingredients: "", image: PLACEHOLDER };

interface Promo {
  visible: boolean;
  title: string;
  description: string;
  buttonText: string;
  image: string;
}

export function AdminDoughnuts() {
  const toast = useToast();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [featuredIds, setFeaturedIds] = useState<Set<number>>(new Set());
  const [promo, setPromo] = useState<Promo | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<DoughForm>(BLANK);

  function load() {
    api.get<MenuItem[]>("/api/doughnuts/admin").then(setItems);
    api
      .get<{ items: { menuItem: MenuItem }[] }>("/api/featured/admin")
      .then((r) => setFeaturedIds(new Set(r.items.map((i) => i.menuItem.id))))
      .catch(() => {});
    api
      .get<Promo>("/api/doughnuts/promo")
      .then(setPromo)
      .catch(() => {});
  }
  useEffect(() => {
    load();
  }, []);

  async function patchItem(d: MenuItem, data: Record<string, unknown>) {
    try {
      await api.patch(`/api/menu/${d.id}`, data);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't update.", "error");
    }
  }
  async function toggleFeatured(d: MenuItem) {
    if (featuredIds.has(d.id)) await api.delete(`/api/featured/items/${d.id}`);
    else await api.post("/api/featured/items", { menuItemId: d.id });
    load();
  }
  async function remove(d: MenuItem) {
    if (!confirm(`Delete "${d.name}" from the catalogue?`)) return;
    await api.delete(`/api/menu/${d.id}`);
    toast("Doughnut deleted.");
    load();
  }
  async function move(index: number, dir: -1 | 1) {
    const next = [...items];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    await api.patch("/api/menu/reorder", { ids: next.map((i) => i.id) });
  }

  function openNew() {
    setCreating(true);
    setEditingId(null);
    setForm(BLANK);
  }
  function openEdit(d: MenuItem) {
    setCreating(false);
    setEditingId(d.id);
    setForm({
      name: d.name,
      description: d.description,
      price: d.price,
      ingredients: d.ingredients ?? "",
      image: d.photo ?? PLACEHOLDER,
    });
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    const body = {
      name: form.name,
      category: CATEGORY,
      description: form.description,
      price: Number(form.price),
      ingredients: form.ingredients || null,
      photo: form.image || PLACEHOLDER,
    };
    try {
      if (creating) await api.post("/api/menu", { ...body, availableToday: false });
      else if (editingId) await api.patch(`/api/menu/${editingId}`, body);
      toast(creating ? "Doughnut added to catalogue." : "Doughnut updated.");
      setCreating(false);
      setEditingId(null);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save.", "error");
    }
  }

  async function savePromo(patch: Partial<Promo>) {
    if (!promo) return;
    const next = { ...promo, ...patch };
    setPromo(next);
    await api.post("/api/doughnuts/promo", patch).catch(() => toast("Couldn't save promo.", "error"));
  }

  const today = items.filter((d) => d.availableToday && !d.isHidden);
  const showEditor = creating || editingId !== null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-espresso text-3xl font-bold">Hanson Doughnuts Manager</h1>
        <div className="flex gap-2">
          <Link
            to="/doughnuts"
            target="_blank"
            className="bg-oat text-espresso hover:bg-espresso hover:text-cream rounded-full px-4 py-2 text-sm font-semibold"
          >
            Preview today's page ↗
          </Link>
          <button onClick={openNew} className="bg-terracotta text-cream hover:bg-terracotta-dark rounded-full px-5 py-2 text-sm font-semibold">
            + New doughnut
          </button>
        </div>
      </div>

      {/* Today's selection */}
      <div className="bg-espresso text-cream mt-5 rounded-2xl p-5 shadow-sm">
        <p className="text-oat text-sm">
          Customers currently see {today.length} doughnut{today.length === 1 ? "" : "s"} today:
        </p>
        <p className="mt-1 font-semibold">
          {today.length
            ? today.map((d) => `${d.name}${!d.inStock ? " (sold out)" : ""}`).join(" · ")
            : "None — turn on “Available Today” for ~5 doughnuts below."}
        </p>
      </div>

      {/* Homepage promo settings */}
      {promo && (
        <div className="mt-5 rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-espresso text-lg font-bold">Homepage promo section</h2>
            <label className="text-espresso flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={promo.visible} onChange={(e) => savePromo({ visible: e.target.checked })} />
              Show on homepage
            </label>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-espresso text-xs font-semibold">
              Title
              <input
                value={promo.title}
                onChange={(e) => setPromo({ ...promo, title: e.target.value })}
                onBlur={(e) => savePromo({ title: e.target.value })}
                className="border-oat mt-1 w-full rounded-lg border px-3 py-2 font-normal"
              />
            </label>
            <label className="text-espresso text-xs font-semibold">
              Button text
              <input
                value={promo.buttonText}
                onChange={(e) => setPromo({ ...promo, buttonText: e.target.value })}
                onBlur={(e) => savePromo({ buttonText: e.target.value })}
                className="border-oat mt-1 w-full rounded-lg border px-3 py-2 font-normal"
              />
            </label>
            <label className="text-espresso text-xs font-semibold sm:col-span-2">
              Description
              <input
                value={promo.description}
                onChange={(e) => setPromo({ ...promo, description: e.target.value })}
                onBlur={(e) => savePromo({ description: e.target.value })}
                className="border-oat mt-1 w-full rounded-lg border px-3 py-2 font-normal"
              />
            </label>
            <label className="text-espresso text-xs font-semibold sm:col-span-2">
              Image URL
              <input
                value={promo.image}
                onChange={(e) => setPromo({ ...promo, image: e.target.value })}
                onBlur={(e) => savePromo({ image: e.target.value })}
                className="border-oat mt-1 w-full rounded-lg border px-3 py-2 font-normal"
              />
            </label>
          </div>
        </div>
      )}

      {/* Add / edit form */}
      {showEditor && (
        <form onSubmit={save} className="mt-5 grid gap-4 rounded-2xl bg-white p-6 shadow-md sm:grid-cols-2">
          <h2 className="font-display text-espresso text-xl font-bold sm:col-span-2">{creating ? "New doughnut" : "Edit doughnut"}</h2>
          <label className="text-espresso text-sm font-semibold">
            Name
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="border-oat mt-1 w-full rounded-xl border px-3 py-2 font-normal"
            />
          </label>
          <label className="text-espresso text-sm font-semibold">
            Price ($)
            <input
              required
              type="number"
              step="0.25"
              min="0"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              className="border-oat mt-1 w-full rounded-xl border px-3 py-2 font-normal"
            />
          </label>
          <label className="text-espresso text-sm font-semibold sm:col-span-2">
            Description
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="border-oat mt-1 w-full rounded-xl border px-3 py-2 font-normal"
            />
          </label>
          <label className="text-espresso text-sm font-semibold sm:col-span-2">
            Ingredients / allergens
            <input
              value={form.ingredients}
              onChange={(e) => setForm({ ...form, ingredients: e.target.value })}
              className="border-oat mt-1 w-full rounded-xl border px-3 py-2 font-normal"
            />
          </label>
          <label className="text-espresso text-sm font-semibold sm:col-span-2">
            Image URL <span className="text-charcoal/50 font-normal">(replace the placeholder with the real photo)</span>
            <input
              value={form.image}
              onChange={(e) => setForm({ ...form, image: e.target.value })}
              className="border-oat mt-1 w-full rounded-xl border px-3 py-2 font-normal"
            />
          </label>
          {form.image && <Img src={form.image} alt="preview" className="h-24 w-32 rounded-xl sm:col-span-2" />}
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className="bg-espresso text-cream hover:bg-mocha rounded-full px-6 py-2 font-semibold">
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setEditingId(null);
              }}
              className="text-charcoal/60 hover:text-terracotta rounded-full px-6 py-2 font-semibold"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Catalogue */}
      <h2 className="font-display text-espresso mt-6 text-lg font-bold">Full catalogue ({items.length})</h2>
      <div className="mt-2 space-y-2">
        {items.map((d, idx) => (
          <div key={d.id} className={`flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ${d.isHidden ? "opacity-50" : ""}`}>
            <div className="flex flex-col">
              <button
                onClick={() => move(idx, -1)}
                disabled={idx === 0}
                aria-label="Move up"
                className="text-charcoal/40 hover:text-espresso px-1 disabled:opacity-30"
              >
                ▲
              </button>
              <button
                onClick={() => move(idx, 1)}
                disabled={idx === items.length - 1}
                aria-label="Move down"
                className="text-charcoal/40 hover:text-espresso px-1 disabled:opacity-30"
              >
                ▼
              </button>
            </div>
            <Img src={d.photo} alt={d.name} className="h-14 w-14 rounded-xl" />
            <div className="min-w-0 flex-1">
              <p className="text-espresso font-semibold">
                {d.name}
                {!d.inStock && <span className="text-terracotta-dark ml-2 text-xs font-semibold">SOLD OUT</span>}
                {d.isHidden && <span className="text-charcoal/40 ml-2 text-xs">hidden</span>}
              </p>
              <p className="text-terracotta text-sm">{money(d.price)}</p>
            </div>
            {/* Available Today toggle */}
            <button
              onClick={() => patchItem(d, { availableToday: !d.availableToday })}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${d.availableToday ? "bg-sage text-cream" : "bg-oat text-charcoal/60"}`}
            >
              Today: {d.availableToday ? "ON" : "OFF"}
            </button>
            <button
              onClick={() => patchItem(d, { inStock: !d.inStock })}
              className="bg-oat hover:bg-espresso hover:text-cream rounded-full px-3 py-1.5 text-xs font-semibold"
            >
              {d.inStock ? "Mark sold out" : "Back in stock"}
            </button>
            <button
              onClick={() => toggleFeatured(d)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${featuredIds.has(d.id) ? "bg-terracotta text-cream" : "bg-oat hover:bg-espresso hover:text-cream"}`}
            >
              {featuredIds.has(d.id) ? "★ Featured" : "Feature"}
            </button>
            <button
              onClick={() => patchItem(d, { isHidden: !d.isHidden })}
              className="bg-oat hover:bg-espresso hover:text-cream rounded-full px-3 py-1.5 text-xs font-semibold"
            >
              {d.isHidden ? "Show" : "Hide"}
            </button>
            <button onClick={() => openEdit(d)} className="bg-espresso text-cream hover:bg-mocha rounded-full px-3 py-1.5 text-xs font-semibold">
              Edit
            </button>
            <button
              onClick={() => remove(d)}
              className="bg-terracotta/15 text-terracotta-dark hover:bg-terracotta hover:text-cream rounded-full px-3 py-1.5 text-xs font-semibold"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
