import { FormEvent, useEffect, useState } from "react";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";

type Supplier = {
  id: number;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
};

const empty = { name: "", contactPerson: "", phone: "", whatsapp: "", email: "", address: "", notes: "" };

export function AdminSuppliers() {
  const toast = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [form, setForm] = useState({ ...empty });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ ...empty });

  const load = () =>
    api
      .get<Supplier[]>("/api/suppliers?all=1")
      .then(setSuppliers)
      .catch(() => {});
  useEffect(() => {
    load();
  }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post("/api/suppliers", form);
      toast("Supplier added.");
      setForm({ ...empty });
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't add supplier.", "error");
    }
  }
  function startEdit(s: Supplier) {
    setEditingId(s.id);
    setEditForm({
      name: s.name,
      contactPerson: s.contactPerson ?? "",
      phone: s.phone ?? "",
      whatsapp: s.whatsapp ?? "",
      email: s.email ?? "",
      address: s.address ?? "",
      notes: s.notes ?? "",
    });
  }
  async function saveEdit(id: number) {
    try {
      await api.patch(`/api/suppliers/${id}`, editForm);
      toast("Supplier updated.");
      setEditingId(null);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't update supplier.", "error");
    }
  }
  async function toggleActive(s: Supplier) {
    await api.patch(`/api/suppliers/${s.id}`, { isActive: !s.isActive });
    load();
  }

  const field = "rounded-xl border border-oat px-3 py-2 text-sm font-normal";

  return (
    <div>
      <h1 className="font-display text-espresso text-3xl font-bold">Suppliers</h1>
      <p className="text-charcoal/60 mt-1 text-sm">The suppliers you buy stock from. Pick them when recording a restock.</p>

      {/* Add supplier */}
      <form onSubmit={add} className="mt-5 grid gap-2 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-3">
        <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Supplier name *" className={field} />
        <input
          value={form.contactPerson}
          onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
          placeholder="Contact person"
          className={field}
        />
        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className={field} />
        <input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="WhatsApp" className={field} />
        <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email (optional)" className={field} />
        <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Address (optional)" className={field} />
        <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes" className={`${field} sm:col-span-2`} />
        <button type="submit" className="bg-terracotta text-cream hover:bg-terracotta-dark rounded-full px-5 py-2 font-semibold">
          + Add supplier
        </button>
      </form>

      {/* List */}
      <div className="mt-4 space-y-2">
        {suppliers.map((s) => (
          <div key={s.id} className={`rounded-2xl bg-white p-4 shadow-sm ${s.isActive ? "" : "opacity-50"}`}>
            {editingId === s.id ? (
              <div className="grid gap-2 sm:grid-cols-3">
                <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="Name" className={field} />
                <input
                  value={editForm.contactPerson}
                  onChange={(e) => setEditForm({ ...editForm, contactPerson: e.target.value })}
                  placeholder="Contact person"
                  className={field}
                />
                <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="Phone" className={field} />
                <input
                  value={editForm.whatsapp}
                  onChange={(e) => setEditForm({ ...editForm, whatsapp: e.target.value })}
                  placeholder="WhatsApp"
                  className={field}
                />
                <input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} placeholder="Email" className={field} />
                <input
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  placeholder="Address"
                  className={field}
                />
                <input
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  placeholder="Notes"
                  className={`${field} sm:col-span-2`}
                />
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(s.id)} className="bg-terracotta text-cream rounded-full px-4 py-1.5 text-sm font-semibold">
                    Save
                  </button>
                  <button onClick={() => setEditingId(null)} className="bg-oat rounded-full px-4 py-1.5 text-sm font-semibold">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1">
                  <p className="text-espresso font-semibold">
                    {s.name} {!s.isActive && <span className="text-charcoal/40 ml-1 text-xs">(inactive)</span>}
                  </p>
                  <p className="text-charcoal/55 text-xs">
                    {[s.contactPerson, s.phone && `📞 ${s.phone}`, s.whatsapp && `💬 ${s.whatsapp}`, s.email].filter(Boolean).join(" · ") ||
                      "No contact details"}
                  </p>
                  {(s.address || s.notes) && <p className="text-charcoal/45 mt-0.5 text-xs">{[s.address, s.notes].filter(Boolean).join(" · ")}</p>}
                </div>
                <button onClick={() => startEdit(s)} className="bg-oat hover:bg-espresso hover:text-cream rounded-full px-3 py-1 text-xs font-semibold">
                  Edit
                </button>
                <button onClick={() => toggleActive(s)} className="bg-oat hover:bg-espresso hover:text-cream rounded-full px-3 py-1 text-xs font-semibold">
                  {s.isActive ? "Deactivate" : "Activate"}
                </button>
              </div>
            )}
          </div>
        ))}
        {suppliers.length === 0 && <p className="text-charcoal/50 rounded-2xl bg-white p-6 text-center shadow-sm">No suppliers yet — add one above.</p>}
      </div>
    </div>
  );
}
