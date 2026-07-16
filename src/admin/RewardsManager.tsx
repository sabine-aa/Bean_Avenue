import { FormEvent, useEffect, useState } from "react";
import { Img } from "../components/Img";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { REWARD_CATEGORIES, type Reward } from "../types";

interface RewardForm {
  name: string;
  category: string;
  description: string;
  cost: number;
  image: string;
  redeemMethod: string;
  isActive: boolean;
  isAvailable: boolean;
}

const blank: RewardForm = {
  name: "",
  category: REWARD_CATEGORIES[0],
  description: "",
  cost: 80,
  image: "",
  redeemMethod: "Show voucher at counter",
  isActive: true,
  isAvailable: true,
};

export function AdminRewards() {
  const toast = useToast();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<RewardForm>(blank);

  const load = () => api.get<Reward[]>("/api/rewards").then(setRewards);
  useEffect(() => {
    load();
  }, []);

  function startNew(category?: string) {
    setEditingId(null);
    setForm({ ...blank, category: category ?? blank.category });
  }

  function startEdit(r: Reward) {
    setEditingId(r.id);
    setForm({
      name: r.name,
      category: r.category ?? REWARD_CATEGORIES[0],
      description: r.description,
      cost: r.cost,
      image: r.image ?? "",
      redeemMethod: r.redeemMethod,
      isActive: r.isActive,
      isAvailable: r.isAvailable,
    });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const payload = { ...form, image: form.image || null };
    try {
      if (editingId) {
        await api.patch(`/api/rewards/${editingId}`, payload);
        toast("Reward updated.");
      } else {
        await api.post("/api/rewards", payload);
        toast("Reward created.");
      }
      startNew(form.category);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save.", "error");
    }
  }

  async function patch(r: Reward, data: Partial<Reward>) {
    await api.patch(`/api/rewards/${r.id}`, data);
    load();
  }

  async function remove(r: Reward) {
    if (!confirm(`Delete "${r.name}"? Past redemptions are kept.`)) return;
    await api.delete(`/api/rewards/${r.id}`);
    toast("Reward deleted.");
    if (editingId === r.id) startNew();
    load();
  }

  // Group rewards by category, following the order of REWARD_CATEGORIES.
  const grouped = [...REWARD_CATEGORIES, "Other"]
    .map((cat) => ({
      cat,
      list: rewards.filter((r) => (r.category || "Other") === cat),
    }))
    .filter((g) => g.list.length > 0);

  const field = "mt-1 w-full rounded-lg border border-oat px-3 py-2 font-normal";

  return (
    <div>
      <h1 className="font-display text-espresso text-3xl font-bold">Rewards</h1>
      <p className="text-charcoal/60 mt-1 text-sm">
        Rewards are organised by menu category. Add as many as you like per category and change the bean cost anytime.
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {grouped.length === 0 && <p className="text-charcoal/60 rounded-2xl bg-white p-8 text-center shadow-sm">No rewards yet — create your first one.</p>}
          {grouped.map(({ cat, list }) => (
            <div key={cat}>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-espresso text-lg font-bold">{cat}</h2>
                <button onClick={() => startNew(cat)} className="bg-oat hover:bg-espresso hover:text-cream rounded-full px-3 py-1 text-xs font-semibold">
                  + Add to {cat}
                </button>
              </div>
              <div className="mt-2 space-y-2">
                {list.map((r) => (
                  <div key={r.id} className={`flex gap-3 rounded-2xl bg-white p-3 shadow-sm ${r.isActive ? "" : "opacity-60"}`}>
                    <Img src={r.image} alt={r.name} className="h-16 w-16 shrink-0 rounded-xl" />
                    <div className="flex-1">
                      <p className="text-espresso font-semibold">
                        {r.name}
                        {!r.isActive && <span className="text-terracotta-dark ml-2 text-xs">hidden</span>}
                        {!r.isAvailable && <span className="text-terracotta-dark ml-2 text-xs">unavailable</span>}
                      </p>
                      <p className="text-charcoal/60 text-xs">
                        {r.cost} beans · {r._count?.redemptions ?? 0} redeemed
                      </p>
                      {r.description && <p className="text-charcoal/50 line-clamp-1 text-xs">{r.description}</p>}
                    </div>
                    <div className="flex shrink-0 flex-col gap-1 text-xs">
                      <button onClick={() => startEdit(r)} className="bg-oat hover:bg-espresso hover:text-cream rounded-full px-3 py-1 font-semibold">
                        Edit
                      </button>
                      <button
                        onClick={() => patch(r, { isActive: !r.isActive })}
                        className="bg-oat hover:bg-espresso hover:text-cream rounded-full px-3 py-1 font-semibold"
                      >
                        {r.isActive ? "Hide" : "Show"}
                      </button>
                      <button
                        onClick={() => patch(r, { isAvailable: !r.isAvailable })}
                        className="bg-oat hover:bg-espresso hover:text-cream rounded-full px-3 py-1 font-semibold"
                      >
                        {r.isAvailable ? "Set N/A" : "Set avail"}
                      </button>
                      <button
                        onClick={() => remove(r)}
                        className="bg-terracotta/15 text-terracotta-dark hover:bg-terracotta hover:text-cream rounded-full px-3 py-1 font-semibold"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={save} className="h-fit rounded-2xl bg-white p-5 shadow-sm lg:sticky lg:top-6">
          <h2 className="font-display text-espresso text-lg font-bold">{editingId ? "Edit reward" : "New reward"}</h2>
          <label className="text-espresso mt-3 block text-xs font-semibold">
            Category
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={field}>
              {REWARD_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="text-espresso mt-3 block text-xs font-semibold">
            Reward name
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} />
          </label>
          <label className="text-espresso mt-3 block text-xs font-semibold">
            Description
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={field} />
          </label>
          <div className="mt-3 flex gap-3">
            <label className="text-espresso flex-1 text-xs font-semibold">
              Beans required
              <input type="number" min={1} required value={form.cost} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} className={field} />
            </label>
          </div>
          <label className="text-espresso mt-3 block text-xs font-semibold">
            Image URL <span className="text-charcoal/50 font-normal">(optional)</span>
            <input value={form.image} placeholder="/photos/… or https://…" onChange={(e) => setForm({ ...form, image: e.target.value })} className={field} />
          </label>
          {form.image && <Img src={form.image} alt="preview" className="mt-2 h-24 w-full rounded-xl" />}
          <label className="text-espresso mt-3 block text-xs font-semibold">
            Redeem method
            <input value={form.redeemMethod} onChange={(e) => setForm({ ...form, redeemMethod: e.target.value })} className={field} />
          </label>
          <label className="text-espresso mt-3 flex items-center gap-2 text-xs font-semibold">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            Visible to customers
          </label>
          <label className="text-espresso mt-2 flex items-center gap-2 text-xs font-semibold">
            <input type="checkbox" checked={form.isAvailable} onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })} />
            Available to redeem
          </label>
          <div className="mt-4 flex gap-2">
            <button type="submit" className="bg-espresso text-cream hover:bg-mocha flex-1 rounded-full px-4 py-2 text-sm font-semibold">
              {editingId ? "Save changes" : "Create reward"}
            </button>
            {editingId && (
              <button type="button" onClick={() => startNew(form.category)} className="bg-oat rounded-full px-4 py-2 text-sm font-semibold">
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
