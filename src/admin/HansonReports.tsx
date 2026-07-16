import { useEffect, useState } from "react";
import { useToast } from "../context/ToastContext";
import { api, money } from "../lib/api";

type Doughnut = {
  menuItemId: number;
  name: string;
  subcategory: string;
  price: number;
  cost: number;
  made: number;
  sold: number;
  leftover: number;
  wasteQty: number;
  revenue: number;
  cogs: number;
  profit: number;
  wasteValue: number;
  wasteCost: number;
  sellThrough: number | null;
};
type Cat = { subcategory: string; made: number; sold: number; revenue: number; profit: number; wasteQty: number; wasteValue: number };
type Report = {
  from: string;
  to: string;
  totals: {
    made: number;
    sold: number;
    leftover: number;
    revenue: number;
    cogs: number;
    profit: number;
    wasteQty: number;
    wasteValue: number;
    wasteCost: number;
    sellThrough: number | null;
    days: number;
    hasCost: boolean;
  };
  byDoughnut: Doughnut[];
  byCategory: Cat[];
  bestSellers: Doughnut[];
  slowSellers: Doughnut[];
};
type CostRow = { menuItemId: number; name: string; subcategory: string; price: number; costPrice: number };

const daysAgo = (n: number) => new Date(Date.now() + 3 * 3600 * 1000 - n * 86400000).toISOString().slice(0, 10);

