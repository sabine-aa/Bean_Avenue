import { useEffect, useMemo, useState } from "react";
import { useToast } from "../context/ToastContext";
import { api, formatDate, formatDateTime } from "../lib/api";
import type { AdminBirthdayVoucher, BirthdaySettings, BirthdayVoucherStatus, MenuItem, UpcomingBirthday } from "../types";

const STATUS_CLS: Record<BirthdayVoucherStatus, string> = {
  AVAILABLE: "bg-sage/20 text-sage-dark",
  USED: "bg-oat text-charcoal/60",
  EXPIRED: "bg-charcoal/15 text-charcoal/60",
  CANCELLED: "bg-terracotta/15 text-terracotta-dark",
};

const vStatus = (v: AdminBirthdayVoucher) => v.effectiveStatus ?? v.status;
const fmtBday = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric" });

export function AdminBirthdayRewards() {
  const toast = useToast();
  const [settings, setSettings] = useState<BirthdaySettings | null>(null);
  const [vouchers, setVouchers] = useState<AdminBirthdayVoucher[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingBirthday[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [itemSearch, setItemSearch] = useState("");

  const loadVouchers = () => api.get<AdminBirthdayVoucher[]>("/api/birthday/vouchers").then(setVouchers);
  const loadUpcoming = () => api.get<UpcomingBirthday[]>("/api/birthday/upcoming").then(setUpcoming);

  useEffect(() => {
    api.get<BirthdaySettings>("/api/birthday/settings").then(setSettings);
    api
      .get<MenuItem[]>("/api/menu?all=1")
      .then(setMenu)
      .catch(() => {});
    loadVouchers();
    loadUpcoming();
  }, []);

  const categories = useMemo(() => Array.from(new Set(menu.map((m) => m.category))).sort(), [menu]);
  const filteredItems = useMemo(() => {
    const q = itemSearch.toLowerCase();
    return menu
      .filter((m) => !settings?.eligibleCategory || m.category === settings.eligibleCategory)
      .filter((m) => !q || m.name.toLowerCase().includes(q))
      .slice(0, 40);
  }, [menu, itemSearch, settings?.eligibleCategory]);

  if (!settings) return <p className="text-charcoal/60">Loading…</p>;

  async function saveSettings() {
    try {
      const saved = await api.post<BirthdaySettings>("/api/birthday/settings", settings);
      setSettings(saved);
      toast("Birthday program settings saved.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save.", "error");
    }
  }

  function patchSettings(p: Partial<BirthdaySettings>) {
    setSettings((s) => (s ? { ...s, ...p } : s));
  }

  function toggleItem(id: number) {
    setSettings((s) => {
      if (!s) return s;
      const has = s.eligibleItemIds.includes(id);
      return { ...s, eligibleItemIds: has ? s.eligibleItemIds.filter((x) => x !== id) : [...s.eligibleItemIds, id] };
    });
  }

  async function setVoucherStatus(v: AdminBirthdayVoucher, status: BirthdayVoucherStatus) {
    let usedBy: string | undefined;
    if (status === "USED") {
      usedBy = window.prompt("Staff name (who is giving the cupcake)?") ?? undefined;
      if (usedBy === undefined) return; // cancelled the prompt
    } else if (status === "CANCELLED" && !confirm(`Cancel voucher ${v.code}?`)) {
      return;
    }
    try {
      await api.patch(`/api/birthday/vouchers/${v.id}`, { status, usedBy });
      toast(status === "USED" ? "Marked used." : status === "CANCELLED" ? "Voucher cancelled." : "Voucher restored.");
      loadVouchers();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't update.", "error");
    }
  }

  async function issueFor(customerId: number, name: string) {
    if (!confirm(`Issue a birthday voucher to ${name}?`)) return;
    try {
      await api.post("/api/birthday/issue", { customerId });
      toast(`Birthday voucher issued to ${name}.`);
      loadVouchers();
      loadUpcoming();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't issue.", "error");
    }
  }

  const field = "mt-1 w-full rounded-lg border border-oat px-3 py-2 font-normal";

  return (
    <div>
      <h1 className="font-display text-espresso text-3xl font-bold">Birthday Rewards</h1>
      <p className="text-charcoal/60 mt-1 text-sm">
        One free cupcake per customer each year, around their birthday. Customers claim a voucher; staff mark it used at the counter.
      </p>

      {/* ---- Settings ---- */}
      <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-espresso text-xl font-bold">Program settings</h2>
          <label className="text-espresso flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={settings.enabled} onChange={(e) => patchSettings({ enabled: e.target.checked })} />
            {settings.enabled ? "Enabled" : "Disabled"}
          </label>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-espresso text-sm font-semibold">
            Reward name
            <input value={settings.rewardName} onChange={(e) => patchSettings({ rewardName: e.target.value })} className={field} />
          </label>
          <label className="text-espresso text-sm font-semibold">
            Days before birthday
            <input
              type="number"
              min={0}
              value={settings.daysBefore}
              onChange={(e) => patchSettings({ daysBefore: Number(e.target.value) })}
              className={field}
            />
          </label>
          <label className="text-espresso text-sm font-semibold">
            Days after birthday
            <input type="number" min={0} value={settings.daysAfter} onChange={(e) => patchSettings({ daysAfter: Number(e.target.value) })} className={field} />
          </label>
          <label className="text-espresso text-sm font-semibold">
            Beans to deduct <span className="text-charcoal/50 font-normal">(0 = free)</span>
            <input
              type="number"
              min={0}
              value={settings.deductBeans}
              onChange={(e) => patchSettings({ deductBeans: Number(e.target.value) })}
              className={field}
            />
          </label>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <label className="text-espresso text-sm font-semibold">
            Eligible category <span className="text-charcoal/50 font-normal">(blank = any)</span>
            <input
              value={settings.eligibleCategory}
              onChange={(e) => patchSettings({ eligibleCategory: e.target.value })}
              className={field}
              list="bday-cats"
              placeholder="e.g. Desserts"
            />
            <datalist id="bday-cats">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <div className="text-espresso text-sm font-semibold">
            Specific eligible cupcakes <span className="text-charcoal/50 font-normal">(none = any in the category)</span>
            <input value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} placeholder="Search items…" className={field} />
            <div className="border-oat mt-2 max-h-40 overflow-y-auto rounded-lg border p-2 font-normal">
              {filteredItems.map((m) => (
                <label key={m.id} className="hover:bg-oat/40 flex items-center gap-2 rounded px-1 py-0.5 text-sm">
                  <input type="checkbox" checked={settings.eligibleItemIds.includes(m.id)} onChange={() => toggleItem(m.id)} />
                  {m.name} <span className="text-charcoal/40 text-xs">· {m.category}</span>
                </label>
              ))}
              {filteredItems.length === 0 && <p className="text-charcoal/40 text-xs">No items match.</p>}
            </div>
            {settings.eligibleItemIds.length > 0 && <p className="text-charcoal/50 mt-1 text-xs">{settings.eligibleItemIds.length} item(s) selected</p>}
          </div>
        </div>

        <button onClick={saveSettings} className="bg-espresso text-cream hover:bg-mocha mt-5 rounded-full px-6 py-2 font-semibold">
          Save settings
        </button>
      </section>

      {/* ---- Upcoming birthdays ---- */}
      <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="font-display text-espresso text-xl font-bold">Upcoming birthdays</h2>
        {upcoming.length === 0 ? (
          <p className="text-charcoal/60 mt-3 text-sm">No customers have added a birthday yet.</p>
        ) : (
          <ul className="divide-oat mt-3 divide-y">
            {upcoming.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <p className="text-espresso font-semibold">{c.name || "Customer"}</p>
                  <p className="text-charcoal/50 text-xs">
                    🎂 {fmtBday(c.birthday)} · {c.phone || c.email || "no contact"} ·{" "}
                    {c.daysUntil === 0 ? "today!" : `in ${c.daysUntil} day${c.daysUntil === 1 ? "" : "s"}`}
                  </p>
                </div>
                {c.claimedThisYear ? (
                  <span className="bg-oat text-charcoal/50 rounded-full px-3 py-1 text-xs font-semibold">Voucher issued</span>
                ) : (
                  <button
                    onClick={() => issueFor(c.id, c.name || "Customer")}
                    className="bg-oat text-espresso hover:bg-espresso hover:text-cream rounded-full px-4 py-1.5 text-xs font-semibold"
                  >
                    Issue voucher
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- Issued vouchers ---- */}
      <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="font-display text-espresso text-xl font-bold">Issued vouchers</h2>
        {vouchers.length === 0 ? (
          <p className="text-charcoal/60 mt-3 text-sm">No birthday vouchers issued yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {vouchers.map((v) => {
              const st = vStatus(v);
              return (
                <div key={v.id} className="border-oat flex flex-wrap items-center gap-3 rounded-xl border p-3">
                  <div className="min-w-[12rem] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-espresso font-mono font-bold">{v.code}</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLS[st]}`}>{st}</span>
                      {v.issuedByAdmin && <span className="bg-sage/15 text-sage-dark rounded-full px-2 py-0.5 text-xs font-semibold">manual</span>}
                    </div>
                    <p className="text-charcoal/60 text-xs">
                      {v.customer?.name || v.customerName} · {v.customer?.phone || v.phone || v.customer?.email || v.email || "—"}
                    </p>
                    <p className="text-charcoal/45 text-xs">
                      Issued {formatDate(v.issuedAt)} · expires {formatDate(v.expiresAt)}
                      {v.usedAt && ` · used ${formatDateTime(v.usedAt)}${v.usedBy ? ` by ${v.usedBy}` : ""}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    {st === "AVAILABLE" && (
                      <>
                        <button
                          onClick={() => setVoucherStatus(v, "USED")}
                          className="bg-espresso text-cream hover:bg-mocha rounded-full px-3 py-1 font-semibold"
                        >
                          Mark used
                        </button>
                        <button
                          onClick={() => setVoucherStatus(v, "CANCELLED")}
                          className="bg-terracotta/15 text-terracotta-dark hover:bg-terracotta hover:text-cream rounded-full px-3 py-1 font-semibold"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    {(st === "USED" || st === "CANCELLED") && (
                      <button
                        onClick={() => setVoucherStatus(v, "AVAILABLE")}
                        className="bg-oat hover:bg-espresso hover:text-cream rounded-full px-3 py-1 font-semibold"
                      >
                        Restore
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
