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

  const load = () => api.get<Customer[]>(`/api/customers?search=${encodeURIComponent(search)}`).then(setCustomers);

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
    if (!adjustNote.trim()) {
      toast("Please add a reason for the adjustment.", "error");
      return;
    }
    try {
      await api.post(`/api/customers/${selected.id}/adjust-beans`, {
        amount: adjustAmount,
        note: adjustNote.trim(),
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
      <h1 className="font-display text-espresso text-3xl font-bold">Customers & Loyalty</h1>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search name or phone…"
        className="border-oat mt-4 w-full rounded-full border bg-white px-4 py-2 text-sm sm:w-72"
      />

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-oat text-charcoal/50 border-b text-left text-xs tracking-wide uppercase">
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
                  <td colSpan={5} className="text-charcoal/60 px-4 py-8 text-center">
                    No customers yet.
                  </td>
                </tr>
              )}
              {customers.map((c) => (
                <tr
                  key={c.id}
                  className={`border-oat/60 hover:bg-oat/30 cursor-pointer border-b ${selected?.id === c.id ? "bg-oat/40" : ""}`}
                  onClick={() => openDetail(c.id)}
                >
                  <td className="text-espresso px-4 py-3 font-semibold">
                    {c.name} {c.isVip && "⭐"}
                    {c.noShowCount > 0 && <span className="text-terracotta-dark ml-1 text-xs">({c.noShowCount} no-shows)</span>}
                  </td>
                  <td className="px-4 py-3">{c.phone}</td>
                  <td className="text-sage-dark px-4 py-3 font-semibold">{c.beanBalance}</td>
                  <td className="px-4 py-3">{c.tier}</td>
                  <td className="text-charcoal/50 px-4 py-3 text-xs">{c._count ? `${c._count.orders} orders · ${c._count.bookings} bookings` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selected ? (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-display text-espresso text-xl font-bold">
                  {selected.name} {selected.isVip && "⭐"}
                </h2>
                <p className="text-charcoal/60 text-sm">
                  {selected.phone} · joined {formatDate(selected.createdAt)}
                </p>
              </div>
              <button onClick={() => toggleVip(selected)} className="bg-oat hover:bg-espresso hover:text-cream rounded-full px-3 py-1 text-xs font-semibold">
                {selected.isVip ? "Remove VIP" : "Flag VIP"}
              </button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="bg-oat/50 rounded-xl p-3">
                <p className="font-display text-espresso text-2xl font-bold">{selected.beanBalance}</p>
                <p className="text-charcoal/60 text-xs">beans</p>
              </div>
              <div className="bg-oat/50 rounded-xl p-3">
                <p className="font-display text-espresso text-2xl font-bold">{selected.tier}</p>
                <p className="text-charcoal/60 text-xs">tier</p>
              </div>
              <div className="bg-oat/50 rounded-xl p-3">
                <p className="font-display text-espresso text-2xl font-bold">{money(selected.lifetimeValue ?? 0)}</p>
                <p className="text-charcoal/60 text-xs">lifetime value</p>
              </div>
            </div>

            <div className="border-oat mt-4 flex flex-wrap items-end gap-2 rounded-xl border p-3">
              <label className="text-espresso text-xs font-semibold">
                Adjust beans (±)
                <input
                  type="number"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(Number(e.target.value))}
                  className="border-oat mt-1 block w-28 rounded-lg border px-3 py-1.5 font-normal"
                />
              </label>
              <label className="text-espresso flex-1 text-xs font-semibold">
                Reason <span className="text-terracotta-dark">(required)</span>
                <input
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  placeholder="e.g. complaint goodwill / cancelled order"
                  className="border-oat mt-1 block w-full rounded-lg border px-3 py-1.5 font-normal"
                />
              </label>
              <button onClick={adjustBeans} className="bg-espresso text-cream hover:bg-mocha rounded-full px-4 py-1.5 text-sm font-semibold">
                Apply
              </button>
            </div>

            <h3 className="text-espresso mt-5 text-sm font-bold">Points history</h3>
            <ul className="mt-2 max-h-56 space-y-1.5 overflow-y-auto text-sm">
              {selected.transactions?.map((t) => (
                <li key={`t${t.id}`} className="bg-oat/30 flex justify-between gap-2 rounded-lg px-3 py-2">
                  <span>
                    {t.note ?? (t.type === "EARN" ? `Earned on ${t.refId ?? t.source}` : t.source)}
                    <span className="text-charcoal/50 block text-xs">
                      {formatDateTime(t.createdAt)} · balance {t.balanceAfter}
                    </span>
                  </span>
                  <span className={`font-bold ${t.amount > 0 ? "text-sage-dark" : "text-terracotta-dark"}`}>
                    {t.amount > 0 ? "+" : ""}
                    {t.amount}
                  </span>
                </li>
              ))}
              {!selected.transactions?.length && <li className="text-charcoal/60">No points activity yet.</li>}
            </ul>

            <h3 className="text-espresso mt-5 text-sm font-bold">Orders &amp; bookings</h3>
            <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto text-sm">
              {selected.orders?.map((o) => (
                <li key={`o${o.id}`} className="bg-oat/30 flex justify-between rounded-lg px-3 py-2">
                  <span>
                    🛍 {o.number} · {formatDateTime(o.createdAt)}
                  </span>
                  <span className="font-semibold">{money(o.total)}</span>
                </li>
              ))}
              {selected.bookings?.map((b) => (
                <li key={`b${b.id}`} className="bg-oat/30 flex justify-between rounded-lg px-3 py-2">
                  <span>
                    🚪 {b.number} · {b.room?.name} · {formatDateTime(b.startTime)}
                  </span>
                  <span className="font-semibold">{money(b.total)}</span>
                </li>
              ))}
              {!selected.orders?.length && !selected.bookings?.length && <li className="text-charcoal/60">No orders or bookings yet.</li>}
            </ul>
          </div>
        ) : (
          <p className="text-charcoal/60 rounded-2xl bg-white p-8 text-center shadow-sm">Select a customer to see their story.</p>
        )}
      </div>
    </div>
  );
}
