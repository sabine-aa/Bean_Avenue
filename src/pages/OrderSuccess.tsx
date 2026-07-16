import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ItemExtras } from "../components/ItemExtras";
import { ADDRESS, WHATSAPP_URL } from "../components/Layout";
import { OrderStatusTimeline } from "../components/OrderStatusTimeline";
import { PaymentModal } from "../components/PaymentModal";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { useToast } from "../context/ToastContext";
import { customerApi, money } from "../lib/api";
import { mapsLinkFromCoords, mapsLinkFromText } from "../lib/maps";
import { normalizeStatus, paymentStatusMeta, PAYMENT_METHOD_LABEL, statusMeta, timeEstimate } from "../lib/orderStatus";
import type { Order, OrderStatus } from "../types";

export function OrderSuccess() {
  const { number } = useParams();
  const location = useLocation();
  const toast = useToast();
  const { account, refresh } = useCustomerAuth();
  const [order, setOrder] = useState<Order | null>(location.state?.order ?? null);
  const [payOpen, setPayOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const prevStatus = useRef<OrderStatus | null>(order?.status ?? null);

  async function fetchOrder() {
    if (!number) return;
    try {
      const o = await customerApi.get<Order>(`/api/orders/track/${number}`);
      const prev = prevStatus.current ? normalizeStatus(prevStatus.current) : null;
      const now = normalizeStatus(o.status);
      if (prev && prev !== now) {
        if (now === "READY_FOR_PICKUP") toast("🎉 Your order is ready for pickup!");
        if (now === "OUT_FOR_DELIVERY") toast("🛵 Your order is out for delivery!");
        if (now === "DELIVERED") toast("✅ Your order has been delivered. Enjoy!");
      }
      prevStatus.current = o.status;
      setOrder(o);
    } catch {
      /* keep whatever we have */
    }
  }

  useEffect(() => {
    fetchOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [number]);

  // Poll until the order is in a terminal state.
  useEffect(() => {
    if (!order) return;
    const s = normalizeStatus(order.status);
    if (["COMPLETED", "DELIVERED", "CANCELLED"].includes(s)) return;
    const id = setInterval(fetchOrder, 15_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.status, number]);

  const status = order ? normalizeStatus(order.status) : "RECEIVED";
  const meta = statusMeta(status);
  const awaitingPayment = order?.paymentMethod === "ONLINE" && order?.paymentStatus !== "PAID" && status !== "CANCELLED";
  const estimate = order ? timeEstimate(status, order.fulfillment) : null;
  const isDelivery = order?.fulfillment === "DELIVERY";
  const canCancel = order && account && ["AWAITING_PAYMENT", "RECEIVED"].includes(status) && order.paymentStatus !== "REFUNDED";

  async function cancelOrder() {
    if (!order || cancelling) return;
    if (!confirm("Cancel this order?")) return;
    setCancelling(true);
    try {
      const updated = await customerApi.post<Order>(`/api/orders/${order.number}/cancel`, {});
      setOrder(updated);
      refresh().catch(() => {});
      toast("Order cancelled.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't cancel the order.", "error");
    } finally {
      setCancelling(false);
    }
  }

  const paid = order?.paymentStatus === "PAID" || order?.paymentStatus === "CASH_COLLECTED";

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
      <div className="text-center">
        <p className="pop-in text-6xl">{awaitingPayment ? "💳" : paid ? "✅" : "☕"}</p>
        <h1 className="font-display text-espresso mt-4 text-3xl font-bold">
          {awaitingPayment ? "Almost there — complete payment" : "Order confirmed — we're on it ☕"}
        </h1>
        <p className="text-terracotta mt-2 text-lg font-semibold">{number}</p>
      </div>

      {awaitingPayment && order && (
        <div className="mt-6 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 text-center">
          <p className="text-sm text-amber-800">This order isn't confirmed yet — your payment didn't complete.</p>
          <button onClick={() => setPayOpen(true)} className="btn-3d bg-terracotta text-cream mt-3 rounded-full px-6 py-3 font-semibold">
            Pay {money(order.total)} now
          </button>
          <p className="mt-2 text-xs text-amber-700/80">Your cart is safe — paying here won't create a duplicate order.</p>
        </div>
      )}

      {order && (
        <>
          {/* Status tracking */}
          <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-charcoal/50 text-xs tracking-wide uppercase">Status</p>
                <p className="font-display text-espresso text-xl font-bold">
                  {meta.icon} {meta.label}
                </p>
              </div>
              <div className="text-right">
                <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${paymentStatusMeta(order.paymentStatus).badge}`}>
                  {paymentStatusMeta(order.paymentStatus).label}
                </span>
                {estimate && (
                  <p className="text-charcoal/60 mt-1 text-xs">
                    {isDelivery ? "Delivery" : "Pickup"}: {estimate}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 overflow-x-auto">
              <OrderStatusTimeline status={order.status} fulfillment={order.fulfillment} />
            </div>

            {status === "READY_FOR_PICKUP" && (
              <div className="bg-sage/15 text-sage-dark mt-6 rounded-xl p-4 text-center text-sm font-semibold">
                🎉 Your order is ready! Come pick it up at {ADDRESS}.
              </div>
            )}
            {order.driverName && isDelivery && status !== "CANCELLED" && (
              <p className="text-charcoal/70 mt-4 text-center text-sm">🛵 {order.driverName} is handling your delivery.</p>
            )}
            {!["COMPLETED", "DELIVERED", "CANCELLED"].includes(status) && (
              <p className="text-charcoal/40 mt-4 text-center text-xs">This page updates automatically as your order progresses.</p>
            )}
          </div>

          {/* Fulfillment details */}
          <div className="mt-6 rounded-2xl bg-white p-6 text-left shadow-sm">
            {isDelivery ? (
              <div className="text-sm">
                <p className="font-display text-espresso font-bold">🛵 Delivery</p>
                {order.zoneName && (
                  <p className="text-charcoal/70 mt-1">
                    Zone: {order.zoneName} · {order.estimatedDelivery}
                  </p>
                )}
                <p className="text-charcoal/80 mt-2">
                  {order.deliveryName} · {order.deliveryPhone ?? order.phone}
                </p>
                <p className="text-charcoal/70">
                  {[order.building, order.addressLine, order.apartment && `Apt ${order.apartment}`, order.floor && `Floor ${order.floor}`, order.area]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                {order.landmark && <p className="text-charcoal/60">Near {order.landmark}</p>}
                {order.deliveryInstructions && <p className="text-charcoal/60 mt-1">📝 {order.deliveryInstructions}</p>}
                <a
                  href={
                    order.lat != null && order.lng != null
                      ? mapsLinkFromCoords(order.lat, order.lng)
                      : mapsLinkFromText([order.building, order.area].filter(Boolean).join(" "))
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="text-terracotta mt-2 inline-block text-xs font-semibold hover:underline"
                >
                  📍 Open in Google Maps
                </a>
              </div>
            ) : (
              <div className="text-sm">
                <p className="font-display text-espresso font-bold">🏪 Pickup</p>
                <p className="text-charcoal/70 mt-1">
                  {order.pickupTime === "ASAP" ? "As soon as possible" : order.pickupTime} · {ADDRESS}
                </p>
              </div>
            )}
          </div>

          {/* Order breakdown */}
          <div className="mt-6 rounded-2xl bg-white p-6 text-left shadow-sm">
            <ul className="space-y-2 text-sm">
              {order.items.map((it) => (
                <li key={it.id} className="flex justify-between">
                  <span>
                    {it.quantity}× {it.name}
                    <ItemExtras options={it.selectedOptions} addons={it.addons} instructions={it.specialInstructions} />
                  </span>
                  <span>{money(it.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <div className="border-oat mt-4 space-y-1.5 border-t pt-3 text-sm">
              <SummaryRow label="Items subtotal" value={money(order.subtotal - order.addonsTotal)} />
              {order.addonsTotal > 0 && <SummaryRow label="Add-ons" value={money(order.addonsTotal)} />}
              {order.discount > 0 && (
                <SummaryRow label={`Discount${order.promoCode ? ` (${order.promoCode})` : ""}`} value={`−${money(order.discount)}`} accent />
              )}
              {order.loyaltyDiscount > 0 && <SummaryRow label="Loyalty reward" value={`−${money(order.loyaltyDiscount)}`} accent />}
              {isDelivery && <SummaryRow label="Delivery fee" value={order.deliveryFee === 0 ? "Free" : money(order.deliveryFee)} />}
              {order.tax > 0 && <SummaryRow label="Tax" value={money(order.tax)} />}
              <div className="border-oat text-espresso flex justify-between border-t pt-2 text-base font-bold">
                <span>{paid ? "Total paid" : "Total"}</span>
                <span>{money(order.total)}</span>
              </div>
            </div>
            <div className="bg-oat/60 mt-4 rounded-xl p-3 text-sm">
              <p>
                <strong>Payment:</strong> {PAYMENT_METHOD_LABEL[order.paymentMethod]} · {paymentStatusMeta(order.paymentStatus).label}
              </p>
              {order.beansEarned > 0 && (
                <p className="text-sage-dark mt-1">
                  🫘 {paid ? "You earned" : "You'll earn"} <strong>{order.beansEarned} beans</strong>
                  {paid ? " on this order!" : " once this order is complete."}
                </p>
              )}
            </div>
          </div>
        </>
      )}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/account?tab=orders" className="btn-3d bg-espresso text-cream rounded-full px-6 py-2.5 font-semibold">
          Track in My Orders
        </Link>
        <Link to="/menu" className="border-oat text-espresso rounded-full border bg-white px-6 py-2.5 font-semibold">
          Back to Menu
        </Link>
        {canCancel && (
          <button
            onClick={cancelOrder}
            disabled={cancelling}
            className="border-terracotta/40 text-terracotta-dark rounded-full border bg-white px-6 py-2.5 font-semibold disabled:opacity-60"
          >
            {cancelling ? "Cancelling…" : "Cancel order"}
          </button>
        )}
        <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="border-oat text-espresso rounded-full border bg-white px-6 py-2.5 font-semibold">
          💬 WhatsApp
        </a>
      </div>

      {payOpen && order && (
        <PaymentModal
          orderNumber={order.number}
          amount={order.total}
          onPaid={(o) => {
            setOrder(o);
            setPayOpen(false);
            refresh().catch(() => {});
            toast("Payment successful! 🎉");
          }}
          onClose={() => setPayOpen(false)}
        />
      )}
    </div>
  );
}

function SummaryRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`flex justify-between ${accent ? "text-sage-dark" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
