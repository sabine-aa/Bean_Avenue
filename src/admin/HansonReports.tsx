import { useEffect, useState } from "react";
import { api, money } from "../lib/api";

type Doughnut = { menuItemId: number; name: string; subcategory: string; price: number; made: number; sold: number; leftover: number; wasteQty: number; revenue: number; wasteValue: number; sellThrough: number | null };
type Cat = { subcategory: string; made: number; sold: number; revenue: number; wasteQty: number; wasteValue: number };
type Report = {
  from: string; to: string;
  totals: { made: number; sold: number; leftover: number; revenue: number; wasteQty: number; wasteValue: number; sellThrough: number | null; days: number };
  byDoughnut: Doughnut[]; byCategory: Cat[]; bestSellers: Doughnut[]; slowSellers: Doughnut[];
};

const daysAgo = (n: number) => new Date(Date.now() + 3 * 3600 * 1000 - n * 86400000).toISOString().slice(0, 10);

export function AdminHansonReports() {
  const [from, setFrom] = useState(daysAgo(6));
  const [to, setTo] = useState(daysAgo(0));
  const [r, setR] = useState<Report | null>(null);

  useEffect(() => { api.get<Report>(`/api/doughnuts/reports?from=${from}&to=${to}`).then(setR).catch(() => {}); }, [from, to]);

  const preset = (days: number) => { setFrom(daysAgo(days - 1)); setTo(daysAgo(0)); };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-espresso">🍩 Hanson Reports</h1>
          <p className="mt-1 text-sm text-charcoal/60">Made vs sold, sell-through, revenue & waste — to plan how much to make.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[[1, "Today"], [7, "7d"], [30, "30d"]].map(([d, l]) => (
            <button key={l} onClick={() => preset(d as number)} className="rounded-full bg-oat px-3 py-1.5 text-xs font-semibold hover:bg-espresso hover:text-cream">{l}</button>
          ))}
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="rounded-xl border border-oat px-3 py-2 text-sm" />
          <span className="text-charcoal/40">→</span>
          <input type="date" value={to} max={daysAgo(0)} onChange={(e) => setTo(e.target.value)} className="rounded-xl border border-oat px-3 py-2 text-sm" />
        </div>
      </div>

      {!r ? <p className="mt-6 text-charcoal/50">Loading…</p> : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Made" value={r.totals.made} />
            <Stat label="Sold" value={r.totals.sold} />
            <Stat label="Sell-through" value={r.totals.sellThrough != null ? `${r.totals.sellThrough}%` : "—"} />
            <Stat label="Revenue" value={money(r.totals.revenue)} accent />
            <Stat label="Wasted" value={r.totals.wasteQty} />
            <Stat label="Waste value" value={money(r.totals.wasteValue)} warn />
          </div>
          <p className="mt-1 text-xs text-charcoal/45">{r.from} → {r.to} · {r.totals.days} day{r.totals.days === 1 ? "" : "s"} with production</p>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <RankCard title="⭐ Best sellers" rows={r.bestSellers} kind="best" />
            <RankCard title="🐌 Slow sellers" rows={r.slowSellers} kind="slow" />
          </div>

          {/* Revenue by category */}
          <h2 className="mt-6 font-display text-xl font-bold text-espresso">Revenue by category</h2>
          <div className="mt-2 overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="grid grid-cols-[1.4fr,auto,auto,auto,auto] gap-3 border-b border-oat px-4 py-2 text-xs font-bold uppercase tracking-wide text-charcoal/45">
              <span>Category</span><span className="text-center">Made</span><span className="text-center">Sold</span><span className="text-right">Revenue</span><span className="text-right">Waste</span>
            </div>
            {r.byCategory.map((c) => (
              <div key={c.subcategory} className="grid grid-cols-[1.4fr,auto,auto,auto,auto] items-center gap-3 border-b border-oat/60 px-4 py-2 text-sm">
                <span className="font-semibold text-espresso">{c.subcategory}</span>
                <span className="text-center text-charcoal/60">{c.made}</span>
                <span className="text-center text-charcoal/60">{c.sold}</span>
                <span className="text-right font-semibold text-terracotta">{money(c.revenue)}</span>
                <span className="text-right text-charcoal/50">{money(c.wasteValue)}</span>
              </div>
            ))}
            {r.byCategory.length === 0 && <p className="p-6 text-center text-charcoal/50">No production in this range.</p>}
          </div>

          {/* Per-doughnut */}
          <h2 className="mt-6 font-display text-xl font-bold text-espresso">Every doughnut</h2>
          <div className="mt-2 overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="hidden grid-cols-[2fr,auto,auto,auto,1.4fr,auto] gap-3 border-b border-oat px-4 py-2 text-xs font-bold uppercase tracking-wide text-charcoal/45 sm:grid">
              <span>Doughnut</span><span className="text-center">Made</span><span className="text-center">Sold</span><span className="text-center">Left</span><span>Sell-through</span><span className="text-right">Revenue</span>
            </div>
            {r.byDoughnut.map((d) => (
              <div key={d.menuItemId} className="grid grid-cols-[2fr,auto,auto,auto,1.4fr,auto] items-center gap-3 border-b border-oat/60 px-4 py-2 text-sm">
                <span className="font-semibold text-espresso">{d.name} <span className="text-xs font-normal text-charcoal/40">{d.subcategory}</span></span>
                <span className="w-10 text-center text-charcoal/60">{d.made}</span>
                <span className="w-10 text-center text-charcoal/60">{d.sold}</span>
                <span className={`w-10 text-center font-semibold ${d.leftover > 0 ? "text-terracotta-dark" : "text-sage-dark"}`}>{d.leftover}</span>
                <span className="flex items-center gap-2">
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-oat">
                    <span className={`block h-full ${(d.sellThrough ?? 0) >= 80 ? "bg-sage" : (d.sellThrough ?? 0) >= 50 ? "bg-amber-400" : "bg-terracotta"}`} style={{ width: `${d.sellThrough ?? 0}%` }} />
                  </span>
                  <span className="w-10 text-right text-xs font-semibold text-charcoal/60">{d.sellThrough != null ? `${d.sellThrough}%` : "—"}</span>
                </span>
                <span className="text-right font-semibold text-terracotta">{money(d.revenue)}</span>
              </div>
            ))}
            {r.byDoughnut.length === 0 && <p className="p-6 text-center text-charcoal/50">No production recorded in this range.</p>}
          </div>
        </>
      )}
    </div>
  );
}

function RankCard({ title, rows, kind }: { title: string; rows: Doughnut[]; kind: "best" | "slow" }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <h3 className="font-display text-lg font-bold text-espresso">{title}</h3>
      <div className="mt-2 space-y-1.5">
        {rows.map((d, i) => (
          <div key={d.menuItemId} className="flex items-center gap-2 text-sm">
            <span className="w-5 text-charcoal/40">{i + 1}.</span>
            <span className="flex-1 truncate font-semibold text-espresso">{d.name}</span>
            <span className="text-charcoal/50">{d.sold}/{d.made}</span>
            <span className={`w-12 text-right font-semibold ${kind === "slow" ? "text-terracotta-dark" : "text-sage-dark"}`}>{d.sellThrough != null ? `${d.sellThrough}%` : "—"}</span>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-charcoal/40">No data yet.</p>}
      </div>
    </div>
  );
}

function Stat({ label, value, accent, warn }: { label: string; value: number | string; accent?: boolean; warn?: boolean }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-charcoal/45">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ? "text-terracotta" : warn ? "text-terracotta-dark" : "text-espresso"}`}>{value}</p>
    </div>
  );
}
