import { useEffect, useMemo, useState } from "react";
import { useToast } from "../context/ToastContext";
import { api, money } from "../lib/api";

type Row = { menuItemId: number; name: string; subcategory: string; price: number; availableToday: boolean; made: number; sold: number; remaining: number; tracked: boolean };
type Data = { date: string; today: string; rows: Row[]; summary: { made: number; sold: number; remaining: number; revenue: number } };

const SUB_ORDER = ["Regular", "Advanced", "Special", "Creation", "Other"];

export function AdminHansonProduction() {
  const toast = useToast();
  const today = new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [data, setData] = useState<Data | null>(null);
  const [made, setMade] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  const load = (d: string) =>
    api.get<Data>(`/api/doughnuts/production?date=${d}`).then((r) => {
      setData(r);
      setMade(Object.fromEntries(r.rows.map((x) => [x.menuItemId, String(x.made)])));
    }).catch(() => {});
  useEffect(() => { load(date); }, [date]);

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
          <p className="mt-1 text-sm text-charcoal/60">Enter how many of each doughnut were made {isToday ? "today" : `on ${date}`}. Sales deduct automatically; 0 remaining = sold out.</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className="rounded-xl border border-oat px-3 py-2 text-sm" />
          <button onClick={save} disabled={saving} className="rounded-full bg-terracotta px-5 py-2 font-semibold text-cream hover:bg-terracotta-dark disabled:opacity-60">{saving ? "Saving…" : "Save production"}</button>
        </div>
      </div>

      {data && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Made" value={liveMade} />
          <Stat label="Sold" value={data.summary.sold} />
          <Stat label="Remaining" value={data.summary.remaining} />
          <Stat label="Revenue" value={money(data.summary.revenue)} />
        </div>
      )}

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
                    <input value={made[r.menuItemId] ?? ""} onChange={(e) => setMade({ ...made, [r.menuItemId]: e.target.value.replace(/[^0-9]/g, "") })} inputMode="numeric" className="w-16 rounded-lg border border-oat px-2 py-1 text-center text-sm" placeholder="0" />
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
