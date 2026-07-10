import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { isPosTokenValid, posApi } from "../lib/api";
import type { Order } from "../types";

const COLUMNS = [
  { key: "NEW", label: "New", statuses: ["RECEIVED", "ACCEPTED"], next: "PREPARING", action: "Start →" },
  { key: "PREP", label: "Preparing", statuses: ["PREPARING"], next: "READY_FOR_PICKUP", action: "Ready →" },
  { key: "READY", label: "Ready", statuses: ["READY_FOR_PICKUP"], next: "COMPLETED", action: "Done ✓" },
] as const;

function ago(iso: string) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m`;
}

export function KDS() {
  const [orders, setOrders] = useState<Order[]>([]);
  const load = useCallback(() => {
    posApi.get<Order[]>("/api/pos/kds").then(setOrders).catch(() => {});
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
    <div className="flex h-screen flex-col bg-espresso text-cream">
      <div className="flex items-center justify-between px-4 py-2">
        <span className="font-display text-lg font-bold">🍳 Kitchen — Bean Avenue</span>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-cream/60">{orders.length} active</span>
          <Link to="/pos" className="rounded-full bg-mocha/60 px-3 py-1.5 font-semibold">Register</Link>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-3 gap-2 p-2">
        {COLUMNS.map((col) => {
          const tickets = orders.filter((o) => (col.statuses as readonly string[]).includes(o.status));
          return (
            <div key={col.key} className="flex min-h-0 flex-col rounded-xl bg-mocha/30">
              <div className="px-3 py-2 font-bold">
                {col.label} <span className="text-cream/50">({tickets.length})</span>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 pb-2">
                {tickets.map((o) => (
                  <div key={o.id} className="rounded-lg bg-cream p-3 text-espresso">
                    <div className="flex items-center justify-between">
                      <span className="font-bold">
                        {o.tableNumber ? `Table ${o.tableNumber}` : o.orderType === "DINE_IN" ? "Dine-in" : "Takeaway"}
                      </span>
                      <span className="text-xs text-charcoal/50">{ago(o.createdAt)} · {o.channel === "ONLINE" ? "Online" : "POS"}</span>
                    </div>
                    <p className="text-[11px] text-charcoal/40">{o.number}</p>
                    <ul className="mt-1.5 space-y-1 text-sm">
                      {o.items.map((i) => (
                        <li key={i.id}>
                          <span className="font-semibold">{i.quantity}×</span> {i.name}
                          {i.selectedOptions?.length ? <span className="text-charcoal/50"> ({i.selectedOptions.map((s) => s.choice).join(", ")})</span> : ""}
                          {i.specialInstructions ? <span className="block text-xs italic text-terracotta">↳ {i.specialInstructions}</span> : null}
                        </li>
                      ))}
                    </ul>
                    <button onClick={() => advance(o, col.next)} className="btn-3d mt-2 w-full rounded-lg bg-espresso py-2 text-sm font-bold text-cream">
                      {col.action}
                    </button>
                  </div>
                ))}
                {tickets.length === 0 && <p className="p-4 text-center text-sm text-cream/30">—</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
