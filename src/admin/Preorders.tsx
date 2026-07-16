import { useEffect, useMemo, useState } from "react";
import { useToast } from "../context/ToastContext";
import { api, money } from "../lib/api";

type Preorder = {
  id: number;
  number: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  customerName: string;
  phone: string;
  notes: string | null;
  status: string;
  estimatedArrival: string | null;
  paymentStatus: string;
  createdBy: string | null;
  createdAt: string;
};

const STATUSES = ["NEW", "CONFIRMED", "ORDERED", "ARRIVED", "READY", "COMPLETED", "CANCELLED"];
const STATUS_LABEL: Record<string, string> = {
  NEW: "New",
  CONFIRMED: "Confirmed",
  ORDERED: "Ordered from supplier",
  ARRIVED: "Arrived",
  READY: "Ready for pickup",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};
const STATUS_STYLE: Record<string, string> = {
  NEW: "bg-[#5b3fd6]/15 text-[#5b3fd6]",
  CONFIRMED: "bg-sky-100 text-sky-700",
  ORDERED: "bg-amber-100 text-amber-700",
  ARRIVED: "bg-teal-100 text-teal-700",
  READY: "bg-sage/20 text-sage-dark",
  COMPLETED: "bg-oat text-charcoal/60",
  CANCELLED: "bg-terracotta/15 text-terracotta-dark",
};

export function AdminPreorders() {
  const toast = useToast();
  const [preorders, setPreorders] = useState<Preorder[]>([]);
  const [filter, setFilter] = useState("ALL");

  const load = () =>
    api
      .get<Preorder[]>("/api/shop/preorders")
      .then(setPreorders)
      .catch(() => {});
  useEffect(() => {
    load();
  }, []);

  async function update(p: Preorder, data: Partial<Preorder>) {
    try {
      await api.patch(`/api/shop/preorders/${p.id}`, data);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't update the preorder.", "error");
    }
  }
  async function setEta(p: Preorder) {
    const eta = window.prompt(`Estimated arrival for ${p.number}:`, p.estimatedArrival ?? "");
    if (eta === null) return;
    update(p, { estimatedArrival: eta });
  }

  const shown = useMemo(
    () =>
      filter === "ALL"
        ? preorders
        : filter === "OPEN"
          ? preorders.filter((p) => !["COMPLETED", "CANCELLED"].includes(p.status))
          : preorders.filter((p) => p.status === filter),
    [preorders, filter],
  );
  const openCount = preorders.filter((p) => !["COMPLETED", "CANCELLED"].includes(p.status)).length;

  return (
    <div>
      <h1 className="font-display text-espresso text-3xl font-bold">Preorders</h1>
      <p className="text-charcoal/60 mt-1 text-sm">Requests for machines & special items not kept in stock. {openCount} open.</p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {["ALL", "OPEN", ...STATUSES].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${filter === f ? "bg-espresso text-cream" : "bg-oat text-espresso hover:bg-espresso/10"}`}
          >
            {f === "ALL" ? "All" : f === "OPEN" ? "Open" : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {shown.map((p) => (
          <div key={p.id} className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-espresso font-semibold">
                  {p.number} · {p.productName}
                  {p.quantity > 1 ? ` ×${p.quantity}` : ""}
                </p>
                <p className="text-charcoal/60 text-sm">
                  {p.customerName} ·{" "}
                  <a href={`tel:${p.phone}`} className="text-terracotta hover:underline">
                    {p.phone}
                  </a>{" "}
                  · {money(p.total)}
                </p>
                <p className="text-charcoal/45 text-xs">
                  {new Date(p.createdAt).toLocaleString()}
                  {p.createdBy ? ` · via ${p.createdBy}` : ""}
                  {p.estimatedArrival ? ` · ETA ${p.estimatedArrival}` : ""}
                </p>
                {p.notes && <p className="text-charcoal/70 mt-1 text-xs">📝 {p.notes}</p>}
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[p.status] ?? "bg-oat"}`}>
                {STATUS_LABEL[p.status] ?? p.status}
              </span>
            </div>
            <div className="border-oat mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
              <select
                value={p.status}
                onChange={(e) => update(p, { status: e.target.value })}
                className="border-oat rounded-xl border px-3 py-1.5 text-sm font-semibold"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
              <select
                value={p.paymentStatus}
                onChange={(e) => update(p, { paymentStatus: e.target.value })}
                className="border-oat rounded-xl border px-3 py-1.5 text-sm"
              >
                <option value="UNPAID">Unpaid</option>
                <option value="DEPOSIT">Deposit paid</option>
                <option value="PAID">Paid</option>
              </select>
              <button onClick={() => setEta(p)} className="bg-oat hover:bg-espresso hover:text-cream rounded-full px-3 py-1.5 text-xs font-semibold">
                Set ETA
              </button>
              <a
                href={`https://wa.me/${p.phone.replace(/[^0-9]/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="bg-sage/20 text-sage-dark hover:bg-sage/30 rounded-full px-3 py-1.5 text-xs font-semibold"
              >
                💬 WhatsApp
              </a>
            </div>
          </div>
        ))}
        {shown.length === 0 && (
          <p className="text-charcoal/50 rounded-2xl bg-white p-6 text-center shadow-sm">No preorders{filter !== "ALL" ? " in this filter" : " yet"}.</p>
        )}
      </div>
    </div>
  );
}
