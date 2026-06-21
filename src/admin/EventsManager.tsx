import { useEffect, useState } from "react";
import { Img } from "../components/Img";
import { useToast } from "../context/ToastContext";
import { api, formatDateTime, money } from "../lib/api";
import { eventStatus, EVENT_CATEGORIES, STATUS_META } from "../lib/events";
import type { EventItem } from "../types";

interface EventForm {
  title: string;
  category: string;
  description: string;
  startTime: string; // datetime-local value
  durationMins: string; // blank allowed
  location: string;
  included: string; // one item per line
  price: number;
  spots: string; // blank = untracked
  maxSpots: string; // blank = untracked
  image: string;
  isPublished: boolean;
  isHidden: boolean;
  isCompleted: boolean;
  isCancelled: boolean;
}

const blank: EventForm = {
  title: "",
  category: "",
  description: "",
  startTime: "",
  durationMins: "",
  location: "",
  included: "",
  price: 0,
  spots: "",
  maxSpots: "",
  image: "",
  isPublished: false,
  isHidden: false,
  isCompleted: false,
  isCancelled: false,
};

// ISO -> value for <input type="datetime-local"> in local time.
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

export function AdminEvents() {
  const toast = useToast();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<EventForm>(blank);

  const load = () => api.get<EventItem[]>("/api/events/all").then(setEvents);
  useEffect(() => {
    load();
  }, []);

  function startNew() {
    setEditingId(null);
    setForm(blank);
    setShowForm(true);
  }

  function startEdit(e: EventItem) {
    setEditingId(e.id);
    setForm({
      title: e.title,
      category: e.category,
      description: e.description,
      startTime: toLocalInput(e.startTime),
      durationMins: e.durationMins == null ? "" : String(e.durationMins),
      location: e.location,
      included: e.included,
      price: e.price,
      spots: e.spots == null ? "" : String(e.spots),
      maxSpots: e.maxSpots == null ? "" : String(e.maxSpots),
      image: e.image ?? "",
      isPublished: e.isPublished,
      isHidden: e.isHidden,
      isCompleted: e.isCompleted,
      isCancelled: e.isCancelled,
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(blank);
  }

  // `publishOverride` lets the "Save as draft" / "Publish" buttons set the
  // published flag explicitly (avoids relying on async checkbox state).
  async function save(publishOverride?: boolean) {
    const isPublished = publishOverride ?? form.isPublished;
    const payload = {
      ...form,
      isPublished,
      durationMins: form.durationMins === "" ? null : Number(form.durationMins),
      spots: form.spots === "" ? null : Number(form.spots),
      maxSpots: form.maxSpots === "" ? null : Number(form.maxSpots),
      image: form.image || null,
    };
    try {
      if (editingId) {
        await api.patch(`/api/events/${editingId}`, payload);
        toast("Event updated.");
      } else {
        await api.post("/api/events", payload);
        toast(isPublished ? "Event published." : "Draft saved.");
      }
      closeForm();
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save.", "error");
    }
  }

  // Quick inline actions from the list.
  async function update(e: EventItem, patch: Partial<EventItem>) {
    await api.patch(`/api/events/${e.id}`, patch);
    load();
  }

  async function remove(e: EventItem) {
    if (!confirm(`Delete "${e.title}"? This cannot be undone.`)) return;
    await api.delete(`/api/events/${e.id}`);
    toast("Event deleted.");
    if (editingId === e.id) closeForm();
    load();
  }

  async function move(index: number, dir: -1 | 1) {
    const next = [...events];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setEvents(next);
    await api.patch("/api/events/reorder", { ids: next.map((e) => e.id) });
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-3xl font-bold text-espresso">Events &amp; Workshops</h1>
          <p className="mt-1 text-sm text-charcoal/60">
            Create real events, save drafts, publish, and manage status. Customers only see
            published events.
          </p>
        </div>
        <button
          onClick={startNew}
          className="shrink-0 rounded-full bg-terracotta px-5 py-2 font-semibold text-cream hover:bg-terracotta-dark"
        >
          + New event
        </button>
      </div>

      {showForm && <EventEditor form={form} setForm={setForm} editingId={editingId} onSave={save} onCancel={closeForm} />}
      {/* (EventEditor handles draft vs publish and validation) */}

      <div className="mt-5 space-y-2">
        {events.length === 0 && (
          <p className="rounded-2xl bg-white p-8 text-center text-charcoal/60 shadow-sm">
            No events yet — create your first one. Until you publish one, customers see the
            "Something is brewing" message.
          </p>
        )}
        {events.map((e, idx) => {
          const status = eventStatus(e);
          return (
            <div
              key={e.id}
              className={`flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ${
                !e.isPublished || e.isHidden ? "opacity-70" : ""
              }`}
            >
              <div className="flex flex-col">
                <button onClick={() => move(idx, -1)} disabled={idx === 0} aria-label="Move up" className="px-1 text-charcoal/40 hover:text-espresso disabled:opacity-30">▲</button>
                <button onClick={() => move(idx, 1)} disabled={idx === events.length - 1} aria-label="Move down" className="px-1 text-charcoal/40 hover:text-espresso disabled:opacity-30">▼</button>
              </div>
              <Img src={e.image} alt={e.title} className="aspect-[16/10] h-16 shrink-0 rounded-xl bg-oat/30" />
              <div className="min-w-[12rem] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-espresso">{e.title}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_META[status].badge}`}>
                    {STATUS_META[status].label}
                  </span>
                  {!e.isPublished ? (
                    <span className="rounded-full bg-oat px-2 py-0.5 text-xs font-bold text-charcoal/60">Draft</span>
                  ) : e.isHidden ? (
                    <span className="rounded-full bg-oat px-2 py-0.5 text-xs font-bold text-terracotta-dark">Hidden</span>
                  ) : null}
                </div>
                <p className="text-xs text-charcoal/60">
                  {e.category && `${e.category} · `}🗓 {formatDateTime(e.startTime)} · {e.price > 0 ? money(e.price) : "Free"}
                  {e.spots != null ? ` · ${e.spots}${e.maxSpots ? `/${e.maxSpots}` : ""} spots` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <button onClick={() => startEdit(e)} className="rounded-full bg-oat px-3 py-1 font-semibold hover:bg-espresso hover:text-cream">Edit</button>
                <a href={`/events/${e.id}`} target="_blank" rel="noreferrer" className="rounded-full bg-oat px-3 py-1 font-semibold hover:bg-espresso hover:text-cream">Preview</a>
                <button onClick={() => update(e, { isPublished: !e.isPublished })} className="rounded-full bg-oat px-3 py-1 font-semibold hover:bg-espresso hover:text-cream">
                  {e.isPublished ? "Unpublish" : "Publish"}
                </button>
                {e.isPublished && (
                  <button onClick={() => update(e, { isHidden: !e.isHidden })} className="rounded-full bg-oat px-3 py-1 font-semibold hover:bg-espresso hover:text-cream">
                    {e.isHidden ? "Show" : "Hide"}
                  </button>
                )}
                <button onClick={() => update(e, { spots: 0 })} className="rounded-full bg-oat px-3 py-1 font-semibold hover:bg-espresso hover:text-cream">Sold out</button>
                <button onClick={() => update(e, { isCompleted: !e.isCompleted })} className="rounded-full bg-oat px-3 py-1 font-semibold hover:bg-espresso hover:text-cream">
                  {e.isCompleted ? "Reopen" : "Completed"}
                </button>
                <button onClick={() => update(e, { isCancelled: !e.isCancelled })} className="rounded-full bg-oat px-3 py-1 font-semibold hover:bg-espresso hover:text-cream">
                  {e.isCancelled ? "Uncancel" : "Cancel"}
                </button>
                <button onClick={() => remove(e)} className="rounded-full bg-terracotta/15 px-3 py-1 font-semibold text-terracotta-dark hover:bg-terracotta hover:text-cream">Delete</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const inputCls = "mt-1 w-full rounded-lg border border-oat px-3 py-2 font-normal";

function EventEditor({
  form,
  setForm,
  editingId,
  onSave,
  onCancel,
}: {
  form: EventForm;
  setForm: (f: EventForm) => void;
  editingId: number | null;
  onSave: (publishOverride?: boolean) => void;
  onCancel: () => void;
}) {
  // Validate the native form, then save with the chosen published state.
  const submit = (ev: { currentTarget: HTMLButtonElement }, publish?: boolean) => {
    const formEl = ev.currentTarget.form;
    if (formEl && !formEl.reportValidity()) return;
    onSave(publish);
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
      className="mt-5 grid gap-4 rounded-2xl bg-white p-6 shadow-md sm:grid-cols-2"
    >
      <h2 className="font-display text-xl font-bold text-espresso sm:col-span-2">
        {editingId ? "Edit event" : "New event"}
      </h2>

      <label className="text-sm font-semibold text-espresso">
        Title
        <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} />
      </label>
      <label className="text-sm font-semibold text-espresso">
        Category
        <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls} list="event-cats" placeholder="Workshop, Social Gathering…" />
        <datalist id="event-cats">
          {EVENT_CATEGORIES.map((c) => <option key={c} value={c} />)}
        </datalist>
      </label>

      <label className="text-sm font-semibold text-espresso">
        Date &amp; time
        <input required type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className={inputCls} />
      </label>
      <label className="text-sm font-semibold text-espresso">
        Duration (minutes) <span className="font-normal text-charcoal/50">(optional)</span>
        <input type="number" min={0} value={form.durationMins} placeholder="e.g. 90" onChange={(e) => setForm({ ...form, durationMins: e.target.value })} className={inputCls} />
      </label>

      <label className="text-sm font-semibold text-espresso sm:col-span-2">
        Location <span className="font-normal text-charcoal/50">(blank = café address)</span>
        <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className={inputCls} placeholder="Bean Avenue, Aley" />
      </label>

      <label className="text-sm font-semibold text-espresso sm:col-span-2">
        Description
        <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} />
      </label>

      <label className="text-sm font-semibold text-espresso sm:col-span-2">
        What's included <span className="font-normal text-charcoal/50">(one item per line)</span>
        <textarea rows={3} value={form.included} onChange={(e) => setForm({ ...form, included: e.target.value })} className={inputCls} placeholder={"Welcome drink\nAll materials\nCertificate"} />
      </label>

      <div className="grid grid-cols-3 gap-3 sm:col-span-2">
        <label className="text-sm font-semibold text-espresso">
          Price ($) <span className="font-normal text-charcoal/50">0 = free</span>
          <input type="number" min={0} step="0.5" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className={inputCls} />
        </label>
        <label className="text-sm font-semibold text-espresso">
          Capacity <span className="font-normal text-charcoal/50">(max)</span>
          <input type="number" min={0} value={form.maxSpots} placeholder="—" onChange={(e) => setForm({ ...form, maxSpots: e.target.value })} className={inputCls} />
        </label>
        <label className="text-sm font-semibold text-espresso">
          Spots left
          <input type="number" min={0} value={form.spots} placeholder="—" onChange={(e) => setForm({ ...form, spots: e.target.value })} className={inputCls} />
        </label>
      </div>

      <div className="text-sm font-semibold text-espresso">
        Image URL <span className="font-normal text-charcoal/50">(optional)</span>
        <input value={form.image} placeholder="/photos/… or https://…" onChange={(e) => setForm({ ...form, image: e.target.value })} className={inputCls} />
      </div>
      <div className="text-sm font-semibold text-espresso">
        Preview
        <div className="mt-1 max-w-[16rem] overflow-hidden rounded-xl border border-oat">
          <Img src={form.image || null} alt={form.title || "Event preview"} className="aspect-[16/10] w-full bg-oat/30" />
        </div>
      </div>

      {/* Status flags */}
      <div className="flex flex-wrap gap-4 sm:col-span-2">
        {([
          ["isPublished", "Published (visible to customers)"],
          ["isHidden", "Hidden"],
          ["isCompleted", "Completed"],
          ["isCancelled", "Cancelled"],
        ] as const).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm font-semibold text-espresso">
            <input type="checkbox" checked={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} />
            {label}
          </label>
        ))}
      </div>

      <div className="flex gap-2 sm:col-span-2">
        {!editingId && (
          <button
            type="button"
            onClick={(e) => submit(e, false)}
            className="rounded-full bg-oat px-6 py-2 font-semibold text-espresso hover:bg-espresso hover:text-cream"
          >
            Save as draft
          </button>
        )}
        <button
          type="button"
          onClick={(e) => submit(e, editingId ? undefined : true)}
          className="rounded-full bg-espresso px-6 py-2 font-semibold text-cream hover:bg-mocha"
        >
          {editingId ? "Save changes" : "Publish"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-full px-6 py-2 font-semibold text-charcoal/60 hover:text-terracotta">
          Cancel
        </button>
      </div>
    </form>
  );
}
