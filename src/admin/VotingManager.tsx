import { FormEvent, useEffect, useState } from "react";
import { Img } from "../components/Img";
import { useToast } from "../context/ToastContext";
import { api, formatDate } from "../lib/api";
import { EVENT_CATEGORIES } from "../lib/events";
import type { VotingOption, VotingStatus } from "../types";

interface VForm {
  title: string;
  category: string;
  description: string;
  image: string;
  possibleDate: string;
  closesAt: string; // datetime-local, blank = none
  isPublished: boolean;
}

const blank: VForm = {
  title: "",
  category: "",
  description: "",
  image: "",
  possibleDate: "",
  closesAt: "",
  isPublished: false,
};

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

const STATUS_CLS: Record<VotingStatus, string> = {
  OPEN: "bg-espresso text-cream",
  CLOSED: "bg-charcoal/70 text-cream",
  SELECTED: "bg-terracotta text-cream",
};

export function VotingManager() {
  const toast = useToast();
  const [options, setOptions] = useState<VotingOption[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<VForm>(blank);

  const load = () => api.get<VotingOption[]>("/api/voting/all").then(setOptions);
  useEffect(() => {
    load();
  }, []);

  function startNew() {
    setEditingId(null);
    setForm(blank);
    setShowForm(true);
  }

  function startEdit(o: VotingOption) {
    setEditingId(o.id);
    setForm({
      title: o.title,
      category: o.category,
      description: o.description,
      image: o.image ?? "",
      possibleDate: o.possibleDate,
      closesAt: toLocalInput(o.closesAt),
      isPublished: o.isPublished,
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(blank);
  }

  async function save(ev: FormEvent) {
    ev.preventDefault();
    if (!form.title.trim()) return toast("A title is required.", "error");
    const payload = { ...form, image: form.image || null, closesAt: form.closesAt || null };
    try {
      if (editingId) await api.patch(`/api/voting/${editingId}`, payload);
      else await api.post("/api/voting", payload);
      toast(editingId ? "Voting option updated." : "Voting option created.");
      closeForm();
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save.", "error");
    }
  }

  async function update(o: VotingOption, patch: Partial<VotingOption>) {
    await api.patch(`/api/voting/${o.id}`, patch);
    load();
  }

  async function selectWinner(o: VotingOption) {
    if (!confirm(`Select "${o.title}" as the winner? This creates an event draft you can finish in the Events manager.`)) return;
    try {
      const res = await api.post<{ eventId: number }>(`/api/voting/${o.id}/select`, {});
      toast(`Selected! Event draft #${res.eventId} created — finish it in the Events tab.`);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't select.", "error");
    }
  }

  async function remove(o: VotingOption) {
    if (!confirm(`Delete "${o.title}" and its votes? This cannot be undone.`)) return;
    await api.delete(`/api/voting/${o.id}`);
    toast("Voting option deleted.");
    if (editingId === o.id) closeForm();
    load();
  }

  async function move(index: number, dir: -1 | 1) {
    const next = [...options];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setOptions(next);
    await api.patch("/api/voting/reorder", { ids: next.map((o) => o.id) });
  }

  const cls = "mt-1 w-full rounded-lg border border-oat px-3 py-2 font-normal";

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-2xl font-bold text-espresso">Vote for What's Next</h2>
          <p className="mt-1 text-sm text-charcoal/60">
            Publish ideas for customers to vote on, then select a winner to spin up an event draft.
          </p>
        </div>
        <button onClick={startNew} className="shrink-0 rounded-full bg-terracotta px-5 py-2 font-semibold text-cream hover:bg-terracotta-dark">
          + New option
        </button>
      </div>

      {showForm && (
        <form onSubmit={save} className="mt-4 grid gap-4 rounded-2xl bg-white p-6 shadow-md sm:grid-cols-2">
          <h3 className="font-display text-lg font-bold text-espresso sm:col-span-2">
            {editingId ? "Edit voting option" : "New voting option"}
          </h3>
          <label className="text-sm font-semibold text-espresso">
            Title
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={cls} />
          </label>
          <label className="text-sm font-semibold text-espresso">
            Category
            <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={cls} list="vote-cats" />
            <datalist id="vote-cats">{EVENT_CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
          </label>
          <label className="text-sm font-semibold text-espresso sm:col-span-2">
            Description
            <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={cls} />
          </label>
          <label className="text-sm font-semibold text-espresso">
            Possible date / time <span className="font-normal text-charcoal/50">(freeform, optional)</span>
            <input value={form.possibleDate} onChange={(e) => setForm({ ...form, possibleDate: e.target.value })} placeholder="e.g. A Saturday in August" className={cls} />
          </label>
          <label className="text-sm font-semibold text-espresso">
            Voting closes <span className="font-normal text-charcoal/50">(optional)</span>
            <input type="datetime-local" value={form.closesAt} onChange={(e) => setForm({ ...form, closesAt: e.target.value })} className={cls} />
          </label>
          <label className="text-sm font-semibold text-espresso sm:col-span-2">
            Image URL <span className="font-normal text-charcoal/50">(optional)</span>
            <input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} className={cls} />
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-espresso sm:col-span-2">
            <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} />
            Published (open for customer voting)
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className="rounded-full bg-espresso px-6 py-2 font-semibold text-cream hover:bg-mocha">
              {editingId ? "Save changes" : "Create"}
            </button>
            <button type="button" onClick={closeForm} className="rounded-full px-6 py-2 font-semibold text-charcoal/60 hover:text-terracotta">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 space-y-2">
        {options.length === 0 && (
          <p className="rounded-2xl bg-white p-6 text-center text-charcoal/60 shadow-sm">
            No voting options yet. Create one, or convert a customer suggestion above.
          </p>
        )}
        {options.map((o, idx) => (
          <div key={o.id} className={`flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ${!o.isPublished ? "opacity-70" : ""}`}>
            <div className="flex flex-col">
              <button onClick={() => move(idx, -1)} disabled={idx === 0} aria-label="Move up" className="px-1 text-charcoal/40 hover:text-espresso disabled:opacity-30">▲</button>
              <button onClick={() => move(idx, 1)} disabled={idx === options.length - 1} aria-label="Move down" className="px-1 text-charcoal/40 hover:text-espresso disabled:opacity-30">▼</button>
            </div>
            {o.image && <Img src={o.image} alt={o.title} className="aspect-[16/10] h-14 shrink-0 rounded-lg bg-oat/30" />}
            <div className="min-w-[10rem] flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-espresso">{o.title}</p>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_CLS[o.status]}`}>{o.status}</span>
                {!o.isPublished && <span className="rounded-full bg-oat px-2 py-0.5 text-xs font-bold text-charcoal/60">Draft</span>}
                <span className="rounded-full bg-sage/20 px-2 py-0.5 text-xs font-bold text-sage-dark">{o.voteCount} votes</span>
              </div>
              <p className="text-xs text-charcoal/60">
                {o.category && `${o.category} · `}
                {o.closesAt ? `closes ${formatDate(o.closesAt)}` : "no deadline"}
                {o.convertedEventId && ` · → event draft #${o.convertedEventId}`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button onClick={() => startEdit(o)} className="rounded-full bg-oat px-3 py-1 font-semibold hover:bg-espresso hover:text-cream">Edit</button>
              <button onClick={() => update(o, { isPublished: !o.isPublished })} className="rounded-full bg-oat px-3 py-1 font-semibold hover:bg-espresso hover:text-cream">
                {o.isPublished ? "Unpublish" : "Publish"}
              </button>
              {o.status === "OPEN" ? (
                <button onClick={() => update(o, { status: "CLOSED" })} className="rounded-full bg-oat px-3 py-1 font-semibold hover:bg-espresso hover:text-cream">Close voting</button>
              ) : o.status === "CLOSED" ? (
                <button onClick={() => update(o, { status: "OPEN" })} className="rounded-full bg-oat px-3 py-1 font-semibold hover:bg-espresso hover:text-cream">Reopen</button>
              ) : null}
              {o.status !== "SELECTED" && (
                <button onClick={() => selectWinner(o)} className="rounded-full bg-terracotta/15 px-3 py-1 font-semibold text-terracotta-dark hover:bg-terracotta hover:text-cream">Select winner</button>
              )}
              <button onClick={() => remove(o)} className="rounded-full bg-terracotta/15 px-3 py-1 font-semibold text-terracotta-dark hover:bg-terracotta hover:text-cream">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
