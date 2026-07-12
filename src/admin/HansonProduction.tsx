import { useEffect, useMemo, useState } from "react";
import { useToast } from "../context/ToastContext";
import { api, money } from "../lib/api";

type Row = { menuItemId: number; name: string; subcategory: string; price: number; availableToday: boolean; made: number; sold: number; remaining: number; leftover: number; wasted: number; leftoverAction: string | null; closed: boolean; revenue: number; tracked: boolean; suggested: number };
type Data = { date: string; today: string; dayClosed: boolean; rows: Row[]; summary: { made: number; sold: number; remaining: number; leftover: number; revenue: number; leftoverValue: number; wasteValue: number } };

const SUB_ORDER = ["Regular", "Advanced", "Special", "Creation", "Other"];
const LEFTOVER_LABEL: Record<string, string> = { WASTED: "Wasted", STAFF: "Kept for staff", DISCOUNTED: "Discounted", CARRIED: "Carried over" };

export function AdminHansonProduction() {
  const toast = useToast();
  const today = new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [data, setData] = useState<Data | null>(null);
  const [made, setMade] = useState<Record<number, string>>({});
  const [action, setAction] = useState<Record<number, string>>({});
  const [tab, setTab] = useState<"production" | "endofday">("production");
  const [saving, setSaving] = useState(false);

  const load = (d: string) =>
    api.get<Data>(`/api/doughnuts/production?date=${d}`).then((r) => {
      setData(r);
      setMade(Object.fromEntries(r.rows.map((x) => [x.menuItemId, String(x.made)])));
      setAction(Object.fromEntries(r.rows.map((x) => [x.menuItemId, x.leftoverAction ?? "WASTED"])));
    }).catch(() => {});
  useEffect(() => { load(date); }, [date]);

  async function closeDay() {
    if (!data || saving) return;
    if (!window.confirm("Close the day? This records each doughnut's leftover and how it was handled.")) return;
    setSaving(true);
    try {
      const entries = data.rows.filter((r) => r.tracked).map((r) => ({ menuItemId: r.menuItemId, leftoverAction: action[r.menuItemId] ?? "WASTED" }));
      await api.post("/api/doughnuts/production/close", { date, entries });
      toast("Day closed.");
      load(date);
    } catch (err) { toast(err instanceof Error ? err.message : "Couldn't close the day.", "error"); }
    finally { setSaving(false); }
  }
  async function reopenDay() {
    if (!window.confirm("Reopen the day for corrections?")) return;
    await api.post("/api/doughnuts/production/reopen", { date });
    toast("Day reopened.");
    load(date);
  }

  async function save() {
    if (!data || saving) return;
    setSaving(true);
    try {
      const entries = data.rows.map((r) => ({ menuItemId: r.menuItemId, made: Number(made[r.menuItemId]) || 0 }));
      await api.post("/api/doughnuts/production", { date, entries });
      toast("Production saved — that's today's available stock.");
      load(date);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save production.", "error");
    } finally {
      setSaving(false);
    }
  }
  const grouped = useMemo(() => {
    if (!data) return [] as { sub: string; rows: Row[] }[];
    const by = new Map<string, Row[]>();
    for (const r of data.rows) { const s = r.subcategory || "Other"; if (!by.has(s)) by.set(s, []); by.get(s)!.push(r); }
    return [...by.entries()].sort((a, b) => (SUB_ORDER.indexOf(a[0]) + 99) - (SUB_ORDER.indexOf(b[0]) + 99)).map(([sub, rows]) => ({ sub, rows }));
  }, [data]);

  const isToday = date === today;
  const liveMade = data ? data.rows.reduce((s, r) => s + (Number(made[r.menuItemId]) || 0), 0) : 0;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-espresso">🍩 Hanson Daily Production</h1>
          <p className="mt-1 text-sm text-charcoal/60">{tab === "production" ? `Enter how many of each doughnut were made ${isToday ? "today" : `on ${date}`}. Sales deduct automatically; 0 remaining = sold out.` : "End of day: record leftovers and how they were handled, then close the day."}</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className="rounded-xl border border-oat px-3 py-2 text-sm" />
          {tab === "production" ? (
            <>
              {data?.rows.some((r) => r.suggested > 0) && (
                <button onClick={() => data && setMade(Object.fromEntries(data.rows.map((r) => [r.menuItemId, r.suggested > 0 ? String(r.suggested) : (made[r.menuItemId] ?? "")])))} className="rounded-full bg-oat px-4 py-2 text-sm font-semibold hover:bg-espresso hover:text-cream">✨ Fill suggested</button>
              )}
              <button onClick={save} disabled={saving} className="rounded-full bg-terracotta px-5 py-2 font-semibold text-cream hover:bg-terracotta-dark disabled:opacity-60">{saving ? "Saving…" : "Save production"}</button>
            </>
          ) : data?.dayClosed ? (
            <button onClick={reopenDay} className="rounded-full border border-oat px-5 py-2 font-semibold text-espresso hover:bg-oat">Reopen day</button>
          ) : (
            <button onClick={closeDay} disabled={saving} className="rounded-full bg-espresso px-5 py-2 font-semibold text-cream hover:bg-mocha disabled:opacity-60">{saving ? "Closing…" : "Close day"}</button>
          )}
        </div>
      </div>

      <div className="mt-3 flex gap-1 rounded-full bg-oat p-1 sm:w-max">
        <button onClick={() => setTab("production")} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === "production" ? "bg-espresso text-cream" : "text-espresso"}`}>Production</button>
        <button onClick={() => setTab("endofday")} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === "endofday" ? "bg-espresso text-cream" : "text-espresso"}`}>End of Day{data?.dayClosed ? " · closed ✓" : ""}</button>
      </div>

      {data && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          <Stat label="Made" value={tab === "production" ? liveMade : data.summary.made} />
          <Stat label="Sold" value={data.summary.sold} />
          <Stat label={tab === "production" ? "Remaining" : "Leftover"} value={tab === "production" ? data.summary.remaining : data.summary.leftover} />
          <Stat label="Revenue" value={money(data.summary.revenue)} />
          {tab === "endofday" && <Stat label="Leftover value" value={money(data.summary.leftoverValue)} />}
        </div>
      )}

      {/* End of Day */}
      {tab === "endofday" && data && (
        <div className="mt-4 space-y-5">
          {data.dayClosed && <div className="rounded-2xl bg-sage/15 px-4 py-3 text-sm font-semibold text-sage-dark">✓ Day closed. Leftovers recorded below. Use “Reopen day” to correct.</div>}
          {grouped.map(({ sub, rows }) => {
            const tracked = rows.filter((r) => r.tracked);
            if (!tracked.length) return null;
            return (
              <div key={sub}>
                <h2 className="mb-1 font-display text-lg font-bold text-espresso">{sub}</h2>
                <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
                  <div className="hidden grid-cols-[2fr,auto,auto,auto,1.4fr,auto] gap-3 border-b border-oat px-4 py-2 text-xs font-bold uppercase tracking-wide text-charcoal/45 sm:grid">
                    <span>Doughnut</span><span className="text-center">Made</span><span className="text-center">Sold</span><span className="text-center">Left</span><span>Leftover handling</span><span className="text-right">Revenue</span>
                  </div>
                  {tracked.map((r) => (
                    <div key={r.menuItemId} className="grid grid-cols-[2fr,auto,auto,auto,1.4fr,auto] items-center gap-3 border-b border-oat/60 px-4 py-2">
                      <span className="font-semibold text-espresso">{r.name}</span>
                      <span className="w-12 text-center text-sm text-charcoal/60">{r.made}</span>
                      <span className="w-12 text-center text-sm text-charcoal/60">{r.sold}</span>
                      <span className={`w-12 text-center text-sm font-semibold ${r.leftover > 0 ? "text-terracotta-dark" : "text-sage-dark"}`}>{r.leftover}</span>
                      {r.leftover > 0 ? (
                        <select value={action[r.menuItemId] ?? "WASTED"} disabled={data.dayClosed} onChange={(e) => setAction({ ...action, [r.menuItemId]: e.target.value })} className="rounded-xl border border-oat px-2 py-1 text-sm disabled:bg-oat/40">
                          {Object.entries(LEFTOVER_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      ) : <span className="text-xs text-sage-dark">Sold out 🎉</span>}
                      <span className="text-right text-sm text-terracotta">{money(r.revenue)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {grouped.every((g) => !g.rows.some((r) => r.tracked)) && <p className="rounded-2xl bg-white p-6 text-center text-charcoal/50 shadow-sm">No production entered for {date} yet.</p>}
        </div>
      )}

      {/* Production */}
      {tab === "production" && (
      <div className="mt-4 space-y-5">
        {grouped.map(({ sub, rows }) => (
          <div key={sub}>
            <h2 className="mb-1 font-display text-lg font-bold text-espresso">{sub}</h2>
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <div className="hidden grid-cols-[2fr,auto,auto,auto,auto] gap-3 border-b border-oat px-4 py-2 text-xs font-bold uppercase tracking-wide text-charcoal/45 sm:grid">
                <span>Doughnut</span><span className="text-center">Made</span><span className="text-center">Sold</span><span className="text-center">Left</span><span className="text-right">Price</span>
              </div>
              {rows.map((r) => {
                const madeVal = Number(made[r.menuItemId]) || 0;
                const remaining = Math.max(0, madeVal - r.sold);
                const soldOut = madeVal > 0 && remaining <= 0;
                return (
                  <div key={r.menuItemId} className="grid grid-cols-[2fr,auto,auto,auto,auto] items-center gap-3 border-b border-oat/60 px-4 py-2">
                    <span className="font-semibold text-espresso">
                      {r.name}
                      {soldOut && <span className="ml-2 rounded-full bg-terracotta/15 px-2 py-0.5 text-[10px] font-semibold text-terracotta-dark">SOLD OUT</span>}
                    </span>
                    <div className="flex flex-col items-center">
                      <input value={made[r.menuItemId] ?? ""} onChange={(e) => setMade({ ...made, [r.menuItemId]: e.target.value.replace(/[^0-9]/g, "") })} inputMode="numeric" className="w-16 rounded-lg border border-oat px-2 py-1 text-center text-sm" placeholder="0" />
                      {r.suggested > 0 && <button onClick={() => setMade({ ...made, [r.menuItemId]: String(r.suggested) })} className="mt-0.5 text-[10px] font-semibold text-sage-dark hover:underline" title="Use suggested">sug {r.suggested}</button>}
                    </div>
                    <span className="w-12 text-center text-sm text-charcoal/60">{r.sold}</span>
                    <span className={`w-12 text-center text-sm font-semibold ${soldOut ? "text-terracotta-dark" : remaining <= 3 && madeVal > 0 ? "text-amber-600" : "text-sage-dark"}`}>{madeVal > 0 ? remaining : "—"}</span>
                    <span className="text-right text-sm text-terracotta">{money(r.price)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {!data && <p className="text-charcoal/50">Loading…</p>}
      </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-charcoal/45">{label}</p>
      <p className="mt-1 text-2xl font-bold text-espresso">{value}</p>
    </div>
  );
}
