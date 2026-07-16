import { FormEvent, useEffect, useState } from "react";
import { useToast } from "../context/ToastContext";
import { api, formatHour, money } from "../lib/api";
import type { Room } from "../types";

export function AdminRooms() {
  const toast = useToast();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [editing, setEditing] = useState<Room | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    pricePerHour: 0,
    capacityMin: 1,
    capacityMax: 4,
    openHour: 8,
    closeHour: 22,
    amenities: "",
    rules: "",
    images: "",
    bufferMinutes: 0,
  });

  const load = () => api.get<Room[]>("/api/rooms").then(setRooms);
  useEffect(() => {
    load();
  }, []);

  function openEditor(room: Room) {
    setEditing(room);
    setForm({
      name: room.name,
      description: room.description,
      pricePerHour: room.pricePerHour,
      capacityMin: room.capacityMin,
      capacityMax: room.capacityMax,
      openHour: room.openHour,
      closeHour: room.closeHour,
      amenities: room.amenities.join("\n"),
      rules: room.rules.join("\n"),
      images: room.images.join("\n"),
      bufferMinutes: room.bufferMinutes,
    });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    try {
      await api.patch(`/api/rooms/${editing.id}`, {
        name: form.name,
        description: form.description,
        pricePerHour: Number(form.pricePerHour),
        capacityMin: Number(form.capacityMin),
        capacityMax: Number(form.capacityMax),
        openHour: Number(form.openHour),
        closeHour: Number(form.closeHour),
        amenities: form.amenities
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        rules: form.rules
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        images: form.images
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        bufferMinutes: Number(form.bufferMinutes),
      });
      toast("Room updated.");
      setEditing(null);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save.", "error");
    }
  }

  async function toggleAvailability(room: Room) {
    await api.patch(`/api/rooms/${room.id}`, { isAvailable: !room.isAvailable });
    toast(room.isAvailable ? `${room.name} taken offline — new bookings blocked.` : `${room.name} back online.`);
    load();
  }

  return (
    <div>
      <h1 className="font-display text-espresso text-3xl font-bold">Rooms Management</h1>

      {editing && (
        <form onSubmit={save} className="mt-5 grid gap-4 rounded-2xl bg-white p-6 shadow-md sm:grid-cols-2">
          <h2 className="font-display text-espresso text-xl font-bold sm:col-span-2">Editing: {editing.name}</h2>
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
            Price per hour ($)
            <input
              required
              type="number"
              step="0.5"
              min="0"
              value={form.pricePerHour}
              onChange={(e) => setForm({ ...form, pricePerHour: Number(e.target.value) })}
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
          <div className="flex gap-3">
            <label className="text-espresso flex-1 text-sm font-semibold">
              Min capacity
              <input
                type="number"
                min={1}
                value={form.capacityMin}
                onChange={(e) => setForm({ ...form, capacityMin: Number(e.target.value) })}
                className="border-oat mt-1 w-full rounded-xl border px-3 py-2 font-normal"
              />
            </label>
            <label className="text-espresso flex-1 text-sm font-semibold">
              Max capacity
              <input
                type="number"
                min={1}
                value={form.capacityMax}
                onChange={(e) => setForm({ ...form, capacityMax: Number(e.target.value) })}
                className="border-oat mt-1 w-full rounded-xl border px-3 py-2 font-normal"
              />
            </label>
          </div>
          <div className="flex gap-3">
            <label className="text-espresso flex-1 text-sm font-semibold">
              Opens (0–23)
              <input
                type="number"
                min={0}
                max={23}
                value={form.openHour}
                onChange={(e) => setForm({ ...form, openHour: Number(e.target.value) })}
                className="border-oat mt-1 w-full rounded-xl border px-3 py-2 font-normal"
              />
            </label>
            <label className="text-espresso flex-1 text-sm font-semibold">
              Closes (1–24)
              <input
                type="number"
                min={1}
                max={24}
                value={form.closeHour}
                onChange={(e) => setForm({ ...form, closeHour: Number(e.target.value) })}
                className="border-oat mt-1 w-full rounded-xl border px-3 py-2 font-normal"
              />
            </label>
            <label className="text-espresso flex-1 text-sm font-semibold">
              Buffer (min)
              <input
                type="number"
                min={0}
                max={60}
                value={form.bufferMinutes}
                onChange={(e) => setForm({ ...form, bufferMinutes: Number(e.target.value) })}
                className="border-oat mt-1 w-full rounded-xl border px-3 py-2 font-normal"
              />
            </label>
          </div>
          <label className="text-espresso text-sm font-semibold">
            Amenities (one per line)
            <textarea
              value={form.amenities}
              onChange={(e) => setForm({ ...form, amenities: e.target.value })}
              rows={4}
              className="border-oat mt-1 w-full rounded-xl border px-3 py-2 font-normal"
            />
          </label>
          <label className="text-espresso text-sm font-semibold">
            Rules (one per line)
            <textarea
              value={form.rules}
              onChange={(e) => setForm({ ...form, rules: e.target.value })}
              rows={4}
              className="border-oat mt-1 w-full rounded-xl border px-3 py-2 font-normal"
            />
          </label>
          <label className="text-espresso text-sm font-semibold sm:col-span-2">
            Image URLs (one per line)
            <textarea
              value={form.images}
              onChange={(e) => setForm({ ...form, images: e.target.value })}
              rows={2}
              className="border-oat mt-1 w-full rounded-xl border px-3 py-2 font-normal"
            />
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className="bg-espresso text-cream hover:bg-mocha rounded-full px-6 py-2 font-semibold">
              Save
            </button>
            <button type="button" onClick={() => setEditing(null)} className="text-charcoal/60 hover:text-terracotta rounded-full px-6 py-2 font-semibold">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="mt-5 overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-oat text-charcoal/50 border-b text-left text-xs tracking-wide uppercase">
              <th className="px-4 py-3">Room</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Capacity</th>
              <th className="px-4 py-3">Hours</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((r) => (
              <tr key={r.id} className="border-oat/60 border-b">
                <td className="text-espresso px-4 py-3 font-semibold">{r.name}</td>
                <td className="px-4 py-3">{money(r.pricePerHour)}/hour</td>
                <td className="px-4 py-3">
                  {r.capacityMin}–{r.capacityMax}
                </td>
                <td className="px-4 py-3">
                  {formatHour(r.openHour)} – {formatHour(r.closeHour)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${r.isAvailable ? "bg-sage/25 text-sage-dark" : "bg-terracotta/15 text-terracotta-dark"}`}
                  >
                    {r.isAvailable ? "Available" : "Offline"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    <button onClick={() => openEditor(r)} className="bg-espresso text-cream hover:bg-mocha rounded-full px-3 py-1 text-xs font-semibold">
                      Edit
                    </button>
                    <button
                      onClick={() => toggleAvailability(r)}
                      className="bg-oat hover:bg-espresso hover:text-cream rounded-full px-3 py-1 text-xs font-semibold"
                    >
                      {r.isAvailable ? "Take offline" : "Bring online"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
