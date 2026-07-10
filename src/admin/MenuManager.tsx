import { FormEvent, useEffect, useState } from "react";
import { ImageField } from "../components/ImageField";
import { Img } from "../components/Img";
import { useToast } from "../context/ToastContext";
import { api, money } from "../lib/api";
import type { MenuItem } from "../types";

type Size = { label: string; price: number };
type OptGroup = { name: string; choices: { label: string; priceDelta: number }[] };
type NutritionForm = { kcal: string; protein: string; carbs: string; fat: string; fibers: string };
const NUTRIENTS: { key: keyof NutritionForm; label: string; unit: string }[] = [
  { key: "kcal", label: "Calories", unit: "kcal" },
  { key: "protein", label: "Protein", unit: "g" },
  { key: "carbs", label: "Carbs", unit: "g" },
  { key: "fat", label: "Fat", unit: "g" },
  { key: "fibers", label: "Fibers", unit: "g" },
];

const EMPTY = {
  name: "",
  category: "Espresso Based",
  description: "",
  price: 0,
  photo: "",
  tags: [] as string[],
  hasSizes: false,
  sizes: [] as Size[],
  extraOptions: [] as OptGroup[], // non-"Size" option groups, preserved as-is
  isBestSeller: false,
  nutrition: { kcal: "", protein: "", carbs: "", fat: "", fibers: "" } as NutritionForm,
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
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [addingCat, setAddingCat] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [panelCat, setPanelCat] = useState("");

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

  async function createCategory(name: string, selectIt: boolean) {
    const n = name.trim();
    if (!n) return false;
    try {
      await api.post("/api/categories", { name: n });
      await loadCats();
      if (selectIt) setForm((f) => ({ ...f, category: n }));
      toast("Category added.");
      return true;
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't add category.", "error");
      return false;
    }
  }

  async function deleteCategory(name: string) {
    if (!window.confirm(`Delete the “${name}” category? (only works when it has no items)`)) return;
    try {
      await api.delete(`/api/categories/${encodeURIComponent(name)}`);
      await loadCats();
      toast("Category deleted.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't delete category.", "error");
    }
  }

  function openEditor(item: MenuItem | null) {
    setCreating(!item);
    setEditing(item);
    if (!item) {
      setForm(EMPTY);
      return;
    }
    const sizeGroup = item.options.find((g) => g.name === "Size");
    const n = item.nutrition ?? {};
    setForm({
      name: item.name,
      category: item.category,
      description: item.description,
      price: item.price,
      photo: item.photo ?? "",
      tags: item.tags,
      hasSizes: !!sizeGroup,
      sizes: sizeGroup
        ? sizeGroup.choices.map((c) => ({ label: c.label, price: Math.round((item.price + c.priceDelta) * 100) / 100 }))
        : [],
      extraOptions: item.options.filter((g) => g.name !== "Size"),
      isBestSeller: item.isBestSeller ?? false,
      nutrition: {
        kcal: n.kcal != null ? String(n.kcal) : "",
        protein: n.protein != null ? String(n.protein) : "",
        carbs: n.carbs != null ? String(n.carbs) : "",
        fat: n.fat != null ? String(n.fat) : "",
        fibers: n.fibers != null ? String(n.fibers) : "",
      },
      imageFit: item.imageFit === "contain" ? "contain" : "cover",
      focalX: item.focalX ?? 50,
      focalY: item.focalY ?? 50,
    });
  }

  async function save(e: FormEvent) {
    e.preventDefault();

    // Build the "Size" option group from the sizes editor. The first size is the
    // base — its price becomes the item's price, and the rest carry a priceDelta.
    let price = Number(form.price);
    let options: OptGroup[] = [...form.extraOptions];
    if (form.hasSizes) {
      const clean = form.sizes.filter((s) => s.label.trim());
      if (clean.length === 0) {
        toast("Add at least one size, or turn off multiple sizes.", "error");
        return;
      }
      const base = Number(clean[0].price) || 0;
      price = base;
      options = [
        {
          name: "Size",
          choices: clean.map((s) => ({
            label: s.label.trim(),
            priceDelta: Math.round(((Number(s.price) || 0) - base) * 100) / 100,
          })),
        },
        ...form.extraOptions,
      ];
    }

    const nutrition: Record<string, number> = {};
    for (const { key } of NUTRIENTS) {
      const raw = form.nutrition[key];
      if (raw !== "" && !Number.isNaN(Number(raw))) nutrition[key] = Number(raw);
    }

    const body = {
      name: form.name,
      category: form.category,
      description: form.description,
      price,
      photo: form.photo || null,
      tags: form.tags,
      options,
      isBestSeller: form.isBestSeller,
      nutrition: Object.keys(nutrition).length ? nutrition : null,
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

  async function toggle(item: MenuItem, field: "inStock" | "isHidden" | "isBestSeller") {
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

  // Category chips (in menu order, plus any extras like Hanson Doughnuts).
  const itemCats = items.reduce<string[]>((a, it) => (a.includes(it.category) ? a : [...a, it.category]), []);
  const orderedCats = [...cats.filter((c) => itemCats.includes(c)), ...itemCats.filter((c) => !cats.includes(c))];
  const q = search.trim().toLowerCase();
  const filtering = q !== "" || catFilter !== "All";
  const visible = items.filter(
    (it) =>
      (catFilter === "All" || it.category === catFilter) &&
      (q === "" || it.name.toLowerCase().includes(q) || it.category.toLowerCase().includes(q))
  );

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
                <button onClick={() => deleteCategory(c)} aria-label="Delete category" title="Delete category" className="px-2 text-charcoal/40 hover:text-terracotta">✕</button>
              </li>
            ))}
          </ol>
          <div className="mt-3 flex gap-2">
            <input
              value={panelCat}
              onChange={(e) => setPanelCat(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  createCategory(panelCat, false).then((ok) => ok && setPanelCat(""));
                }
              }}
              placeholder="New category name"
              className="flex-1 rounded-xl border border-oat px-3 py-2"
            />
            <button
              onClick={() => createCategory(panelCat, false).then((ok) => ok && setPanelCat(""))}
              className="whitespace-nowrap rounded-full bg-espresso px-4 py-2 text-sm font-semibold text-cream hover:bg-mocha"
            >
              + Add category
            </button>
          </div>
          <p className="mt-2 text-xs text-charcoal/50">A category only shows on the menu once it has at least one item. Deleting works only when the category is empty.</p>
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
          <div className="text-sm font-semibold text-espresso">
            Category
            {addingCat ? (
              <div className="mt-1 flex gap-2 font-normal">
                <input
                  autoFocus
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      createCategory(newCat, true).then((ok) => ok && (setAddingCat(false), setNewCat("")));
                    }
                  }}
                  placeholder="New category name"
                  className="flex-1 rounded-xl border border-oat px-3 py-2"
                />
                <button
                  type="button"
                  onClick={() => createCategory(newCat, true).then((ok) => ok && (setAddingCat(false), setNewCat("")))}
                  className="rounded-full bg-espresso px-4 py-2 text-sm font-semibold text-cream hover:bg-mocha"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingCat(false);
                    setNewCat("");
                  }}
                  className="rounded-full px-3 py-2 text-sm font-semibold text-charcoal/60 hover:text-terracotta"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="mt-1 flex gap-2 font-normal">
                <select
                  required
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="flex-1 rounded-xl border border-oat bg-white px-3 py-2"
                >
                  {form.category && !cats.includes(form.category) && <option value={form.category}>{form.category}</option>}
                  {cats.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setAddingCat(true);
                    setNewCat("");
                  }}
                  className="whitespace-nowrap rounded-full bg-oat px-4 py-2 text-sm font-semibold text-espresso hover:bg-espresso hover:text-cream"
                >
                  + New
                </button>
              </div>
            )}
          </div>
          <label className="text-sm font-semibold text-espresso sm:col-span-2">
            Description
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="mt-1 w-full rounded-xl border border-oat px-3 py-2 font-normal"
              rows={2}
            />
          </label>
          {!form.hasSizes && (
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
          )}
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
              {["Vegetarian", "Vegan", "Gluten-Free"].map((t) => (
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
          {/* Sizes editor */}
          <div className="text-sm font-semibold text-espresso sm:col-span-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.hasSizes}
                onChange={(e) => {
                  const on = e.target.checked;
                  setForm({
                    ...form,
                    hasSizes: on,
                    sizes:
                      on && form.sizes.length === 0
                        ? [
                            { label: "Small", price: form.price || 0 },
                            { label: "Large", price: form.price || 0 },
                          ]
                        : form.sizes,
                  });
                }}
              />
              This item has multiple sizes
            </label>
            {form.hasSizes && (
              <div className="mt-2 space-y-2 font-normal">
                <p className="text-xs text-charcoal/50">
                  Enter the full price of each size. The first size is the base (what shows as “From $…”).
                </p>
                {form.sizes.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={s.label}
                      placeholder="Size name (e.g. Small)"
                      onChange={(e) => {
                        const sizes = [...form.sizes];
                        sizes[i] = { ...sizes[i], label: e.target.value };
                        setForm({ ...form, sizes });
                      }}
                      className="flex-1 rounded-xl border border-oat px-3 py-2"
                    />
                    <span className="text-charcoal/50">$</span>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      value={s.price}
                      onChange={(e) => {
                        const sizes = [...form.sizes];
                        sizes[i] = { ...sizes[i], price: Number(e.target.value) };
                        setForm({ ...form, sizes });
                      }}
                      className="w-24 rounded-xl border border-oat px-3 py-2"
                    />
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, sizes: form.sizes.filter((_, j) => j !== i) })}
                      className="rounded-full px-2 text-lg text-charcoal/40 hover:text-terracotta"
                      aria-label="Remove size"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setForm({ ...form, sizes: [...form.sizes, { label: "", price: form.sizes[form.sizes.length - 1]?.price ?? 0 }] })
                  }
                  className="rounded-full bg-oat px-4 py-1.5 text-xs font-semibold text-espresso hover:bg-espresso hover:text-cream"
                >
                  + Add size
                </button>
              </div>
            )}
          </div>

          {/* Best seller */}
          <label className="flex items-center gap-2 text-sm font-semibold text-espresso sm:col-span-2">
            <input
              type="checkbox"
              checked={form.isBestSeller}
              onChange={(e) => setForm({ ...form, isBestSeller: e.target.checked })}
            />
            ★ Best seller (shows a badge on the menu)
          </label>

          {/* Nutrition */}
          <div className="text-sm font-semibold text-espresso sm:col-span-2">
            Nutrition <span className="font-normal text-charcoal/50">(optional — shown mainly on Protein Drinks)</span>
            <div className="mt-2 grid grid-cols-2 gap-2 font-normal sm:grid-cols-5">
              {NUTRIENTS.map(({ key, label, unit }) => (
                <label key={key} className="text-xs font-semibold text-charcoal/60">
                  {label} ({unit})
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={form.nutrition[key]}
                    onChange={(e) => setForm({ ...form, nutrition: { ...form.nutrition, [key]: e.target.value } })}
                    className="mt-1 w-full rounded-xl border border-oat px-2 py-1.5 font-normal"
                  />
                </label>
              ))}
            </div>
          </div>
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

      {/* Search + category filter — find and edit any item fast */}
      <div className="mt-5 rounded-2xl bg-white p-4 shadow-sm">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search the menu by name…"
          className="w-full rounded-full border border-oat px-4 py-2"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {["All", ...orderedCats].map((c) => (
            <button
              key={c}
              onClick={() => setCatFilter(c)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                catFilter === c ? "bg-espresso text-cream" : "bg-oat text-espresso hover:bg-espresso hover:text-cream"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-charcoal/50">
          Showing {visible.length} of {items.length}
          {filtering && " · clear the search & pick “All” to reorder items"}
        </p>
      </div>

      <div className="mt-4 space-y-2">
        {visible.length === 0 && (
          <p className="rounded-2xl bg-white p-6 text-center text-charcoal/50 shadow-sm">No items match your search.</p>
        )}
        {visible.map((item, idx) => (
          <div key={item.id} className={`flex items-center gap-4 rounded-2xl bg-white p-3 shadow-sm ${item.isHidden ? "opacity-50" : ""}`}>
            {!filtering && (
              <div className="flex flex-col">
                <button onClick={() => move(idx, -1)} aria-label="Move up" className="px-1 text-charcoal/40 hover:text-espresso">▲</button>
                <button onClick={() => move(idx, 1)} aria-label="Move down" className="px-1 text-charcoal/40 hover:text-espresso">▼</button>
              </div>
            )}
            <Img
              src={item.photo}
              alt={item.name}
              fit={item.imageFit === "contain" ? "contain" : "cover"}
              position={`${item.focalX ?? 50}% ${item.focalY ?? 50}%`}
              className="h-14 w-14 shrink-0 rounded-xl bg-oat/30"
            />
            <div className="flex-1">
              <p className="font-semibold text-espresso">
                {item.isBestSeller && <span className="mr-1 text-terracotta" title="Best seller">★</span>}
                {item.name}
                <span className="ml-2 text-xs font-normal text-charcoal/50">{item.category}</span>
              </p>
              <p className="text-sm text-terracotta">
                {item.options.length ? `From ${money(item.price)}` : money(item.price)}
              </p>
            </div>
            <label className="flex items-center gap-1.5 text-xs font-semibold">
              <input type="checkbox" checked={item.inStock} onChange={() => toggle(item, "inStock")} />
              In stock
            </label>
            <button
              onClick={() => toggle(item, "isBestSeller")}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                item.isBestSeller ? "bg-terracotta text-cream" : "bg-oat hover:bg-espresso hover:text-cream"
              }`}
              title="Toggle best seller"
            >
              ★
            </button>
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
