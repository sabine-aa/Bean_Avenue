import { FormEvent, useEffect, useState } from "react";
import { Img } from "../components/Img";
import { useToast } from "../context/ToastContext";
import { api, money } from "../lib/api";
import type { MenuItem } from "../types";

const EMPTY = {
  name: "",
  category: "Coffee",
  description: "",
  price: 0,
  photo: "",
  tags: [] as string[],
  optionsJson: "[]",
};

export function AdminMenuManager() {
  const toast = useToast();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const load = () => api.get<MenuItem[]>("/api/menu?all=1").then(setItems);
  useEffect(() => {
    load();
  }, []);

  function openEditor(item: MenuItem | null) {
    setCreating(!item);
    setEditing(item);
    setForm(
      item
        ? {
            name: item.name,
            category: item.category,
            description: item.description,
            price: item.price,
            photo: item.photo ?? "",
            tags: item.tags,
            optionsJson: JSON.stringify(item.options, null, 2),
          }
        : EMPTY
    );
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    let options;
    try {
      options = JSON.parse(form.optionsJson);
    } catch {
      toast("Options must be valid JSON.", "error");
      return;
    }
    const body = {
      name: form.name,
      category: form.category,
      description: form.description,
      price: Number(form.price),
      photo: form.photo || null,
      tags: form.tags,
      options,
    };
    try {
      if (creating) await api.post("/api/menu", body);
      else if (editing) await api.patch(`/api/menu/${editing.id}`, body);
      toast(creating ? "Item added to the menu." : "Item updated.");
      setEditing(null);
      setCreating(false);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save.", "error");
    }
  }

  async function toggle(item: MenuItem, field: "inStock" | "isHidden") {
    await api.patch(`/api/menu/${item.id}`, { [field]: !item[field] });
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

  const showEditor = creating || editing;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-espresso">Menu Manager</h1>
        <button
          onClick={() => openEditor(null)}
          className="rounded-full bg-terracotta px-5 py-2 font-semibold text-cream hover:bg-terracotta-dark"
        >
          + New item
        </button>
      </div>

      {showEditor && (
        <form onSubmit={save} className="mt-5 grid gap-4 rounded-2xl bg-white p-6 shadow-md sm:grid-cols-2">
          <h2 className="font-display text-xl font-bold text-espresso sm:col-span-2">
            {creating ? "New menu item" : `Editing: ${editing?.name}`}
          </h2>
          <label className="text-sm font-semibold text-espresso">
            Name
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full rounded-xl border border-oat px-3 py-2 font-normal"
            />
          </label>
          <label className="text-sm font-semibold text-espresso">
            Category
            <input
              required
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="mt-1 w-full rounded-xl border border-oat px-3 py-2 font-normal"
              list="categories"
            />
            <datalist id="categories">
              {["Coffee", "Tea", "Cold Drinks", "Pastries", "Food"].map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="text-sm font-semibold text-espresso sm:col-span-2">
            Description
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="mt-1 w-full rounded-xl border border-oat px-3 py-2 font-normal"
              rows={2}
            />
          </label>
          <label className="text-sm font-semibold text-espresso">
            Price ($)
            <input
              required
              type="number"
              step="0.05"
              min="0"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              className="mt-1 w-full rounded-xl border border-oat px-3 py-2 font-normal"
            />
          </label>
          <label className="text-sm font-semibold text-espresso">
            Photo URL
            <input
              value={form.photo}
              onChange={(e) => setForm({ ...form, photo: e.target.value })}
              className="mt-1 w-full rounded-xl border border-oat px-3 py-2 font-normal"
            />
          </label>
          <fieldset className="text-sm font-semibold text-espresso">
            Dietary tags
            <div className="mt-1 flex gap-3 font-normal">
              {["V", "VG", "GF"].map((t) => (
                <label key={t} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={form.tags.includes(t)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        tags: e.target.checked
                          ? [...form.tags, t]
                          : form.tags.filter((x) => x !== t),
                      })
                    }
                  />
                  {t}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="text-sm font-semibold text-espresso sm:col-span-2">
            Options / add-ons (JSON)
            <textarea
              value={form.optionsJson}
              onChange={(e) => setForm({ ...form, optionsJson: e.target.value })}
              className="mt-1 w-full rounded-xl border border-oat px-3 py-2 font-mono text-xs font-normal"
              rows={5}
            />
            <span className="mt-1 block text-xs font-normal text-charcoal/50">
              Format: {`[{"name":"Size","choices":[{"label":"Small","priceDelta":0},{"label":"Large","priceDelta":1.5}]}]`}
            </span>
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button
              type="submit"
              className="rounded-full bg-espresso px-6 py-2 font-semibold text-cream hover:bg-mocha"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setCreating(false);
              }}
              className="rounded-full px-6 py-2 font-semibold text-charcoal/60 hover:text-terracotta"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="mt-5 space-y-2">
        {items.map((item, idx) => (
          <div key={item.id} className={`flex items-center gap-4 rounded-2xl bg-white p-3 shadow-sm ${item.isHidden ? "opacity-50" : ""}`}>
            <div className="flex flex-col">
              <button onClick={() => move(idx, -1)} aria-label="Move up" className="px-1 text-charcoal/40 hover:text-espresso">▲</button>
              <button onClick={() => move(idx, 1)} aria-label="Move down" className="px-1 text-charcoal/40 hover:text-espresso">▼</button>
            </div>
            <Img src={item.photo} alt={item.name} className="h-14 w-14 rounded-xl" />
            <div className="flex-1">
              <p className="font-semibold text-espresso">
                {item.name}
                <span className="ml-2 text-xs font-normal text-charcoal/50">{item.category}</span>
              </p>
              <p className="text-sm text-terracotta">{money(item.price)}</p>
            </div>
            <label className="flex items-center gap-1.5 text-xs font-semibold">
              <input type="checkbox" checked={item.inStock} onChange={() => toggle(item, "inStock")} />
              In stock
            </label>
            <button
              onClick={() => toggle(item, "isHidden")}
              className="rounded-full bg-oat px-3 py-1 text-xs font-semibold hover:bg-espresso hover:text-cream"
            >
              {item.isHidden ? "Show" : "Hide"}
            </button>
            <button
              onClick={() => openEditor(item)}
              className="rounded-full bg-espresso px-4 py-1 text-xs font-semibold text-cream hover:bg-mocha"
            >
              Edit
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
