import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { isPosTokenValid, posApi } from "../lib/api";
import type { Order } from "../types";

const COLUMNS = [
  { key: "NEW", label: "New", statuses: ["RECEIVED", "ACCEPTED"] },
  { key: "PREP", label: "Preparing", statuses: ["PREPARING"] },
  { key: "READY", label: "Ready", statuses: ["READY_FOR_PICKUP", "READY_FOR_DELIVERY"] },
] as const;

function ago(iso: string) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m`;
}

// The kitchen action for a ticket depends on its column + pickup/delivery.
function ticketAction(colKey: string, o: Order): { label: string; next: string } | null {
  const del = o.fulfillment === "DELIVERY";
  if (colKey === "NEW") return { label: "Start →", next: "PREPARING" };
  if (colKey === "PREP") return del ? { label: "Packed →", next: "READY_FOR_DELIVERY" } : { label: "Ready →", next: "READY_FOR_PICKUP" };
  // READY column
  if (o.status === "READY_FOR_DELIVERY") return { label: "Handed to driver ✓", next: "OUT_FOR_DELIVERY" };
  return { label: "Done ✓", next: "COMPLETED" };
}

// Compact one-line description of an item's customizations for the line cook.
function itemExtras(i: Order["items"][number]) {
  return [...(i.selectedOptions ?? []).map((s) => s.choice), ...(i.addons ?? []).map((a) => (a.quantity > 1 ? `${a.name} ×${a.quantity}` : a.name))]
    .filter(Boolean)
    .join(", ");
}

export function KDS() {
  const [orders, setOrders] = useState<Order[]>([]);
  const load = useCallback(() => {
    posApi
      .get<Order[]>("/api/pos/kds")
      .then(setOrders)
      .catch(() => {});
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  async function advance(o: Order, status: string) {
    setOrders((os) => os.filter((x) => x.id !== o.id)); // optimistic
    try {
      await posApi.patch(`/api/pos/kds/${o.id}/status`, { status });
    } catch {
      /* refetch below corrects any error */
    }
    load();
  }

  if (!isPosTokenValid()) return <Navigate to="/pos" replace />;

  return (
    <div className="bg-espresso text-cream flex h-screen flex-col">
      <div className="flex items-center justify-between px-4 py-2">
        <span className="font-display text-lg font-bold">🍳 Kitchen — Bean Avenue</span>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-cream/60">{orders.length} active</span>
          <Link to="/pos" className="bg-mocha/60 rounded-full px-3 py-1.5 font-semibold">
            Register
          </Link>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-3 gap-2 p-2">
        {COLUMNS.map((col) => {
          const tickets = orders.filter((o) => (col.statuses as readonly string[]).includes(o.status));
          return (
            <div key={col.key} className="bg-mocha/30 flex min-h-0 flex-col rounded-xl">
              <div className="px-3 py-2 font-bold">
                {col.label} <span className="text-cream/50">({tickets.length})</span>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 pb-2">
                {tickets.map((o) => {
                  const act = ticketAction(col.key, o);
                  const kind =
                    o.fulfillment === "DELIVERY"
                      ? "🛵 Delivery"
                      : o.tableNumber
                        ? `🍽 Table ${o.tableNumber}`
                        : o.orderType === "DINE_IN"
                          ? "🍽 Dine-in"
                          : "🥡 Takeaway";
                  return (
                    <div key={o.id} className="bg-cream text-espresso rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold">{kind}</span>
                        <span className="text-charcoal/50 text-xs">
                          {ago(o.createdAt)} · {o.channel === "ONLINE" ? "Online" : "POS"}
                        </span>
                      </div>
                      <p className="text-charcoal/40 text-[11px]">
                        {o.number}
                        {o.channel === "ONLINE" && o.customerName ? ` · ${o.customerName}` : ""}
                      </p>
                      <ul className="mt-1.5 space-y-1.5 text-sm">
                        {o.items.map((i) => {
                          const extras = itemExtras(i);
                          return (
                            <li key={i.id} className="leading-tight">
                              <span className="font-semibold">
                                {i.quantity}× {i.name}
                              </span>
                              {extras ? <span className="text-charcoal/60 block text-xs font-medium">{extras}</span> : null}
                              {i.specialInstructions ? (
                                <span className="text-terracotta block text-xs font-semibold italic">↳ {i.specialInstructions}</span>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                      {act && (
                        <button onClick={() => advance(o, act.next)} className="btn-3d bg-espresso text-cream mt-2 w-full rounded-lg py-2 text-sm font-bold">
                          {act.label}
                        </button>
                      )}
                    </div>
                  );
                })}
                {tickets.length === 0 && <p className="text-cream/30 p-4 text-center text-sm">—</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
