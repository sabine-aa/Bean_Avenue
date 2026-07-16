import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "../context/ToastContext";
import { api, formatDateTime } from "../lib/api";

type Entry = { id: number; staffId: number; staffName: string; clockIn: string; clockOut: string | null; minutes: number; open: boolean };
type Summary = { staffId: number; staffName: string; minutes: number; shifts: number; open: boolean };

const hm = (mins: number) => `${Math.floor(mins / 60)}h ${mins % 60}m`;
const dayKey = (iso: string) => new Date(iso).toISOString().slice(0, 10);
// Monday-based week start (YYYY-MM-DD) for weekly rollups.
function weekKey(iso: string) {
  const d = new Date(iso);
  const day = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

export function AdminTimesheets() {
  const toast = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const twoWeeksAgo = new Date(Date.now() - 13 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(twoWeeksAgo);
  const [to, setTo] = useState(today);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [summary, setSummary] = useState<Summary[]>([]);
  const [group, setGroup] = useState<"day" | "week">("day");

  const load = useCallback(async () => {
    const r = await api.get<{ entries: Entry[]; summary: Summary[] }>(`/api/staff/timesheets?from=${from}&to=${to}`);
    setEntries(r.entries);
    setSummary(r.summary);
  }, [from, to]);
  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  // Rollup minutes by (period, staff).
  const rollup = useMemo(() => {
    const map = new Map<string, { period: string; staffName: string; minutes: number }>();
    for (const e of entries) {
      const period = group === "day" ? dayKey(e.clockIn) : weekKey(e.clockIn);
      const key = `${period}|${e.staffId}`;
      const cur = map.get(key) ?? { period, staffName: e.staffName, minutes: 0 };
      cur.minutes += e.minutes;
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => (a.period < b.period ? 1 : a.period > b.period ? -1 : a.staffName.localeCompare(b.staffName)));
  }, [entries, group]);

  async function removeEntry(id: number) {
    if (!confirm("Remove this punch?")) return;
    await api.delete(`/api/staff/timesheets/${id}`);
    load();
    toast("Punch removed.");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-espresso text-3xl font-bold">Timesheets</h1>
        <div className="flex items-end gap-2 text-sm">
          <label className="text-espresso font-semibold">
            From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border-oat mt-1 block rounded-xl border bg-white px-3 py-2" />
          </label>
          <label className="text-espresso font-semibold">
            To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border-oat mt-1 block rounded-xl border bg-white px-3 py-2" />
          </label>
        </div>
      </div>

      {/* Per-staff totals */}
      <section>
        <h2 className="font-display text-espresso mb-2 text-xl font-bold">Hours per staff</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {summary.length === 0 && <p className="text-charcoal/50 text-sm">No punches in this range.</p>}
          {summary.map((s) => (
            <div key={s.staffId} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-espresso font-semibold">{s.staffName}</span>
                {s.open && <span className="bg-sage/20 text-sage-dark rounded-full px-2 py-0.5 text-xs font-bold">On the clock</span>}
              </div>
              <p className="text-terracotta mt-1 text-2xl font-bold">{hm(s.minutes)}</p>
              <p className="text-charcoal/50 text-xs">
                {s.shifts} shift{s.shifts === 1 ? "" : "s"}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Daily / weekly rollup */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-espresso text-xl font-bold">Totals</h2>
          <div className="bg-oat flex gap-1 rounded-full p-1 text-sm font-semibold">
            <button onClick={() => setGroup("day")} className={`rounded-full px-3 py-1 ${group === "day" ? "bg-espresso text-cream" : "text-charcoal/60"}`}>
              Daily
            </button>
            <button onClick={() => setGroup("week")} className={`rounded-full px-3 py-1 ${group === "week" ? "bg-espresso text-cream" : "text-charcoal/60"}`}>
              Weekly
            </button>
          </div>
        </div>
        <div className="space-y-1">
          {rollup.length === 0 && <p className="text-charcoal/50 text-sm">Nothing to show.</p>}
          {rollup.map((r, i) => (
            <div key={i} className="border-oat/60 flex items-center justify-between border-b py-1.5 text-sm last:border-0">
              <span>
                <span className="text-espresso font-semibold">{r.staffName}</span>{" "}
                <span className="text-charcoal/50">· {group === "week" ? `week of ${r.period}` : r.period}</span>
              </span>
              <span className="text-espresso font-semibold">{hm(r.minutes)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Raw punches */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="font-display text-espresso mb-3 text-xl font-bold">Punches</h2>
        <div className="space-y-1">
          {entries.map((e) => (
            <div key={e.id} className="border-oat/60 flex items-center justify-between gap-2 border-b py-1.5 text-sm last:border-0">
              <span className="min-w-0 truncate">
                <span className="text-espresso font-semibold">{e.staffName}</span>{" "}
                <span className="text-charcoal/50">
                  {formatDateTime(e.clockIn)} → {e.clockOut ? formatDateTime(e.clockOut) : <span className="text-sage-dark font-semibold">still in</span>}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="font-semibold">{hm(e.minutes)}</span>
                <button onClick={() => removeEntry(e.id)} className="text-charcoal/40 hover:text-terracotta text-xs">
                  ✕
                </button>
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
