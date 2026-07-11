import { useEffect, useState } from "react";
import { customerApi, money } from "../lib/api";
import type { Order } from "../types";

interface CreateResponse {
  status: string;
  redirectUrl: string;
  transactionId: string;
  mock: boolean;
}
interface ConfirmResponse {
  status: "PAID" | "PENDING" | "FAILED";
  order?: Order;
  error?: string;
}

/**
 * Whish payment dialog. Whish is a redirect/approve flow: we create a collection
 * for the order, then either send the customer to Whish (real credentials) or —
 * in mock/testing mode — let them approve inline. On success the order is settled
 * server-side and we hand the paid order back to checkout.
 */
export function WhishPaymentModal({
  orderNumber,
  amount,
  onPaid,
  onClose,
}: {
  orderNumber: string;
  amount: number;
  onPaid: (order: Order) => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [mock, setMock] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Kick off the Whish collection as soon as the modal opens.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBusy(true);
      setError(null);
      try {
        const res = await customerApi.post<CreateResponse>("/api/payments/whish/create", { orderNumber });
        if (cancelled) return;
        // Real Whish → hand off to their hosted approval page.
        if (res.redirectUrl && !res.mock) {
          window.location.href = res.redirectUrl;
          return;
        }
        setMock(res.mock);
        setReady(true);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't start the Whish payment.");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderNumber]);

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await customerApi.post<ConfirmResponse>("/api/payments/whish/confirm", { orderNumber });
      if (res.status === "PAID" && res.order) return onPaid(res.order);
      if (res.status === "PENDING") setError("Payment is still pending. Approve it in your Whish app, then tap confirm again.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't confirm the Whish payment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal>
      <div className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-3xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-espresso">📱 Pay with Whish</h2>
          <button onClick={onClose} className="text-charcoal/40 hover:text-charcoal" aria-label="Close">✕</button>
        </div>
        <p className="mt-1 text-sm text-charcoal/60">
          Order {orderNumber} · <span className="font-semibold text-espresso">{money(amount)}</span>
        </p>

        {!ready && busy && <p className="mt-6 text-center text-sm text-charcoal/60">Starting your Whish payment…</p>}

        {ready && (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl bg-[#5b3fd6]/10 px-4 py-3 text-sm text-charcoal/75">
              Open your <span className="font-semibold text-[#5b3fd6]">Whish</span> app and approve the {money(amount)} request for this order, then tap confirm below.
            </div>
            {mock && (
              <p className="rounded-lg bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-700">
                ⚠️ Test mode — Whish isn't connected yet, so this simulates a successful payment. No real money moves.
              </p>
            )}
            {error && <p className="rounded-lg bg-terracotta/10 px-3 py-2 text-sm font-medium text-terracotta-dark">{error}</p>}
            <button
              onClick={confirm}
              disabled={busy}
              className="btn-3d w-full rounded-full bg-[#5b3fd6] px-6 py-3.5 text-base font-semibold text-cream disabled:opacity-60"
            >
              {busy ? "Confirming…" : `I've approved · confirm ${money(amount)}`}
            </button>
          </div>
        )}

        {!ready && error && (
          <div className="mt-4 space-y-3">
            <p className="rounded-lg bg-terracotta/10 px-3 py-2 text-sm font-medium text-terracotta-dark">{error}</p>
            <button onClick={onClose} className="w-full rounded-full border border-oat px-6 py-3 font-semibold text-espresso">Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
