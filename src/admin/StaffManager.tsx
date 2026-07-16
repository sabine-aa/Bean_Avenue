import { FormEvent, useEffect, useState } from "react";
import { useToast } from "../context/ToastContext";
import { api, money } from "../lib/api";

type Staff = { id: number; name: string; role: string; isActive: boolean };
type StaffTab = {
  staffId: number;
  staffName: string;
  total: number;
  count: number;
  orders: { id: number; number: string; total: number; createdAt: string; items: { name: string; quantity: number }[] }[];
};
type ShiftReport = {
  id: number;
  staffName: string;
  status: string;
  openingFloat: number;
  cashPayIns: number;
  cashPayOuts: number;
  countedCash: number | null;
  expectedCash: number | null;
  difference: number | null;
  openedAt: string;
  closedAt: string | null;
  salesCount: number;
  cashSales: number;
  cardSales: number;
};

export function AdminStaff() {
  const toast = useToast();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [shifts, setShifts] = useState<ShiftReport[]>([]);
  const [tabs, setTabs] = useState<StaffTab[]>([]);
  const [openTab, setOpenTab] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", pin: "", role: "CASHIER" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: "", role: "CASHIER" });

  const load = () => {
    api
      .get<Staff[]>("/api/staff")
      .then(setStaff)
      .catch(() => {});
    api
      .get<ShiftReport[]>("/api/staff/shifts")
      .then(setShifts)
      .catch(() => {});
    api
      .get<StaffTab[]>("/api/staff/tabs")
      .then(setTabs)
      .catch(() => {});
  };
  useEffect(load, []);

  async function settleTab(t: StaffTab) {
    if (!window.confirm(`Clear ${t.staffName}'s tab of ${money(t.total)}? This marks it as deducted from their salary.`)) return;
    try {
      await api.post(`/api/staff/${t.staffId}/settle-tab`, {});
      toast(`Settled ${t.staffName}'s tab.`);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't settle the tab.", "error");
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post("/api/staff", form);
      toast("Staff member added.");
      setForm({ name: "", pin: "", role: "CASHIER" });
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't add staff.", "error");
    }
  }
  function startEdit(s: Staff) {
    setEditingId(s.id);
    setEditForm({ name: s.name, role: s.role === "MANAGER" ? "MANAGER" : "CASHIER" });
  }
  function cancelEdit() {
    setEditingId(null);
  }
  async function saveEdit(s: Staff) {
    const name = editForm.name.trim();
    if (!name) return toast("Name is required.", "error");
    try {
      await api.patch(`/api/staff/${s.id}`, { name, role: editForm.role });
      toast("Staff member updated.");
      setEditingId(null);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't update staff.", "error");
    }
  }
  async function setPin(s: Staff) {
    const pin = window.prompt(`New PIN for ${s.name} (4–6 digits):`);
    if (!pin) return;
    try {
      await api.patch(`/api/staff/${s.id}`, { pin });
      toast("PIN updated.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't update PIN.", "error");
    }
  }
  async function toggleActive(s: Staff) {
    await api.patch(`/api/staff/${s.id}`, { isActive: !s.isActive });
    load();
  }
  async function del(s: Staff) {
    if (!window.confirm(`Remove ${s.name} from the register?`)) return;
    await api.delete(`/api/staff/${s.id}`);
    load();
  }

  return (
    <div>
      <h1 className="font-display text-espresso text-3xl font-bold">Register Staff</h1>
      <p className="text-charcoal/60 mt-1 text-sm">Baristas sign into the register (/pos) with a PIN. Manage them here and review shift reports.</p>

      {/* Add staff */}
      <form onSubmit={add} className="mt-5 flex flex-wrap items-end gap-2 rounded-2xl bg-white p-4 shadow-sm">
        <label className="text-espresso text-sm font-semibold">
          Name
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="border-oat mt-1 block w-40 rounded-xl border px-3 py-2 font-normal"
          />
        </label>
        <label className="text-espresso text-sm font-semibold">
          PIN (4–6 digits)
          <input
            required
            value={form.pin}
            onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "").slice(0, 6) })}
            inputMode="numeric"
            className="border-oat mt-1 block w-32 rounded-xl border px-3 py-2 font-normal"
          />
        </label>
        <label className="text-espresso text-sm font-semibold">
          Role
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="border-oat mt-1 block rounded-xl border px-3 py-2 font-normal"
          >
            <option value="CASHIER">Barista</option>
            <option value="MANAGER">Supervisor</option>
          </select>
        </label>
        <button type="submit" className="bg-terracotta text-cream hover:bg-terracotta-dark rounded-full px-5 py-2 font-semibold">
          + Add
        </button>
      </form>

      {/* Staff list */}
      <div className="mt-4 space-y-2">
        {staff.map((s) => (
          <div key={s.id} className={`flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ${s.isActive ? "" : "opacity-50"}`}>
            {editingId === s.id ? (
              <>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="border-oat text-espresso w-40 rounded-xl border px-3 py-1.5 text-sm font-semibold"
                />
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  className="border-oat rounded-xl border px-3 py-1.5 text-sm font-normal"
                >
                  <option value="CASHIER">Barista</option>
                  <option value="MANAGER">Supervisor</option>
                </select>
                <div className="flex-1" />
                <button onClick={() => saveEdit(s)} className="bg-terracotta text-cream hover:bg-terracotta-dark rounded-full px-3 py-1 text-xs font-semibold">
                  Save
                </button>
                <button onClick={cancelEdit} className="bg-oat hover:bg-espresso hover:text-cream rounded-full px-3 py-1 text-xs font-semibold">
                  Cancel
                </button>
              </>
            ) : (
              <>
                <div className="flex-1">
                  <p className="text-espresso font-semibold">
                    {s.name}{" "}
                    <span className="bg-oat text-charcoal/60 ml-1 rounded-full px-2 py-0.5 text-xs font-semibold">
                      {s.role === "MANAGER" ? "Supervisor" : "Barista"}
                    </span>
                  </p>
                </div>
                <button onClick={() => startEdit(s)} className="bg-oat hover:bg-espresso hover:text-cream rounded-full px-3 py-1 text-xs font-semibold">
                  Edit
                </button>
                <button onClick={() => setPin(s)} className="bg-oat hover:bg-espresso hover:text-cream rounded-full px-3 py-1 text-xs font-semibold">
                  Set PIN
                </button>
                <button onClick={() => toggleActive(s)} className="bg-oat hover:bg-espresso hover:text-cream rounded-full px-3 py-1 text-xs font-semibold">
                  {s.isActive ? "Deactivate" : "Activate"}
                </button>
                <button onClick={() => del(s)} className="text-charcoal/40 hover:text-terracotta rounded-full px-2 py-1 text-xs font-semibold">
                  Delete
                </button>
              </>
            )}
          </div>
        ))}
        {staff.length === 0 && <p className="text-charcoal/50 rounded-2xl bg-white p-6 text-center shadow-sm">No staff yet — add one above.</p>}
      </div>

      {/* Staff tabs — charge-to-salary purchases owed */}
      <div className="mt-8 flex items-baseline justify-between">
        <h2 className="font-display text-espresso text-xl font-bold">Staff tabs</h2>
        {tabs.length > 0 && <span className="text-terracotta text-sm font-semibold">{money(tabs.reduce((s, t) => s + t.total, 0))} owed</span>}
      </div>
      <p className="text-charcoal/60 mt-1 text-sm">Purchases staff charged to their salary. Settle a tab at payday to deduct it and reset the balance.</p>
      <div className="mt-3 space-y-2">
        {tabs.map((t) => (
          <div key={t.staffId} className="rounded-2xl bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={() => setOpenTab(openTab === t.staffId ? null : t.staffId)} className="flex-1 text-left">
                <p className="text-espresso font-semibold">
                  {t.staffName}{" "}
                  <span className="text-charcoal/50 ml-1 text-xs font-normal">
                    {t.count} purchase{t.count === 1 ? "" : "s"} · {openTab === t.staffId ? "hide" : "details"}
                  </span>
                </p>
              </button>
              <span className="text-terracotta font-bold">{money(t.total)}</span>
              <button onClick={() => settleTab(t)} className="bg-sage text-cream hover:bg-sage-dark rounded-full px-3 py-1 text-xs font-semibold">
                Settle
              </button>
            </div>
            {openTab === t.staffId && (
              <div className="border-oat mt-2 space-y-1 border-t pt-2 text-sm">
                {t.orders.map((o) => (
                  <div key={o.id} className="text-charcoal/70">
                    <div className="flex items-center justify-between">
                      <span className="text-charcoal/45 text-xs">
                        {o.number} · {new Date(o.createdAt).toLocaleString()}
                      </span>
                      <span className="font-semibold">{money(o.total)}</span>
                    </div>
                    <p className="text-charcoal/80">{o.items.map((it) => `${it.quantity}× ${it.name}`).join(", ") || "—"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {tabs.length === 0 && <p className="text-charcoal/50 rounded-2xl bg-white p-6 text-center shadow-sm">No open staff tabs.</p>}
      </div>

      {/* Shift Z-reports */}
      <h2 className="font-display text-espresso mt-8 text-xl font-bold">Shift reports</h2>
      <div className="mt-3 space-y-2">
        {shifts.map((sh) => (
          <div key={sh.id} className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-espresso font-semibold">
                  {sh.staffName}
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${sh.status === "OPEN" ? "bg-sage/20 text-sage-dark" : "bg-oat text-charcoal/60"}`}
                  >
                    {sh.status === "OPEN" ? "Open" : "Closed"}
                  </span>
                </p>
                <p className="text-charcoal/50 text-xs">
                  {new Date(sh.openedAt).toLocaleString()}
                  {sh.closedAt ? ` → ${new Date(sh.closedAt).toLocaleTimeString()}` : ""}
                </p>
              </div>
              <div className="text-right text-sm">
                <p className="text-terracotta font-bold">
                  {sh.salesCount} sales · {money(sh.cashSales + sh.cardSales)}
                </p>
                <p className="text-charcoal/50 text-xs">
                  Cash {money(sh.cashSales)} · Card {money(sh.cardSales)}
                </p>
              </div>
            </div>
            {sh.status === "CLOSED" && (
              <div className="border-oat text-charcoal/70 mt-2 flex flex-wrap gap-x-6 gap-y-1 border-t pt-2 text-xs">
                <span>Float {money(sh.openingFloat)}</span>
                <span>
                  In/Out {money(sh.cashPayIns)}/{money(sh.cashPayOuts)}
                </span>
                <span>Expected {money(sh.expectedCash ?? 0)}</span>
                <span>Counted {money(sh.countedCash ?? 0)}</span>
                <span className={`font-bold ${(sh.difference ?? 0) === 0 ? "text-sage-dark" : "text-terracotta"}`}>
                  Difference {(sh.difference ?? 0) >= 0 ? "+" : ""}
                  {money(sh.difference ?? 0)}
                </span>
              </div>
            )}
          </div>
        ))}
        {shifts.length === 0 && <p className="text-charcoal/50 rounded-2xl bg-white p-6 text-center shadow-sm">No shifts yet.</p>}
      </div>
    </div>
  );
}
