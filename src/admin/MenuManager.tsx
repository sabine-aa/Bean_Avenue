import { FormEvent, useEffect, useState } from "react";
import { ImageField } from "../components/ImageField";
import { Img } from "../components/Img";
import { useToast } from "../context/ToastContext";
import { api, money } from "../lib/api";
import type { MenuItem } from "../types";

const EMPTY = {
  name: "",
  category: "Espresso Based",
  description: "",
  price: 0,
  photo: "",
  tags: [] as string[],
  optionsJson: "[]",
  imageFit: "cover" as "cover" | "contain",
  focalX: 50,
  focalY: 50,
};

export function AdminMenuManager() {
  const toast = useToast();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [cats, setCats] = useState<string[]>([]);
  const [showCats, setShowCats] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const load = () => api.get<MenuItem[]>("/api/menu?all=1").then(setItems);
  const loadCats = () => api.get<string[]>("/api/categories").then(setCats);
  useEffect(() => {
    load();
    loadCats();
  }, []);

  async function moveCat(index: number, dir: -1 | 1) {
    const next = [...cats];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setCats(next);
    try {
      await api.patch("/api/categories/order", { names: next });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't reorder.", "error");
      loadCats();
    }
  }

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
            imageFit: item.imageFit === "contain" ? "contain" : "cover",
            focalX: item.focalX ?? 50,
            focalY: item.focalY ?? 50,
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
      imageFit: form.imageFit,
      focalX: form.focalX,
      focalY: form.focalY,
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
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-3xl font-bold text-espresso">Menu Manager</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCats((v) => !v)}
            className="rounded-full bg-oat px-4 py-2 text-sm font-semibold text-espresso hover:bg-espresso hover:text-cream"
          >
            {showCats ? "Done ordering" : "Category order"}
          </button>
          <button
            onClick={() => openEditor(null)}
            className="rounded-full bg-terracotta px-5 py-2 font-semibold text-cream hover:bg-terracotta-dark"
          >
            + New item
          </button>
        </div>
      </div>

      {showCats && (
        <div className="mt-5 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-bold text-espresso">Category order</h2>
          <p className="mt-1 text-sm text-charcoal/60">
            This is the order customers see on the Menu page. The first category is selected by default.
          </p>
          <ol className="mt-3 space-y-1.5">
            {cats.map((c, idx) => (
              <li key={c} className="flex items-center gap-3 rounded-xl bg-oat/30 px-3 py-2">
                <span className="w-6 text-center text-xs font-bold text-charcoal/40">{idx + 1}</span>
                <span className="flex-1 font-semibold text-espresso">{c}</span>
                <button onClick={() => moveCat(idx, -1)} disabled={idx === 0} aria-label="Move up" className="px-2 text-charcoal/50 hover:text-espresso disabled:opacity-30">▲</button>
                <button onClick={() => moveCat(idx, 1)} disabled={idx === cats.length - 1} aria-label="Move down" className="px-2 text-charcoal/50 hover:text-espresso disabled:opacity-30">▼</button>
              </li>
            ))}
          </ol>
        </div>
      )}

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
              {cats.map((c) => (
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
          <label className="text-sm font-semibold text-espresso sm:col-span-2">
            Photo
            <ImageField value={form.photo} onChange={(photo) => setForm({ ...form, photo })} />
          </label>
          <div className="text-sm font-semibold text-espresso sm:col-span-2">
            Image display
            {/* Fit mode */}
            <div className="mt-2 flex flex-wrap gap-2 font-normal">
              {(["cover", "contain"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setForm({ ...form, imageFit: f })}
                  className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
                    form.imageFit === f
                      ? "border-espresso bg-espresso text-cream"
                      : "border-oat bg-white text-espresso hover:border-espresso"
                  }`}
                >
                  {f === "cover" ? "Fill card (cover)" : "Show whole product (contain)"}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs font-normal text-charcoal/50">
              <b>Fill</b> crops the photo to fill the card — best for most photos.{" "}
              <b>Contain</b> shows the entire product on a neutral background — use it only
              when filling would cut off part of the product.
            </p>

            {/* Live previews at desktop + mobile card sizes */}
            <div className="mt-3 flex flex-wrap gap-5 font-normal">
              <div>
                <p className="mb-1 text-xs font-semibold text-charcoal/60">Desktop card</p>
                <button
                  type="button"
                  onClick={(e) => {
                    if (form.imageFit !== "cover") return;
                    const r = e.currentTarget.getBoundingClientRect();
                    const x = Math.round(((e.clientX - r.left) / r.width) * 100);
                    const y = Math.round(((e.clientY - r.top) / r.height) * 100);
                    setForm({
                      ...form,
                      focalX: Math.max(0, Math.min(100, x)),
                      focalY: Math.max(0, Math.min(100, y)),
                    });
                  }}
                  className={`relative block w-64 overflow-hidden rounded-xl border border-oat ${
                    form.imageFit === "cover" ? "cursor-crosshair" : "cursor-default"
                  }`}
                  aria-label="Set focal point"
                >
                  <Img
                    src={form.photo || null}
                    alt={form.name || "Product preview"}
                    fit={form.imageFit}
                    position={`${form.focalX}% ${form.focalY}%`}
                    className="aspect-[4/3] w-full bg-oat/30"
                  />
                  {form.photo && form.imageFit === "cover" && (
                    <span
                      className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cream bg-espresso/30 ring-2 ring-espresso"
                      style={{ left: `${form.focalX}%`, top: `${form.focalY}%` }}
                    />
                  )}
                </button>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold text-charcoal/60">Mobile card</p>
                <div className="w-40 overflow-hidden rounded-xl border border-oat">
                  <Img
                    src={form.photo || null}
                    alt={form.name || "Product preview"}
                    fit={form.imageFit}
                    position={`${form.focalX}% ${form.focalY}%`}
                    className="aspect-[4/3] w-full bg-oat/30"
                  />
                </div>
              </div>
            </div>
            <p className="mt-2 text-xs font-normal text-charcoal/50">
              {form.imageFit === "cover"
                ? "Click the desktop preview to choose which part of the photo stays visible (the focal point ●). Confirm the product looks right on both sizes before saving."
                : "Contain shows the whole product, so no focal point is needed."}
            </p>
          </div>
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
            <Img
              src={item.photo}
              alt={item.name}
              fit={item.imageFit === "contain" ? "contain" : "cover"}
              position={`${item.focalX ?? 50}% ${item.focalY ?? 50}%`}
              className="h-14 w-14 shrink-0 rounded-xl bg-oat/30"
            />
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
