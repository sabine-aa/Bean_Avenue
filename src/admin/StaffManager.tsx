import { FormEvent, useEffect, useState } from "react";
import { useToast } from "../context/ToastContext";
import { api, money } from "../lib/api";

type Staff = { id: number; name: string; role: string; isActive: boolean };
type ShiftReport = {
  id: number; staffName: string; status: string; openingFloat: number; cashPayIns: number; cashPayOuts: number;
  countedCash: number | null; expectedCash: number | null; difference: number | null; openedAt: string; closedAt: string | null;
  salesCount: number; cashSales: number; cardSales: number;
};

export function AdminStaff() {
  const toast = useToast();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [shifts, setShifts] = useState<ShiftReport[]>([]);
  const [form, setForm] = useState({ name: "", pin: "", role: "CASHIER" });

  const load = () => {
    api.get<Staff[]>("/api/staff").then(setStaff).catch(() => {});
    api.get<ShiftReport[]>("/api/staff/shifts").then(setShifts).catch(() => {});
  };
  useEffect(load, []);

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
      <h1 className="font-display text-3xl font-bold text-espresso">Register Staff</h1>
      <p className="mt-1 text-sm text-charcoal/60">Cashiers sign into the register (/pos) with a PIN. Manage them here and review shift reports.</p>

      {/* Add staff */}
      <form onSubmit={add} className="mt-5 flex flex-wrap items-end gap-2 rounded-2xl bg-white p-4 shadow-sm">
        <label className="text-sm font-semibold text-espresso">
          Name
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 block w-40 rounded-xl border border-oat px-3 py-2 font-normal" />
        </label>
        <label className="text-sm font-semibold text-espresso">
          PIN (4–6 digits)
          <input required value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "").slice(0, 6) })} inputMode="numeric" className="mt-1 block w-32 rounded-xl border border-oat px-3 py-2 font-normal" />
        </label>
        <label className="text-sm font-semibold text-espresso">
          Role
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="mt-1 block rounded-xl border border-oat px-3 py-2 font-normal">
            <option value="CASHIER">Cashier</option>
            <option value="MANAGER">Manager</option>
          </select>
        </label>
        <button type="submit" className="rounded-full bg-terracotta px-5 py-2 font-semibold text-cream hover:bg-terracotta-dark">+ Add</button>
      </form>

      {/* Staff list */}
      <div className="mt-4 space-y-2">
        {staff.map((s) => (
          <div key={s.id} className={`flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ${s.isActive ? "" : "opacity-50"}`}>
            <div className="flex-1">
              <p className="font-semibold text-espresso">{s.name} <span className="ml-1 rounded-full bg-oat px-2 py-0.5 text-xs font-semibold text-charcoal/60">{s.role === "MANAGER" ? "Manager" : "Cashier"}</span></p>
            </div>
            <button onClick={() => setPin(s)} className="rounded-full bg-oat px-3 py-1 text-xs font-semibold hover:bg-espresso hover:text-cream">Set PIN</button>
            <button onClick={() => toggleActive(s)} className="rounded-full bg-oat px-3 py-1 text-xs font-semibold hover:bg-espresso hover:text-cream">{s.isActive ? "Deactivate" : "Activate"}</button>
            <button onClick={() => del(s)} className="rounded-full px-2 py-1 text-xs font-semibold text-charcoal/40 hover:text-terracotta">Delete</button>
          </div>
        ))}
        {staff.length === 0 && <p className="rounded-2xl bg-white p-6 text-center text-charcoal/50 shadow-sm">No staff yet — add one above.</p>}
      </div>

      {/* Shift Z-reports */}
      <h2 className="mt-8 font-display text-xl font-bold text-espresso">Shift reports</h2>
      <div className="mt-3 space-y-2">
        {shifts.map((sh) => (
          <div key={sh.id} className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-espresso">
                  {sh.staffName}
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${sh.status === "OPEN" ? "bg-sage/20 text-sage-dark" : "bg-oat text-charcoal/60"}`}>{sh.status === "OPEN" ? "Open" : "Closed"}</span>
                </p>
                <p className="text-xs text-charcoal/50">
                  {new Date(sh.openedAt).toLocaleString()}{sh.closedAt ? ` → ${new Date(sh.closedAt).toLocaleTimeString()}` : ""}
                </p>
              </div>
              <div className="text-right text-sm">
                <p className="font-bold text-terracotta">{sh.salesCount} sales · {money(sh.cashSales + sh.cardSales)}</p>
                <p className="text-xs text-charcoal/50">Cash {money(sh.cashSales)} · Card {money(sh.cardSales)}</p>
              </div>
            </div>
            {sh.status === "CLOSED" && (
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 border-t border-oat pt-2 text-xs text-charcoal/70">
                <span>Float {money(sh.openingFloat)}</span>
                <span>In/Out {money(sh.cashPayIns)}/{money(sh.cashPayOuts)}</span>
                <span>Expected {money(sh.expectedCash ?? 0)}</span>
                <span>Counted {money(sh.countedCash ?? 0)}</span>
                <span className={`font-bold ${(sh.difference ?? 0) === 0 ? "text-sage-dark" : "text-terracotta"}`}>
                  Difference {(sh.difference ?? 0) >= 0 ? "+" : ""}{money(sh.difference ?? 0)}
                </span>
              </div>
            )}
          </div>
        ))}
        {shifts.length === 0 && <p className="rounded-2xl bg-white p-6 text-center text-charcoal/50 shadow-sm">No shifts yet.</p>}
      </div>
    </div>
  );
}
