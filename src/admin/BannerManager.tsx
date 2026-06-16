import { FormEvent, useEffect, useState } from "react";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import type { Banner } from "../types";

interface BannerForm {
  title: string;
  text: string;
  image: string;
  buttonText: string;
  buttonLink: string;
  startDate: string;
  endDate: string;
  isVisible: boolean;
}

const blank: BannerForm = {
  title: "",
  text: "",
  image: "",
  buttonText: "",
  buttonLink: "",
  startDate: "",
  endDate: "",
  isVisible: true,
};

const toDateInput = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");

export function AdminBanners() {
  const toast = useToast();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<BannerForm>(blank);

  const load = () => api.get<Banner[]>("/api/banners").then(setBanners);
  useEffect(() => {
    load();
  }, []);

  function startNew() {
    setEditingId(null);
    setForm(blank);
  }

  function startEdit(b: Banner) {
    setEditingId(b.id);
    setForm({
      title: b.title,
      text: b.text,
      image: b.image ?? "",
      buttonText: b.buttonText ?? "",
      buttonLink: b.buttonLink ?? "",
      startDate: toDateInput(b.startDate),
      endDate: toDateInput(b.endDate),
      isVisible: b.isVisible,
    });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const payload = {
      ...form,
      image: form.image || null,
      buttonText: form.buttonText || null,
      buttonLink: form.buttonLink || null,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
    };
    try {
      if (editingId) {
        await api.patch(`/api/banners/${editingId}`, payload);
        toast("Banner updated.");
      } else {
        await api.post("/api/banners", payload);
        toast("Banner created.");
      }
      startNew();
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save.", "error");
    }
  }

  async function toggleVisible(b: Banner) {
    await api.patch(`/api/banners/${b.id}`, { isVisible: !b.isVisible });
    load();
  }

  async function remove(b: Banner) {
    if (!confirm(`Delete banner "${b.title}"?`)) return;
    await api.delete(`/api/banners/${b.id}`);
    toast("Banner deleted.");
    if (editingId === b.id) startNew();
    load();
  }

  const field = "mt-1 w-full rounded-lg border border-oat px-3 py-2 font-normal";

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-espresso">Homepage Banner</h1>
      <p className="mt-1 text-sm text-charcoal/60">
        Control the announcement bar at the top of the homepage. The newest visible banner within its
        date range is shown.
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          {banners.length === 0 && (
            <p className="rounded-2xl bg-white p-8 text-center text-charcoal/60 shadow-sm">
              No banners yet.
            </p>
          )}
          {banners.map((b) => (
            <div key={b.id} className={`rounded-2xl bg-white p-4 shadow-sm ${b.isVisible ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-espresso">
                    {b.title}
                    {!b.isVisible && <span className="ml-2 text-xs text-terracotta-dark">hidden</span>}
                  </p>
                  {b.text && <p className="text-xs text-charcoal/60">{b.text}</p>}
                  {(b.startDate || b.endDate) && (
                    <p className="mt-1 text-xs text-charcoal/40">
                      {toDateInput(b.startDate) || "always"} → {toDateInput(b.endDate) || "always"}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-1.5 text-xs">
                  <button onClick={() => startEdit(b)} className="rounded-full bg-oat px-3 py-1 font-semibold hover:bg-espresso hover:text-cream">
                    Edit
                  </button>
                  <button onClick={() => toggleVisible(b)} className="rounded-full bg-oat px-3 py-1 font-semibold hover:bg-espresso hover:text-cream">
                    {b.isVisible ? "Hide" : "Show"}
                  </button>
                  <button onClick={() => remove(b)} className="rounded-full bg-terracotta/15 px-3 py-1 font-semibold text-terracotta-dark hover:bg-terracotta hover:text-cream">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={save} className="h-fit rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-bold text-espresso">{editingId ? "Edit banner" : "New banner"}</h2>
          <label className="mt-3 block text-xs font-semibold text-espresso">
            Title
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={field} />
          </label>
          <label className="mt-3 block text-xs font-semibold text-espresso">
            Short text
            <input value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} className={field} />
          </label>
          <label className="mt-3 block text-xs font-semibold text-espresso">
            Image URL <span className="font-normal text-charcoal/50">(optional)</span>
            <input value={form.image} placeholder="/photos/… or https://…" onChange={(e) => setForm({ ...form, image: e.target.value })} className={field} />
          </label>
          <div className="mt-3 flex gap-3">
            <label className="flex-1 text-xs font-semibold text-espresso">
              Button text
              <input value={form.buttonText} onChange={(e) => setForm({ ...form, buttonText: e.target.value })} className={field} />
            </label>
            <label className="flex-1 text-xs font-semibold text-espresso">
              Button link
              <input value={form.buttonLink} placeholder="/loyalty or https://…" onChange={(e) => setForm({ ...form, buttonLink: e.target.value })} className={field} />
            </label>
          </div>
          <div className="mt-3 flex gap-3">
            <label className="flex-1 text-xs font-semibold text-espresso">
              Start date
              <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={field} />
            </label>
            <label className="flex-1 text-xs font-semibold text-espresso">
              End date
              <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={field} />
            </label>
          </div>
          <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-espresso">
            <input type="checkbox" checked={form.isVisible} onChange={(e) => setForm({ ...form, isVisible: e.target.checked })} />
            Show this banner
          </label>
          <div className="mt-4 flex gap-2">
            <button type="submit" className="flex-1 rounded-full bg-espresso px-4 py-2 text-sm font-semibold text-cream hover:bg-mocha">
              {editingId ? "Save changes" : "Create banner"}
            </button>
            {editingId && (
              <button type="button" onClick={startNew} className="rounded-full bg-oat px-4 py-2 text-sm font-semibold">
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
