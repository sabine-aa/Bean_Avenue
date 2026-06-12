import { useEffect, useState } from "react";
import { useToast } from "../context/ToastContext";
import { api, formatDate, formatDateTime, money } from "../lib/api";
import type { Customer } from "../types";

export function AdminCustomers() {
  const toast = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [adjustAmount, setAdjustAmount] = useState(0);
  const [adjustNote, setAdjustNote] = useState("");

  const load = () =>
    api.get<Customer[]>(`/api/customers?search=${encodeURIComponent(search)}`).then(setCustomers);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function openDetail(id: number) {
    setSelected(await api.get<Customer>(`/api/customers/${id}`));
    setAdjustAmount(0);
    setAdjustNote("");
  }

  async function adjustBeans() {
    if (!selected || !adjustAmount) return;
    try {
      await api.post(`/api/customers/${selected.id}/adjust-beans`, {
        amount: adjustAmount,
        note: adjustNote || undefined,
      });
      toast(`Beans adjusted by ${adjustAmount > 0 ? "+" : ""}${adjustAmount}.`);
      openDetail(selected.id);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't adjust.", "error");
    }
  }

  async function toggleVip(c: Customer) {
    await api.patch(`/api/customers/${c.id}`, { isVip: !c.isVip });
    toast(c.isVip ? "VIP removed." : "Flagged as VIP ⭐");
    if (selected?.id === c.id) openDetail(c.id);
    load();
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-espresso">Customers & Loyalty</h1>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search name or phone…"
        className="mt-4 w-full rounded-full border border-oat bg-white px-4 py-2 text-sm sm:w-72"
      />

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-oat text-left text-xs uppercase tracking-wide text-charcoal/50">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Beans</th>
                <th className="px-4 py-3">Tier</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-charcoal/60">
                    No customers yet.
                  </td>
                </tr>
              )}
              {customers.map((c) => (
                <tr
                  key={c.id}
                  className={`cursor-pointer border-b border-oat/60 hover:bg-oat/30 ${selected?.id === c.id ? "bg-oat/40" : ""}`}
                  onClick={() => openDetail(c.id)}
                >
                  <td className="px-4 py-3 font-semibold text-espresso">
                    {c.name} {c.isVip && "⭐"}
                    {c.noShowCount > 0 && (
                      <span className="ml-1 text-xs text-terracotta-dark">({c.noShowCount} no-shows)</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{c.phone}</td>
                  <td className="px-4 py-3 font-semibold text-sage-dark">{c.beanBalance}</td>
                  <td className="px-4 py-3">{c.tier}</td>
                  <td className="px-4 py-3 text-xs text-charcoal/50">
                    {c._count ? `${c._count.orders} orders · ${c._count.bookings} bookings` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selected ? (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-display text-xl font-bold text-espresso">
                  {selected.name} {selected.isVip && "⭐"}
                </h2>
                <p className="text-sm text-charcoal/60">
                  {selected.phone} · joined {formatDate(selected.createdAt)}
                </p>
              </div>
              <button
                onClick={() => toggleVip(selected)}
                className="rounded-full bg-oat px-3 py-1 text-xs font-semibold hover:bg-espresso hover:text-cream"
              >
                {selected.isVip ? "Remove VIP" : "Flag VIP"}
              </button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-oat/50 p-3">
                <p className="font-display text-2xl font-bold text-espresso">{selected.beanBalance}</p>
                <p className="text-xs text-charcoal/60">beans</p>
              </div>
              <div className="rounded-xl bg-oat/50 p-3">
                <p className="font-display text-2xl font-bold text-espresso">{selected.tier}</p>
                <p className="text-xs text-charcoal/60">tier</p>
              </div>
              <div className="rounded-xl bg-oat/50 p-3">
                <p className="font-display text-2xl font-bold text-espresso">
                  {money(selected.lifetimeValue ?? 0)}
                </p>
                <p className="text-xs text-charcoal/60">lifetime value</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-2 rounded-xl border border-oat p-3">
              <label className="text-xs font-semibold text-espresso">
                Adjust beans (±)
                <input
                  type="number"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(Number(e.target.value))}
                  className="mt-1 block w-28 rounded-lg border border-oat px-3 py-1.5 font-normal"
                />
              </label>
              <label className="flex-1 text-xs font-semibold text-espresso">
                Note
                <input
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  placeholder="e.g. spilled-drink apology"
                  className="mt-1 block w-full rounded-lg border border-oat px-3 py-1.5 font-normal"
                />
              </label>
              <button
                onClick={adjustBeans}
                className="rounded-full bg-espresso px-4 py-1.5 text-sm font-semibold text-cream hover:bg-mocha"
              >
                Apply
              </button>
            </div>

            <h3 className="mt-5 text-sm font-bold text-espresso">Recent activity</h3>
            <ul className="mt-2 max-h-64 space-y-1.5 overflow-y-auto text-sm">
              {selected.orders?.map((o) => (
                <li key={`o${o.id}`} className="flex justify-between rounded-lg bg-oat/30 px-3 py-2">
                  <span>🛍 {o.number} · {formatDateTime(o.createdAt)}</span>
                  <span className="font-semibold">{money(o.total)}</span>
                </li>
              ))}
              {selected.bookings?.map((b) => (
                <li key={`b${b.id}`} className="flex justify-between rounded-lg bg-oat/30 px-3 py-2">
                  <span>🚪 {b.number} · {b.room?.name} · {formatDateTime(b.startTime)}</span>
                  <span className="font-semibold">{money(b.total)}</span>
                </li>
              ))}
              {!selected.orders?.length && !selected.bookings?.length && (
                <li className="text-charcoal/60">No orders or bookings yet.</li>
              )}
            </ul>
          </div>
        ) : (
          <p className="rounded-2xl bg-white p-8 text-center text-charcoal/60 shadow-sm">
            Select a customer to see their story.
          </p>
        )}
      </div>
    </div>
  );
}
