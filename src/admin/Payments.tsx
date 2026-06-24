import { useEffect, useState } from "react";
import { useToast } from "../context/ToastContext";
import { api, formatDateTime, getToken, money } from "../lib/api";
import { paymentStatusMeta } from "../lib/orderStatus";
import type { Order, Payment } from "../types";

interface ActivityLog {
  id: number;
  actor: string;
  action: string;
  detail: string;
  createdAt: string;
}

interface Summary {
  onlinePaid: number;
  refunded: number;
  netOnline: number;
  cashDue: number;
  cashCollected: number;
  deliveryFees: number;
  failedCount: number;
}

const STATUSES = ["ALL", "PAID", "PENDING", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"];

export function AdminPayments() {
  const toast = useToast();
  const [tab, setTab] = useState<"transactions" | "cash" | "log">("transactions");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [cashDue, setCashDue] = useState<Order[]>([]);
  const [log, setLog] = useState<ActivityLog[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");

  async function loadTransactions() {
    const params = new URLSearchParams();
    if (status !== "ALL") params.set("status", status);
    if (search) params.set("search", search);
    setPayments(await api.get<Payment[]>(`/api/payments?${params}`));
  }

  async function loadCommon() {
    const [s, c, l] = await Promise.all([
      api.get<Summary>("/api/payments/summary"),
      api.get<Order[]>("/api/payments/cash-due"),
      api.get<ActivityLog[]>("/api/payments/log"),
    ]);
    setSummary(s);
    setCashDue(c);
    setLog(l);
  }

  useEffect(() => {
    loadCommon().catch(() => {});
  }, []);
  useEffect(() => {
    loadTransactions().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, search]);

  async function refund(p: Payment) {
    const remaining = Math.round((p.amount - p.refundedAmount) * 100) / 100;
    const raw = window.prompt(`Refund amount for ${p.transactionId} (max ${money(remaining)}). Leave as-is for a full refund.`, String(remaining));
    if (raw == null) return;
    const amount = Number(raw);
    if (!(amount > 0) || amount > remaining) return toast("Enter a valid refund amount.", "error");
    try {
      await api.post(`/api/payments/${p.id}/refund`, { amount });
      toast("Refund processed.");
      loadTransactions();
      loadCommon();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Refund failed.", "error");
    }
  }

  async function collectCash(o: Order) {
    try {
      await api.post(`/api/payments/order/${o.number}/collect-cash`, {});
      toast("Cash recorded.");
      loadCommon();
      loadTransactions();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't record.", "error");
    }
  }

  async function exportCsv() {
    try {
      const res = await fetch("/api/payments/export", { headers: { Authorization: `Bearer ${getToken()}` } });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "bean-avenue-payments.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast("Export failed.", "error");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold text-espresso">Payments</h1>
        <button onClick={exportCsv} className="rounded-full border border-oat bg-white px-5 py-2 text-sm font-semibold text-espresso hover:bg-oat">⬇ Export CSV</button>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Online paid" value={money(summary.onlinePaid)} />
          <Stat label="Refunded" value={money(summary.refunded)} />
          <Stat label="Net online" value={money(summary.netOnline)} />
          <Stat label="Cash due" value={money(summary.cashDue)} accent />
          <Stat label="Cash collected" value={money(summary.cashCollected)} />
          <Stat label="Failed" value={String(summary.failedCount)} />
        </div>
      )}

      <div className="flex gap-2">
        {(["transactions", "cash", "log"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === t ? "bg-espresso text-cream" : "bg-white text-espresso shadow-sm"}`}>
            {t === "transactions" ? "Transactions" : t === "cash" ? `Cash due (${cashDue.length})` : "Activity log"}
          </button>
        ))}
      </div>

      {tab === "transactions" && (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {STATUSES.map((s) => (
              <button key={s} onClick={() => setStatus(s)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${status === s ? "bg-espresso text-cream" : "bg-white text-espresso shadow-sm"}`}>
                {s === "ALL" ? "All" : paymentStatusMeta(s).label}
              </button>
            ))}
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order, customer, txn…" className="ml-auto w-full rounded-full border border-oat bg-white px-4 py-2 text-sm sm:w-60" />
          </div>

          <div className="mt-4 space-y-2">
            {payments.length === 0 && <p className="rounded-xl bg-white p-6 text-center text-charcoal/60 shadow-sm">No transactions.</p>}
            {payments.map((p) => {
              const canRefund = (p.status === "PAID" || p.status === "PARTIALLY_REFUNDED") && p.refundedAmount < p.amount;
              return (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm">
                  <div className="min-w-0">
                    <p className="font-semibold text-espresso">
                      {p.order?.number ?? "—"} · {p.order?.customerName ?? "—"}
                      <span className="ml-2 text-xs font-normal text-charcoal/50">{p.method === "CARD" ? `${p.cardBrand ?? "Card"} ****${p.cardLast4 ?? "????"}` : "Cash"}</span>
                    </p>
                    <p className="text-xs text-charcoal/50">{p.transactionId} · {p.provider} · {formatDateTime(p.createdAt)}</p>
                    {p.failureReason && <p className="text-xs text-terracotta-dark">{p.failureReason}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-display font-bold text-espresso">{money(p.amount)}</p>
                      {p.refundedAmount > 0 && <p className="text-xs text-blue-700">−{money(p.refundedAmount)} refunded</p>}
                    </div>
                    <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${paymentStatusMeta(p.status).badge}`}>{paymentStatusMeta(p.status).label}</span>
                    {canRefund && (
                      <button onClick={() => refund(p)} className="rounded-full border border-blue-300 px-4 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50">Refund</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "cash" && (
        <div className="space-y-2">
          {cashDue.length === 0 && <p className="rounded-xl bg-white p-6 text-center text-charcoal/60 shadow-sm">No cash payments due.</p>}
          {cashDue.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm">
              <div>
                <p className="font-semibold text-espresso">{o.fulfillment === "DELIVERY" ? "🛵" : "🏪"} {o.number} · {o.customerName}</p>
                <p className="text-xs text-charcoal/50">{o.phone} · {formatDateTime(o.createdAt)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-display font-bold text-espresso">{money(o.total)}</span>
                <button onClick={() => collectCash(o)} className="rounded-full border border-sage px-4 py-1.5 text-sm font-semibold text-sage-dark hover:bg-sage hover:text-cream">Mark collected</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "log" && (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          {log.length === 0 && <p className="p-6 text-center text-charcoal/60">No activity recorded yet.</p>}
          <ul className="divide-y divide-oat">
            {log.map((l) => (
              <li key={l.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>
                  <span className="font-semibold text-espresso">{l.action}</span> · {l.detail}
                  <span className="block text-xs text-charcoal/50">{l.actor} · {formatDateTime(l.createdAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl bg-white p-3 shadow-sm ${accent ? "ring-1 ring-amber-200" : ""}`}>
      <p className="text-xs text-charcoal/50">{label}</p>
      <p className="mt-0.5 font-display text-lg font-bold text-espresso">{value}</p>
    </div>
  );
}
