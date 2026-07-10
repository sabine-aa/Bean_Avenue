import { useEffect, useState } from "react";
import { useToast } from "../context/ToastContext";
import { api, formatDateTime } from "../lib/api";

type Item = { id: number; name: string; category: string; inStock: boolean; trackStock: boolean; stockQty: number; lowStockAt: number };
type Summary = { tracked: number; out: number; low: number };
type Movement = { id: number; name: string; delta: number; balance: number; type: string; reason: string | null; staffName: string | null; createdAt: string };

const TYPE_LABEL: Record<string, string> = { SALE: "Sale", RECEIVE: "Received", WASTE: "Wastage", COUNT: "Recount", ADJUST: "Adjust", RESTORE: "Restored" };

export function AdminInventory() {
  const toast = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [moves, setMoves] = useState<Movement[]>([]);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    const [inv, mv] = await Promise.all([
      api.get<{ items: Item[]; summary: Summary }>("/api/inventory"),
      api.get<Movement[]>("/api/inventory/movements?limit=40"),
    ]);
    setItems(inv.items);
    setSummary(inv.summary);
    setMoves(mv);
  }
  useEffect(() => {
    load().catch(() => {});
  }, []);

  async function adjust(item: Item, type: "RECEIVE" | "WASTE" | "COUNT") {
    const verb = type === "RECEIVE" ? "Add how many" : type === "WASTE" ? "Remove how many (wastage)" : "Set count to";
    const raw = window.prompt(`${item.name} — ${verb}? (on hand: ${item.stockQty})`, "");
    if (raw === null) return;
    const amount = Math.round(Number(raw));
    if (!Number.isFinite(amount) || amount < 0) return toast("Enter a whole number.", "error");
    const reason = type === "WASTE" ? window.prompt("Reason (optional):", "") ?? undefined : undefined;
    setBusyId(item.id);
    try {
      await api.post(`/api/inventory/${item.id}/adjust`, { type, amount, reason });
      await load();
      toast("Stock updated.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't update stock.", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function setTracking(item: Item, trackStock: boolean) {
    setBusyId(item.id);
    try {
      await api.patch(`/api/inventory/${item.id}`, { trackStock });
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't update.", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function setThreshold(item: Item) {
    const raw = window.prompt(`Low-stock alert when ${item.name} drops to or below:`, String(item.lowStockAt));
    if (raw === null) return;
    const lowStockAt = Math.max(0, Math.round(Number(raw) || 0));
    setBusyId(item.id);
    try {
      await api.patch(`/api/inventory/${item.id}`, { lowStockAt });
      await load();
    } catch {
      toast("Couldn't update.", "error");
    } finally {
      setBusyId(null);
    }
  }

  const s = q.trim().toLowerCase();
  const filtered = items.filter((i) => s === "" || i.name.toLowerCase().includes(s) || i.category.toLowerCase().includes(s));
  const tracked = filtered.filter((i) => i.trackStock);
  const untracked = filtered.filter((i) => !i.trackStock);

  const stockState = (i: Item) => (i.stockQty <= 0 ? "out" : i.stockQty <= i.lowStockAt ? "low" : "ok");
  const badge = (i: Item) => {
    const st = stockState(i);
    const cls = st === "out" ? "bg-terracotta/15 text-terracotta-dark" : st === "low" ? "bg-amber-400/25 text-amber-800" : "bg-sage/20 text-sage-dark";
    return <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${cls}`}>{i.stockQty} {st === "out" ? "· out" : st === "low" ? "· low" : "in stock"}</span>;
  };

  const btn = "rounded-full border border-oat px-3 py-1.5 text-xs font-semibold text-espresso hover:bg-oat disabled:opacity-40";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold text-espresso">Inventory</h1>
        {summary && (
          <div className="flex gap-2 text-xs">
            <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">Tracked <b>{summary.tracked}</b></span>
            <span className="rounded-full bg-amber-400/20 px-3 py-1.5">Low <b>{summary.low}</b></span>
            <span className="rounded-full bg-terracotta/15 px-3 py-1.5">Out <b>{summary.out}</b></span>
          </div>
        )}
      </div>

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items…" className="w-full max-w-sm rounded-xl border border-oat bg-white px-4 py-2.5 text-sm" />

      {/* Tracked items */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="font-display text-xl font-bold text-espresso">Tracked stock</h2>
        <p className="mt-1 text-xs text-charcoal/50">These auto-deduct on every sale and hide themselves from the menu when they hit zero.</p>
        <div className="mt-4 space-y-2">
          {tracked.length === 0 && <p className="text-sm text-charcoal/50">No tracked items yet. Turn on tracking for a countable product below (pastries, bottled drinks, retail bags…).</p>}
          {tracked.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-oat px-4 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-semibold text-espresso">{i.name} {badge(i)}</p>
                <p className="text-xs text-charcoal/50">{i.category} · alert at ≤ {i.lowStockAt}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button disabled={busyId === i.id} onClick={() => adjust(i, "RECEIVE")} className={btn}>+ Receive</button>
                <button disabled={busyId === i.id} onClick={() => adjust(i, "WASTE")} className={btn}>− Waste</button>
                <button disabled={busyId === i.id} onClick={() => adjust(i, "COUNT")} className={btn}>Set count</button>
                <button disabled={busyId === i.id} onClick={() => setThreshold(i)} className={btn}>Alert level</button>
                <button disabled={busyId === i.id} onClick={() => setTracking(i, false)} className={`${btn} text-terracotta-dark`}>Stop tracking</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Untracked items — enable tracking */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="font-display text-xl font-bold text-espresso">Not tracked</h2>
        <p className="mt-1 text-xs text-charcoal/50">Made-to-order drinks usually don't need counting. Turn tracking on for anything with a finite daily count.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {untracked.map((i) => (
            <button key={i.id} disabled={busyId === i.id} onClick={() => setTracking(i, true)} className="rounded-full border border-oat px-3 py-1.5 text-xs font-semibold text-espresso hover:border-sage hover:bg-sage/10 disabled:opacity-40">
              + Track {i.name}
            </button>
          ))}
        </div>
      </section>

      {/* Recent movements */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="font-display text-xl font-bold text-espresso">Recent movements</h2>
        <div className="mt-3 space-y-1.5">
          {moves.length === 0 && <p className="text-sm text-charcoal/50">No stock movements yet.</p>}
          {moves.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-2 border-b border-oat/60 py-1.5 text-sm last:border-0">
              <span className="min-w-0 truncate">
                <span className={`font-semibold ${m.delta < 0 ? "text-terracotta-dark" : "text-sage-dark"}`}>{m.delta > 0 ? `+${m.delta}` : m.delta}</span>{" "}
                <span className="text-espresso">{m.name}</span>{" "}
                <span className="text-charcoal/40">· {TYPE_LABEL[m.type] ?? m.type}{m.reason ? ` (${m.reason})` : ""}</span>
              </span>
              <span className="shrink-0 text-xs text-charcoal/40">→ {m.balance} · {formatDateTime(m.createdAt)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