export function AdminHansonReports() {
  const toast = useToast();
  const [from, setFrom] = useState(daysAgo(6));
  const [to, setTo] = useState(daysAgo(0));
  const [r, setR] = useState<Report | null>(null);
  const [costOpen, setCostOpen] = useState(false);
  const [costs, setCosts] = useState<CostRow[]>([]);
  const [costEdits, setCostEdits] = useState<Record<number, string>>({});

  const loadReport = () =>
    api
      .get<Report>(`/api/doughnuts/reports?from=${from}&to=${to}`)
      .then(setR)
      .catch(() => {});
  useEffect(() => {
    loadReport();
  }, [from, to]);

  const preset = (days: number) => {
    setFrom(daysAgo(days - 1));
    setTo(daysAgo(0));
  };

  function openCosts() {
    api
      .get<CostRow[]>("/api/doughnuts/costs")
      .then((rows) => {
        setCosts(rows);
        setCostEdits(Object.fromEntries(rows.map((c) => [c.menuItemId, c.costPrice ? String(c.costPrice) : ""])));
        setCostOpen(true);
      })
      .catch(() => {});
  }
  async function saveCosts() {
    try {
      await api.post("/api/doughnuts/costs", { entries: costs.map((c) => ({ menuItemId: c.menuItemId, costPrice: Number(costEdits[c.menuItemId]) || 0 })) });
      toast("Costs saved.");
      setCostOpen(false);
      loadReport();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save costs.", "error");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-espresso text-3xl font-bold">🍩 Hanson Reports</h1>
          <p className="text-charcoal/60 mt-1 text-sm">Made vs sold, sell-through, revenue & waste — to plan how much to make.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[
            [1, "Today"],
            [7, "7d"],
            [30, "30d"],
          ].map(([d, l]) => (
            <button
              key={l}
              onClick={() => preset(d as number)}
              className="bg-oat hover:bg-espresso hover:text-cream rounded-full px-3 py-1.5 text-xs font-semibold"
            >
              {l}
            </button>
          ))}
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="border-oat rounded-xl border px-3 py-2 text-sm" />
          <span className="text-charcoal/40">→</span>
          <input type="date" value={to} max={daysAgo(0)} onChange={(e) => setTo(e.target.value)} className="border-oat rounded-xl border px-3 py-2 text-sm" />
          <button onClick={openCosts} className="bg-espresso text-cream hover:bg-mocha rounded-full px-4 py-2 text-sm font-semibold">
            💰 Costs
          </button>
        </div>
      </div>

      {!r ? (
        <p className="text-charcoal/50 mt-6">Loading…</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            <Stat label="Made" value={r.totals.made} />
            <Stat label="Sold" value={r.totals.sold} />
            <Stat label="Sell-through" value={r.totals.sellThrough != null ? `${r.totals.sellThrough}%` : "—"} />
            <Stat label="Revenue" value={money(r.totals.revenue)} accent />
            {r.totals.hasCost && <Stat label="Cost" value={money(r.totals.cogs)} />}
            {r.totals.hasCost && <Stat label="Profit" value={money(r.totals.profit)} accent={r.totals.profit >= 0} warn={r.totals.profit < 0} />}
            <Stat label="Wasted" value={r.totals.wasteQty} />
            <Stat label={r.totals.hasCost ? "Waste cost" : "Waste value"} value={money(r.totals.hasCost ? r.totals.wasteCost : r.totals.wasteValue)} warn />
          </div>
          {!r.totals.hasCost && <p className="text-charcoal/45 mt-1 text-xs">💡 Set each doughnut's cost (💰 Costs) to see profit and waste cost.</p>}
          <p className="text-charcoal/45 mt-1 text-xs">
            {r.from} → {r.to} · {r.totals.days} day{r.totals.days === 1 ? "" : "s"} with production
          </p>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <RankCard title="⭐ Best sellers" rows={r.bestSellers} kind="best" />
            <RankCard title="🐌 Slow sellers" rows={r.slowSellers} kind="slow" />
          </div>

          {/* Revenue by category */}
          <h2 className="font-display text-espresso mt-6 text-xl font-bold">Revenue by category</h2>
          <div className="mt-2 overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="border-oat text-charcoal/45 grid grid-cols-[1.4fr,auto,auto,auto,auto,auto] gap-3 border-b px-4 py-2 text-xs font-bold tracking-wide uppercase">
              <span>Category</span>
              <span className="text-center">Made</span>
              <span className="text-center">Sold</span>
              <span className="text-right">Revenue</span>
              <span className="text-right">Profit</span>
              <span className="text-right">Waste</span>
            </div>
            {r.byCategory.map((c) => (
              <div key={c.subcategory} className="border-oat/60 grid grid-cols-[1.4fr,auto,auto,auto,auto,auto] items-center gap-3 border-b px-4 py-2 text-sm">
                <span className="text-espresso font-semibold">{c.subcategory}</span>
                <span className="text-charcoal/60 text-center">{c.made}</span>
                <span className="text-charcoal/60 text-center">{c.sold}</span>
                <span className="text-terracotta text-right font-semibold">{money(c.revenue)}</span>
                <span
                  className={`text-right font-semibold ${!r.totals.hasCost ? "text-charcoal/30" : c.profit >= 0 ? "text-sage-dark" : "text-terracotta-dark"}`}
                >
                  {r.totals.hasCost ? money(c.profit) : "—"}
                </span>
                <span className="text-charcoal/50 text-right">{money(c.wasteValue)}</span>
              </div>
            ))}
            {r.byCategory.length === 0 && <p className="text-charcoal/50 p-6 text-center">No production in this range.</p>}
          </div>

          {/* Per-doughnut */}
          <h2 className="font-display text-espresso mt-6 text-xl font-bold">Every doughnut</h2>
          <div className="mt-2 overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="border-oat text-charcoal/45 hidden grid-cols-[2fr,auto,auto,auto,1.4fr,auto,auto] gap-3 border-b px-4 py-2 text-xs font-bold tracking-wide uppercase sm:grid">
              <span>Doughnut</span>
              <span className="text-center">Made</span>
              <span className="text-center">Sold</span>
              <span className="text-center">Left</span>
              <span>Sell-through</span>
              <span className="text-right">Revenue</span>
              <span className="text-right">Profit</span>
            </div>
            {r.byDoughnut.map((d) => (
              <div
                key={d.menuItemId}
                className="border-oat/60 grid grid-cols-[2fr,auto,auto,auto,1.4fr,auto,auto] items-center gap-3 border-b px-4 py-2 text-sm"
              >
                <span className="text-espresso font-semibold">
                  {d.name} <span className="text-charcoal/40 text-xs font-normal">{d.subcategory}</span>
                </span>
                <span className="text-charcoal/60 w-10 text-center">{d.made}</span>
                <span className="text-charcoal/60 w-10 text-center">{d.sold}</span>
                <span className={`w-10 text-center font-semibold ${d.leftover > 0 ? "text-terracotta-dark" : "text-sage-dark"}`}>{d.leftover}</span>
                <span className="flex items-center gap-2">
                  <span className="bg-oat h-2 flex-1 overflow-hidden rounded-full">
                    <span
                      className={`block h-full ${(d.sellThrough ?? 0) >= 80 ? "bg-sage" : (d.sellThrough ?? 0) >= 50 ? "bg-amber-400" : "bg-terracotta"}`}
                      style={{ width: `${d.sellThrough ?? 0}%` }}
                    />
                  </span>
                  <span className="text-charcoal/60 w-10 text-right text-xs font-semibold">{d.sellThrough != null ? `${d.sellThrough}%` : "—"}</span>
                </span>
                <span className="text-terracotta text-right font-semibold">{money(d.revenue)}</span>
                <span
                  className={`text-right font-semibold ${!r.totals.hasCost ? "text-charcoal/30" : d.profit >= 0 ? "text-sage-dark" : "text-terracotta-dark"}`}
                >
                  {r.totals.hasCost ? money(d.profit) : "—"}
                </span>
              </div>
            ))}
            {r.byDoughnut.length === 0 && <p className="text-charcoal/50 p-6 text-center">No production recorded in this range.</p>}
          </div>
        </>
      )}

      {costOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCostOpen(false)}>
          <div className="flex max-h-[88vh] w-full max-w-md flex-col rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-espresso text-xl font-bold">Doughnut costs</h2>
                <p className="text-charcoal/55 text-xs">What each doughnut costs to make — used for profit & waste cost.</p>
              </div>
              <button onClick={() => setCostOpen(false)} className="text-charcoal/40 hover:text-charcoal">
                ✕
              </button>
            </div>
            <div className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto">
              {costs.map((c) => (
                <div key={c.menuItemId} className="border-oat/50 flex items-center gap-2 border-b py-1.5 text-sm">
                  <span className="text-espresso flex-1 truncate font-semibold">{c.name}</span>
                  <span className="text-charcoal/40 text-xs">sells {money(c.price)}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-charcoal/40">$</span>
                    <input
                      value={costEdits[c.menuItemId] ?? ""}
                      onChange={(e) => setCostEdits({ ...costEdits, [c.menuItemId]: e.target.value.replace(/[^0-9.]/g, "") })}
                      inputMode="decimal"
                      placeholder="0.00"
                      className="border-oat w-20 rounded-lg border px-2 py-1 text-right text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setCostOpen(false)} className="border-oat text-charcoal/60 rounded-full border px-5 py-2 text-sm font-semibold">
                Cancel
              </button>
              <button onClick={saveCosts} className="bg-terracotta text-cream hover:bg-terracotta-dark rounded-full px-5 py-2 text-sm font-semibold">
                Save costs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RankCard({ title, rows, kind }: { title: string; rows: Doughnut[]; kind: "best" | "slow" }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <h3 className="font-display text-espresso text-lg font-bold">{title}</h3>
      <div className="mt-2 space-y-1.5">
        {rows.map((d, i) => (
          <div key={d.menuItemId} className="flex items-center gap-2 text-sm">
            <span className="text-charcoal/40 w-5">{i + 1}.</span>
            <span className="text-espresso flex-1 truncate font-semibold">{d.name}</span>
            <span className="text-charcoal/50">
              {d.sold}/{d.made}
            </span>
            <span className={`w-12 text-right font-semibold ${kind === "slow" ? "text-terracotta-dark" : "text-sage-dark"}`}>
              {d.sellThrough != null ? `${d.sellThrough}%` : "—"}
            </span>
          </div>
        ))}
        {rows.length === 0 && <p className="text-charcoal/40 text-sm">No data yet.</p>}
      </div>
    </div>
  );
}

function Stat({ label, value, accent, warn }: { label: string; value: number | string; accent?: boolean; warn?: boolean }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-charcoal/45 text-xs font-semibold tracking-wide uppercase">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ? "text-terracotta" : warn ? "text-terracotta-dark" : "text-espresso"}`}>{value}</p>
    </div>
  );
}
