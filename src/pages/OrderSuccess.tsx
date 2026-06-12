import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { WHATSAPP_URL } from "../components/Layout";
import { api, money } from "../lib/api";
import type { Order } from "../types";

export function OrderSuccess() {
  const { number } = useParams();
  const location = useLocation();
  const [order, setOrder] = useState<Order | null>(location.state?.order ?? null);

  useEffect(() => {
    if (!order && number) {
      api.get<Order>(`/api/orders/track/${number}`).then(setOrder).catch(() => {});
    }
  }, [number, order]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <p className="pop-in text-6xl">☕</p>
      <h1 className="mt-4 font-display text-3xl font-bold text-espresso">
        Order placed — we're on it ☕
      </h1>
      <p className="mt-2 text-lg font-semibold text-terracotta">{number}</p>

      {order && (
        <div className="mt-8 rounded-2xl bg-white p-6 text-left shadow-sm">
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
              <strong>Pickup:</strong> {order.pickupTime ?? "ASAP"} · 123 Avenue Street
            </p>
            {order.beansEarned > 0 && (
              <p className="mt-1 text-sage-dark">
                🫘 You earned <strong>{order.beansEarned} beans</strong> on this order!
              </p>
            )}
          </div>
        </div>
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
