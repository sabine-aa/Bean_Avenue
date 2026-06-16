import { FormEvent, useEffect, useState } from "react";
import { Img } from "../components/Img";
import { useToast } from "../context/ToastContext";
import { api, formatDateTime, money } from "../lib/api";
import type { EventItem } from "../types";

interface EventForm {
  title: string;
  description: string;
  startTime: string; // datetime-local value
  price: number;
  spots: string; // text so it can be blank
  image: string;
  isHidden: boolean;
}

const blank: EventForm = {
  title: "",
  description: "",
  startTime: "",
  price: 0,
  spots: "",
  image: "",
  isHidden: false,
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
  const [form, setForm] = useState<EventForm>(blank);

  const load = () => api.get<EventItem[]>("/api/events/all").then(setEvents);
  useEffect(() => {
    load();
  }, []);

  function startNew() {
    setEditingId(null);
    setForm(blank);
  }

  function startEdit(e: EventItem) {
    setEditingId(e.id);
    setForm({
      title: e.title,
      description: e.description,
      startTime: toLocalInput(e.startTime),
      price: e.price,
      spots: e.spots == null ? "" : String(e.spots),
      image: e.image ?? "",
      isHidden: e.isHidden,
    });
  }

  async function save(ev: FormEvent) {
    ev.preventDefault();
    const payload = {
      ...form,
      spots: form.spots === "" ? null : Number(form.spots),
      image: form.image || null,
    };
    try {
      if (editingId) {
        await api.patch(`/api/events/${editingId}`, payload);
        toast("Event updated.");
      } else {
        await api.post("/api/events", payload);
        toast("Event created.");
      }
      startNew();
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save.", "error");
    }
  }

  async function toggleHidden(e: EventItem) {
    await api.patch(`/api/events/${e.id}`, { isHidden: !e.isHidden });
    load();
  }

  async function remove(e: EventItem) {
    if (!confirm(`Delete "${e.title}"?`)) return;
    await api.delete(`/api/events/${e.id}`);
    toast("Event deleted.");
    if (editingId === e.id) startNew();
    load();
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-espresso">Events & Workshops</h1>
      <p className="mt-1 text-sm text-charcoal/60">Add, edit, hide, or remove what's on at Bean Avenue.</p>

      <div className="mt-5 grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {events.length === 0 && (
            <p className="rounded-2xl bg-white p-8 text-center text-charcoal/60 shadow-sm">
              No events yet — create your first one.
            </p>
          )}
          {events.map((e) => {
            const past = new Date(e.startTime).getTime() < Date.now();
            return (
              <div
                key={e.id}
                className={`flex gap-4 rounded-2xl bg-white p-4 shadow-sm ${e.isHidden ? "opacity-60" : ""}`}
              >
                <Img src={e.image} alt={e.title} className="h-20 w-20 shrink-0 rounded-xl" />
                <div className="flex-1">
                  <p className="font-semibold text-espresso">
                    {e.title}
                    {e.isHidden && <span className="ml-2 text-xs text-terracotta-dark">hidden</span>}
                    {past && <span className="ml-2 text-xs text-charcoal/40">past</span>}
                  </p>
                  <p className="text-xs text-charcoal/60">
                    🗓 {formatDateTime(e.startTime)} · {e.price > 0 ? money(e.price) : "Free"}
                    {e.spots != null ? ` · ${e.spots} spots` : ""}
                  </p>
                  {e.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-charcoal/60">{e.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-1.5 text-xs">
                  <button onClick={() => startEdit(e)} className="rounded-full bg-oat px-3 py-1 font-semibold hover:bg-espresso hover:text-cream">
                    Edit
                  </button>
                  <button onClick={() => toggleHidden(e)} className="rounded-full bg-oat px-3 py-1 font-semibold hover:bg-espresso hover:text-cream">
                    {e.isHidden ? "Show" : "Hide"}
                  </button>
                  <button onClick={() => remove(e)} className="rounded-full bg-terracotta/15 px-3 py-1 font-semibold text-terracotta-dark hover:bg-terracotta hover:text-cream">
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <form onSubmit={save} className="h-fit rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-bold text-espresso">{editingId ? "Edit event" : "New event"}</h2>
          <label className="mt-3 block text-xs font-semibold text-espresso">
            Title
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="mt-1 w-full rounded-lg border border-oat px-3 py-2 font-normal" />
          </label>
          <label className="mt-3 block text-xs font-semibold text-espresso">
            Date & time
            <input required type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              className="mt-1 w-full rounded-lg border border-oat px-3 py-2 font-normal" />
          </label>
          <label className="mt-3 block text-xs font-semibold text-espresso">
            Description
            <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="mt-1 w-full rounded-lg border border-oat px-3 py-2 font-normal" />
          </label>
          <div className="mt-3 flex gap-3">
            <label className="flex-1 text-xs font-semibold text-espresso">
              Price ($)
              <input type="number" min={0} step="0.5" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                className="mt-1 w-full rounded-lg border border-oat px-3 py-2 font-normal" />
            </label>
            <label className="flex-1 text-xs font-semibold text-espresso">
              Spots
              <input type="number" min={0} value={form.spots} placeholder="—" onChange={(e) => setForm({ ...form, spots: e.target.value })}
                className="mt-1 w-full rounded-lg border border-oat px-3 py-2 font-normal" />
            </label>
          </div>
          <label className="mt-3 block text-xs font-semibold text-espresso">
            Image URL <span className="font-normal text-charcoal/50">(optional)</span>
            <input value={form.image} placeholder="/photos/… or https://…" onChange={(e) => setForm({ ...form, image: e.target.value })}
              className="mt-1 w-full rounded-lg border border-oat px-3 py-2 font-normal" />
          </label>
          <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-espresso">
            <input type="checkbox" checked={!form.isHidden} onChange={(e) => setForm({ ...form, isHidden: !e.target.checked })} />
            Visible to customers
          </label>
          <div className="mt-4 flex gap-2">
            <button type="submit" className="flex-1 rounded-full bg-espresso px-4 py-2 text-sm font-semibold text-cream hover:bg-mocha">
              {editingId ? "Save changes" : "Create event"}
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
