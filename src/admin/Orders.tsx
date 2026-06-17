import { useEffect, useRef, useState } from "react";
import { ItemExtras } from "../components/ItemExtras";
import { useToast } from "../context/ToastContext";
import { api, formatDateTime, money } from "../lib/api";
import { ORDER_FLOW, ORDER_STATUS_META, statusLabel } from "../lib/orderStatus";
import type { Order, OrderStatus } from "../types";

const FLOW = ORDER_FLOW;

// "Accept order" reads better than "Mark Preparing" for a brand-new order.
const nextLabel = (from: OrderStatus, to: OrderStatus) =>
  from === "NEW" && to === "PREPARING" ? "Accept order" : `Mark ${statusLabel(to)}`;

function waitingLabel(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m ago`;
}

export function AdminOrders() {
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [, setTick] = useState(0); // forces the "waiting" clock to tick
  const knownIds = useRef<Set<number> | null>(null);

  async function load(filterStatus = status, filterSearch = search) {
    const params = new URLSearchParams();
    if (filterStatus !== "ALL") params.set("status", filterStatus);
    if (filterSearch) params.set("search", filterSearch);
    const data = await api.get<Order[]>(`/api/orders?${params}`);
    if (knownIds.current) {
      const fresh = data.filter((o) => !knownIds.current!.has(o.id) && o.status === "NEW");
      if (fresh.length > 0) toast(`🔔 ${fresh.length} new order${fresh.length > 1 ? "s" : ""}!`);
    }
    knownIds.current = new Set(data.map((o) => o.id));
    // Most urgent first: new orders on top, then newest.
    data.sort((a, b) => {
      if ((a.status === "NEW" ? 0 : 1) !== (b.status === "NEW" ? 0 : 1))
        return a.status === "NEW" ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    setOrders(data);
  }

  // Auto-refresh order data, and tick the waiting clock.
  useEffect(() => {
    load();
    const interval = setInterval(() => load(), 20_000);
    const clock = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => {
      clearInterval(interval);
      clearInterval(clock);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, search]);

  async function setOrderStatus(order: Order, next: OrderStatus, reason?: string) {
    try {
      await api.patch(`/api/orders/${order.id}/status`, { status: next, reason });
      setCancelId(null);
      setCancelReason("");
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't update.", "error");
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-espresso">Orders</h1>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {["ALL", ...FLOW, "CANCELLED"].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              status === s ? "bg-espresso text-cream" : "bg-white text-espresso shadow-sm"
            }`}
          >
            {s === "ALL" ? "All" : statusLabel(s as OrderStatus)}
          </button>
        ))}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or phone…"
          className="ml-auto w-full rounded-full border border-oat bg-white px-4 py-2 text-sm sm:w-60"
        />
      </div>

      <div className="mt-5 space-y-3">
        {orders.length === 0 && (
          <p className="rounded-xl bg-white p-6 text-center text-charcoal/60 shadow-sm">No orders here.</p>
        )}
        {orders.map((o) => {
          const nextStatus = FLOW[FLOW.indexOf(o.status) + 1];
          const isNew = o.status === "NEW";
          const active = o.status !== "PICKED_UP" && o.status !== "CANCELLED";
          const mins = Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 60000);
          return (
            <div
              key={o.id}
              className={`rounded-2xl bg-white p-4 shadow-sm sm:p-5 ${
                isNew ? "ring-2 ring-terracotta/50" : ""
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-espresso">
                    {isNew && (
                      <span className="rounded-full bg-terracotta px-2 py-0.5 text-xs font-bold text-cream">
                        NEW
                      </span>
                    )}
                    <span>{o.number}</span>
                    <span className="text-charcoal/70">· {o.customerName}</span>
                  </p>
                  <a href={`tel:${o.phone}`} className="text-sm font-semibold text-terracotta">
                    📞 {o.phone}
                  </a>
                  <ul className="mt-2 space-y-1 text-sm text-charcoal/80">
                    {o.items.map((i) => (
                      <li key={i.id}>
                        {i.quantity}× {i.name}
                        <ItemExtras
                          options={i.selectedOptions}
                          addons={i.addons}
                          instructions={i.specialInstructions}
                        />
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-charcoal/50">
                    Pickup: {o.pickupTime ?? "ASAP"} · 💵 Pay at counter · {formatDateTime(o.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-xl font-bold text-espresso">{money(o.total)}</p>
                  <span className={`mt-1 inline-block rounded-full px-3 py-0.5 text-xs font-bold ${ORDER_STATUS_META[o.status].badge}`}>
                    {ORDER_STATUS_META[o.status].icon} {ORDER_STATUS_META[o.status].label}
                  </span>
                  {active && (
                    <p className={`mt-1 text-xs font-semibold ${mins >= 15 ? "text-terracotta-dark" : "text-charcoal/50"}`}>
                      ⏱ waiting {waitingLabel(o.createdAt)}
                    </p>
                  )}
                </div>
              </div>

              {o.status === "CANCELLED" && o.cancelReason && (
                <p className="mt-3 rounded-lg bg-terracotta/10 px-3 py-2 text-xs text-terracotta-dark">
                  Cancelled: {o.cancelReason}
                </p>
              )}

              {active && (
                <div className="mt-3 border-t border-oat pt-3">
                  {cancelId === o.id ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        autoFocus
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="Reason for cancelling (required)…"
                        className="flex-1 rounded-full border border-oat px-4 py-2.5 text-sm"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => cancelReason.trim() && setOrderStatus(o, "CANCELLED", cancelReason.trim())}
                          disabled={!cancelReason.trim()}
                          className="flex-1 rounded-full bg-terracotta px-5 py-2.5 text-sm font-semibold text-cream disabled:opacity-50 sm:flex-none"
                        >
                          Confirm cancel
                        </button>
                        <button
                          onClick={() => {
                            setCancelId(null);
                            setCancelReason("");
                          }}
                          className="rounded-full bg-oat px-5 py-2.5 text-sm font-semibold text-espresso"
                        >
                          Back
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      {nextStatus && (
                        <button
                          onClick={() => setOrderStatus(o, nextStatus)}
                          className="btn-3d flex-1 rounded-full bg-espresso px-5 py-2.5 text-sm font-semibold text-cream hover:bg-mocha"
                        >
                          {nextLabel(o.status, nextStatus)}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setCancelId(o.id);
                          setCancelReason("");
                        }}
                        className="rounded-full border border-oat px-5 py-2.5 text-sm font-semibold text-charcoal/60 hover:border-terracotta hover:text-terracotta-dark sm:flex-none"
                      >
                        Cancel order
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
