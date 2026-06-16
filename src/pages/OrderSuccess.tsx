import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ADDRESS, WHATSAPP_URL } from "../components/Layout";
import { OrderStatusTimeline } from "../components/OrderStatusTimeline";
import { useToast } from "../context/ToastContext";
import { api, money } from "../lib/api";
import { ORDER_STATUS_META, PICKUP_ESTIMATE } from "../lib/orderStatus";
import type { Order, OrderStatus } from "../types";

export function OrderSuccess() {
  const { number } = useParams();
  const location = useLocation();
  const toast = useToast();
  const [order, setOrder] = useState<Order | null>(location.state?.order ?? null);
  const prevStatus = useRef<OrderStatus | null>(order?.status ?? null);

  // Fetch the latest status; toast when it flips to "Ready for Pickup".
  async function fetchOrder() {
    if (!number) return;
    try {
      const o = await api.get<Order>(`/api/orders/track/${number}`);
      if (prevStatus.current && prevStatus.current !== "READY" && o.status === "READY") {
        toast("🎉 Your order is ready for pickup!");
      }
      prevStatus.current = o.status;
      setOrder(o);
    } catch {
      /* keep showing whatever we have */
    }
  }

  useEffect(() => {
    fetchOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [number]);

  // Poll for updates until the order is completed or cancelled.
  useEffect(() => {
    if (!order || order.status === "PICKED_UP" || order.status === "CANCELLED") return;
    const id = setInterval(fetchOrder, 15_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.status, number]);

  const estimate = order ? PICKUP_ESTIMATE[order.status] : undefined;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="text-center">
        <p className="pop-in text-6xl">☕</p>
        <h1 className="mt-4 font-display text-3xl font-bold text-espresso">
          Order placed — we're on it ☕
        </h1>
        <p className="mt-2 text-lg font-semibold text-terracotta">{number}</p>
      </div>

      {order && (
        <>
          {/* Status tracking */}
          <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-charcoal/50">Status</p>
                <p className="font-display text-xl font-bold text-espresso">
                  {ORDER_STATUS_META[order.status].icon} {ORDER_STATUS_META[order.status].label}
                </p>
              </div>
              {estimate && (
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide text-charcoal/50">
                    Estimated pickup
                  </p>
                  <p className="font-semibold text-espresso">{estimate}</p>
                </div>
              )}
            </div>

            <div className="mt-6">
              <OrderStatusTimeline status={order.status} />
            </div>

            {order.status === "READY" && (
              <div className="mt-6 rounded-xl bg-sage/15 p-4 text-center text-sm font-semibold text-sage-dark">
                🎉 Your order is ready! Come pick it up at {ADDRESS}.
              </div>
            )}
            <p className="mt-4 text-center text-xs text-charcoal/40">
              This page updates automatically as your order progresses.
            </p>
          </div>

          {/* Order details */}
          <div className="mt-6 rounded-2xl bg-white p-6 text-left shadow-sm">
            <ul className="space-y-2 text-sm">
              {order.items.map((it) => (
                <li key={it.id} className="flex justify-between">
                  <span>
                    {it.quantity}× {it.name}
                    {it.selectedOptions.length > 0 && (
                      <span className="block text-xs text-charcoal/50">
                        {it.selectedOptions.map((o) => o.choice).join(", ")}
                      </span>
                    )}
                  </span>
                  <span>{money(it.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-1 border-t border-oat pt-3 text-sm">
              {order.discount > 0 && (
                <div className="flex justify-between text-sage-dark">
                  <span>Discount{order.promoCode ? ` (${order.promoCode})` : ""}</span>
                  <span>−{money(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-espresso">
                <span>Total</span>
                <span>{money(order.total)}</span>
              </div>
            </div>
            <div className="mt-4 rounded-xl bg-oat/60 p-3 text-sm">
              <p>
                <strong>Pickup:</strong> {order.pickupTime ?? "ASAP"} · {ADDRESS}
              </p>
              <p className="mt-1">
                <strong>Payment:</strong> Pay at the counter (cash or card)
              </p>
              {order.beansEarned > 0 && (
                <p className="mt-1 text-sage-dark">
                  🫘 You earned <strong>{order.beansEarned} beans</strong> on this order!
                </p>
              )}
            </div>
          </div>
        </>
      )}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          to="/menu"
          className="btn-3d rounded-full bg-espresso px-6 py-2.5 font-semibold text-cream"
        >
          Back to Menu
        </Link>
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noreferrer"
          className="btn-3d rounded-full bg-sage px-6 py-2.5 font-semibold text-cream"
        >
          💬 Message us on WhatsApp
        </a>
      </div>
    </div>
  );
}
