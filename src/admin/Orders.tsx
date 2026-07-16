import { useEffect, useRef, useState } from "react";
import { ItemExtras } from "../components/ItemExtras";
import { useToast } from "../context/ToastContext";
import { api, formatDateTime, money } from "../lib/api";
import { mapsLinkFromCoords, mapsLinkFromText } from "../lib/maps";
import { flowFor, isTerminal, normalizeStatus, paymentStatusMeta, PAYMENT_METHOD_LABEL, statusLabel, statusMeta } from "../lib/orderStatus";
import type { Fulfillment, Order, OrderStatus } from "../types";

const nextLabel = (from: OrderStatus, to: OrderStatus) => (from === "RECEIVED" && to === "ACCEPTED" ? "Accept order" : `Mark ${statusLabel(to)}`);

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
  const [fulfillment, setFulfillment] = useState<"ALL" | Fulfillment>("ALL");
  const [search, setSearch] = useState("");
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [driverFor, setDriverFor] = useState<number | null>(null);
  const [driverName, setDriverName] = useState("");
  const [, setTick] = useState(0);
  const knownIds = useRef<Set<number> | null>(null);

  async function load() {
    const params = new URLSearchParams();
    if (fulfillment !== "ALL") params.set("fulfillment", fulfillment);
    if (search) params.set("search", search);
    const data = await api.get<Order[]>(`/api/orders?${params}`);
    if (knownIds.current) {
      const fresh = data.filter((o) => !knownIds.current!.has(o.id) && normalizeStatus(o.status) === "RECEIVED");
      if (fresh.length > 0) toast(`🔔 ${fresh.length} new order${fresh.length > 1 ? "s" : ""}!`);
    }
    knownIds.current = new Set(data.map((o) => o.id));
    const rank = (o: Order) => (normalizeStatus(o.status) === "RECEIVED" ? 0 : isTerminal(o.status) ? 2 : 1);
    data.sort((a, b) => rank(a) - rank(b) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setOrders(data);
  }

  useEffect(() => {
    load();
    const interval = setInterval(() => load(), 20_000);
    const clock = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => {
      clearInterval(interval);
      clearInterval(clock);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fulfillment, search]);

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

  async function assignDriver(order: Order) {
    try {
      await api.patch(`/api/orders/${order.id}/assign`, { driverName: driverName.trim() });
      setDriverFor(null);
      setDriverName("");
      toast("Driver assigned.");
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't assign.", "error");
    }
  }

  async function collectCash(order: Order) {
    try {
      await api.post(`/api/payments/order/${order.number}/collect-cash`, {});
      toast("Cash recorded as collected.");
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't record cash.", "error");
    }
  }

  return (
    <div>
      <h1 className="font-display text-espresso text-3xl font-bold">Orders</h1>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {(["ALL", "PICKUP", "DELIVERY"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFulfillment(f)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${fulfillment === f ? "bg-espresso text-cream" : "text-espresso bg-white shadow-sm"}`}
          >
            {f === "ALL" ? "All orders" : f === "PICKUP" ? "🏪 Pickup" : "🛵 Delivery"}
          </button>
        ))}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, phone, number, area…"
          className="border-oat ml-auto w-full rounded-full border bg-white px-4 py-2 text-sm sm:w-64"
        />
      </div>

      <div className="mt-5 space-y-3">
        {orders.length === 0 && <p className="text-charcoal/60 rounded-xl bg-white p-6 text-center shadow-sm">No orders here.</p>}
        {orders.map((o) => {
          const status = normalizeStatus(o.status);
          const flow = flowFor(o.fulfillment);
          const nextStatus = flow[flow.indexOf(status) + 1];
          const isNew = status === "RECEIVED";
          const awaiting = status === "AWAITING_PAYMENT";
          const active = !isTerminal(o.status) && !awaiting;
          const meta = statusMeta(status);
          const isDelivery = o.fulfillment === "DELIVERY";
          const mins = Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 60000);
          const cashDue = o.paymentMethod !== "ONLINE" && o.paymentStatus === "CASH_DUE";

          return (
            <div
              key={o.id}
              className={`rounded-2xl bg-white p-4 shadow-sm sm:p-5 ${isNew ? "ring-terracotta/50 ring-2" : awaiting ? "ring-2 ring-amber-300" : ""}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-espresso flex flex-wrap items-center gap-2 font-semibold">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${isDelivery ? "bg-blue-100 text-blue-700" : "bg-sage/20 text-sage-dark"}`}>
                      {isDelivery ? "🛵 DELIVERY" : "🏪 PICKUP"}
                    </span>
                    {isNew && <span className="bg-terracotta text-cream rounded-full px-2 py-0.5 text-xs font-bold">NEW</span>}
                    <span>{o.number}</span>
                    <span className="text-charcoal/70">· {o.customerName}</span>
                  </p>
                  <a href={`tel:${o.phone}`} className="text-terracotta text-sm font-semibold">
                    📞 {o.phone}
                  </a>

                  <ul className="text-charcoal/80 mt-2 space-y-1 text-sm">
                    {o.items.map((i) => (
                      <li key={i.id}>
                        {i.quantity}× {i.name}
                        <ItemExtras options={i.selectedOptions} addons={i.addons} instructions={i.specialInstructions} />
                      </li>
                    ))}
                  </ul>

                  {/* Delivery details for staff */}
                  {isDelivery && (
                    <div className="text-charcoal/80 mt-2 rounded-lg bg-blue-50 p-2.5 text-xs">
                      <p className="text-espresso font-semibold">
                        📍 {o.zoneName ? `${o.zoneName} · ` : ""}
                        {[o.building, o.addressLine, o.apartment && `Apt ${o.apartment}`, o.floor && `Fl ${o.floor}`, o.area].filter(Boolean).join(", ")}
                      </p>
                      {o.landmark && <p>Near {o.landmark}</p>}
                      {o.deliveryInstructions && <p>📝 {o.deliveryInstructions}</p>}
                      <p className="mt-1 flex flex-wrap gap-x-3">
                        <a
                          href={
                            o.lat != null && o.lng != null ? mapsLinkFromCoords(o.lat, o.lng) : mapsLinkFromText([o.building, o.area].filter(Boolean).join(" "))
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-blue-700 hover:underline"
                        >
                          Open in Maps
                        </a>
                        <span>🛵 {o.estimatedDelivery || "—"}</span>
                        {o.driverName && <span>👤 {o.driverName}</span>}
                      </p>
                    </div>
                  )}

                  <p className="text-charcoal/50 mt-2 text-xs">
                    {isDelivery ? "Delivery" : `Pickup: ${o.pickupTime ?? "ASAP"}`} · {PAYMENT_METHOD_LABEL[o.paymentMethod]} · {formatDateTime(o.createdAt)}
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-display text-espresso text-xl font-bold">{money(o.total)}</p>
                  {isDelivery && o.deliveryFee > 0 && <p className="text-charcoal/50 text-xs">incl. {money(o.deliveryFee)} delivery</p>}
                  <span className={`mt-1 inline-block rounded-full px-3 py-0.5 text-xs font-bold ${meta.badge}`}>
                    {meta.icon} {meta.label}
                  </span>
                  <span className={`mt-1 block rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${paymentStatusMeta(o.paymentStatus).badge}`}>
                    {paymentStatusMeta(o.paymentStatus).label}
                  </span>
                  {active && (
                    <p className={`mt-1 text-xs font-semibold ${mins >= 15 ? "text-terracotta-dark" : "text-charcoal/50"}`}>⏱ {waitingLabel(o.createdAt)}</p>
                  )}
                </div>
              </div>

              {awaiting && (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">💳 Awaiting online payment — not yet confirmed by the customer.</p>
              )}
              {status === "CANCELLED" && o.cancelReason && (
                <p className="bg-terracotta/10 text-terracotta-dark mt-3 rounded-lg px-3 py-2 text-xs">
                  Cancelled{o.cancelledBy ? ` by ${o.cancelledBy}` : ""}: {o.cancelReason}
                </p>
              )}

              {(active || awaiting) && (
                <div className="border-oat mt-3 space-y-2 border-t pt-3">
                  {cancelId === o.id ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        autoFocus
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="Reason for cancelling (required)…"
                        className="border-oat flex-1 rounded-full border px-4 py-2.5 text-sm"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => cancelReason.trim() && setOrderStatus(o, "CANCELLED", cancelReason.trim())}
                          disabled={!cancelReason.trim()}
                          className="bg-terracotta text-cream flex-1 rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-50 sm:flex-none"
                        >
                          Confirm cancel
                        </button>
                        <button
                          onClick={() => {
                            setCancelId(null);
                            setCancelReason("");
                          }}
                          className="bg-oat text-espresso rounded-full px-5 py-2.5 text-sm font-semibold"
                        >
                          Back
                        </button>
                      </div>
                    </div>
                  ) : driverFor === o.id ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        autoFocus
                        value={driverName}
                        onChange={(e) => setDriverName(e.target.value)}
                        placeholder="Driver / staff name…"
                        className="border-oat flex-1 rounded-full border px-4 py-2.5 text-sm"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => assignDriver(o)} className="bg-espresso text-cream rounded-full px-5 py-2.5 text-sm font-semibold">
                          Assign
                        </button>
                        <button
                          onClick={() => {
                            setDriverFor(null);
                            setDriverName("");
                          }}
                          className="bg-oat text-espresso rounded-full px-5 py-2.5 text-sm font-semibold"
                        >
                          Back
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      {active && nextStatus && (
                        <button
                          onClick={() => setOrderStatus(o, nextStatus)}
                          className="btn-3d bg-espresso text-cream hover:bg-mocha flex-1 rounded-full px-5 py-2.5 text-sm font-semibold sm:flex-none"
                        >
                          {nextLabel(status, nextStatus)}
                        </button>
                      )}
                      {isDelivery && active && (
                        <button
                          onClick={() => {
                            setDriverFor(o.id);
                            setDriverName(o.driverName ?? "");
                          }}
                          className="border-oat text-espresso hover:bg-oat rounded-full border px-5 py-2.5 text-sm font-semibold sm:flex-none"
                        >
                          {o.driverName ? "Reassign driver" : "Assign driver"}
                        </button>
                      )}
                      {cashDue && (
                        <button
                          onClick={() => collectCash(o)}
                          className="border-sage text-sage-dark hover:bg-sage hover:text-cream rounded-full border px-5 py-2.5 text-sm font-semibold sm:flex-none"
                        >
                          💵 Record cash collected
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setCancelId(o.id);
                          setCancelReason("");
                        }}
                        className="border-oat text-charcoal/60 hover:border-terracotta hover:text-terracotta-dark rounded-full border px-5 py-2.5 text-sm font-semibold sm:flex-none"
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
