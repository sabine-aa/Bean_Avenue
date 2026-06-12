import { useEffect, useRef, useState } from "react";
import { useToast } from "../context/ToastContext";
import { api, formatDateTime, money } from "../lib/api";
import type { Order, OrderStatus } from "../types";

const FLOW: OrderStatus[] = ["NEW", "PREPARING", "READY", "PICKED_UP"];
const STATUS_STYLE: Record<OrderStatus, string> = {
  NEW: "bg-terracotta/15 text-terracotta-dark",
  PREPARING: "bg-oat text-mocha",
  READY: "bg-sage/25 text-sage-dark",
  PICKED_UP: "bg-oat/60 text-charcoal/60",
  CANCELLED: "bg-charcoal/10 text-charcoal/50",
};

export function AdminOrders() {
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const knownIds = useRef<Set<number> | null>(null);

  async function load(filterStatus = status, filterSearch = search) {
    const params = new URLSearchParams();
    if (filterStatus !== "ALL") params.set("status", filterStatus);
    if (filterSearch) params.set("search", filterSearch);
    const data = await api.get<Order[]>(`/api/orders?${params}`);
    // alert on brand-new orders
    if (knownIds.current) {
      const fresh = data.filter((o) => !knownIds.current!.has(o.id) && o.status === "NEW");
      if (fresh.length > 0) toast(`🔔 ${fresh.length} new order${fresh.length > 1 ? "s" : ""}!`);
    }
    knownIds.current = new Set(data.map((o) => o.id));
    setOrders(data);
  }

  useEffect(() => {
    load();
    const interval = setInterval(() => load(), 20_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, search]);

  async function setOrderStatus(order: Order, next: OrderStatus) {
    try {
      await api.patch(`/api/orders/${order.id}/status`, { status: next });
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
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              status === s ? "bg-espresso text-cream" : "bg-white text-espresso shadow-sm"
            }`}
          >
            {s.replace("_", " ")}
          </button>
        ))}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or phone…"
          className="ml-auto w-full rounded-full border border-oat bg-white px-4 py-1.5 text-sm sm:w-60"
        />
      </div>

      <div className="mt-5 space-y-3">
        {orders.length === 0 && (
          <p className="rounded-xl bg-white p-6 text-center text-charcoal/60 shadow-sm">
            No orders here.
          </p>
        )}
        {orders.map((o) => {
          const nextStatus = FLOW[FLOW.indexOf(o.status) + 1];
          return (
            <div key={o.id} className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-espresso">
                    {o.number} · {o.customerName}
                    <a href={`tel:${o.phone}`} className="ml-2 text-sm font-normal text-terracotta">
                      {o.phone}
                    </a>
                  </p>
                  <p className="mt-1 text-sm text-charcoal/70">
                    {o.items
                      .map(
                        (i) =>
                          `${i.quantity}× ${i.name}` +
                          (i.selectedOptions.length
                            ? ` (${i.selectedOptions.map((s) => s.choice).join(", ")})`
                            : "")
                      )
                      .join(" · ")}
                  </p>
                  <p className="mt-1 text-xs text-charcoal/50">
                    {formatDateTime(o.createdAt)} · Pickup: {o.pickupTime ?? "ASAP"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-xl font-bold text-espresso">{money(o.total)}</p>
                  <span className={`mt-1 inline-block rounded-full px-3 py-0.5 text-xs font-bold ${STATUS_STYLE[o.status]}`}>
                    {o.status.replace("_", " ")}
                  </span>
                </div>
              </div>
              {o.status !== "PICKED_UP" && o.status !== "CANCELLED" && (
                <div className="mt-3 flex gap-2 border-t border-oat pt-3">
                  {nextStatus && (
                    <button
                      onClick={() => setOrderStatus(o, nextStatus)}
                      className="rounded-full bg-espresso px-4 py-1.5 text-sm font-semibold text-cream hover:bg-mocha"
                    >
                      Mark {nextStatus.replace("_", " ")}
                    </button>
                  )}
                  <button
                    onClick={() => setOrderStatus(o, "CANCELLED")}
                    className="rounded-full px-4 py-1.5 text-sm font-semibold text-charcoal/50 hover:text-terracotta"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
