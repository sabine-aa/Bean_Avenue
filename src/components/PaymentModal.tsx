import { FormEvent, useState } from "react";
import { customerApi, money } from "../lib/api";
import type { Order } from "../types";

interface PayResponse {
  status: "PAID" | "REQUIRES_3DS" | "FAILED";
  transactionId?: string;
  order?: Order;
  error?: string;
}

/**
 * Secure card payment dialog. The card number is sent only to the payment
 * endpoint (which forwards it to the gateway and stores only brand + last4);
 * with a real gateway this form is replaced by the gateway's own SDK element so
 * the PAN never reaches our server. Handles 3D Secure / OTP challenges and lets
 * the customer retry on failure against the SAME order (no duplicate orders).
 */
export function PaymentModal({
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
  const [card, setCard] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [step, setStep] = useState<"card" | "otp">("card");
  const [otp, setOtp] = useState("");
  const [txn, setTxn] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await customerApi.post<PayResponse>("/api/payments/pay", {
        orderNumber,
        cardNumber: card.replace(/\s+/g, ""),
      });
      if (res.status === "PAID" && res.order) return onPaid(res.order);
      if (res.status === "REQUIRES_3DS" && res.transactionId) {
        setTxn(res.transactionId);
        setStep("otp");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e: FormEvent) {
    e.preventDefault();
    if (busy || !txn) return;
    setBusy(true);
    setError(null);
    try {
      const res = await customerApi.post<PayResponse>("/api/payments/confirm", { transactionId: txn, otp });
      if (res.status === "PAID" && res.order) return onPaid(res.order);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
      setStep("card");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal>
      <div className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-3xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-espresso text-xl font-bold">Secure payment</h2>
          <button onClick={onClose} className="text-charcoal/40 hover:text-charcoal" aria-label="Close">
            ✕
          </button>
        </div>
        <p className="text-charcoal/60 mt-1 text-sm">
          Order {orderNumber} · <span className="text-espresso font-semibold">{money(amount)}</span>
        </p>

        {step === "card" ? (
          <form onSubmit={pay} className="mt-4 space-y-3">
            <label className="text-espresso block text-sm font-semibold">
              Card number
              <input
                value={card}
                onChange={(e) => setCard(e.target.value)}
                inputMode="numeric"
                placeholder="4242 4242 4242 4242"
                required
                className="border-oat mt-1 w-full rounded-xl border px-4 py-3 text-base"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-espresso block text-sm font-semibold">
                Expiry
                <input
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  placeholder="MM/YY"
                  required
                  className="border-oat mt-1 w-full rounded-xl border px-4 py-3 text-base"
                />
              </label>
              <label className="text-espresso block text-sm font-semibold">
                CVV
                <input
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value)}
                  inputMode="numeric"
                  placeholder="123"
                  required
                  className="border-oat mt-1 w-full rounded-xl border px-4 py-3 text-base"
                />
              </label>
            </div>
            {error && <p className="bg-terracotta/10 text-terracotta-dark rounded-lg px-3 py-2 text-sm font-medium">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="btn-3d bg-terracotta text-cream w-full rounded-full px-6 py-3.5 text-base font-semibold disabled:cursor-wait disabled:opacity-60"
            >
              {busy ? "Processing…" : `Pay ${money(amount)}`}
            </button>
            <p className="text-charcoal/45 text-center text-[11px] leading-relaxed">
              🔒 Payments are processed securely by our gateway. We never store your full card number.
              <br />
              <span className="text-charcoal/35">Test cards — pay: 4242…, decline: …0002, 3D Secure: …3155 (OTP 123456)</span>
            </p>
          </form>
        ) : (
          <form onSubmit={confirm} className="mt-4 space-y-3">
            <div className="bg-oat/50 text-charcoal/70 rounded-xl p-3 text-sm">🔐 Your bank requires verification. Enter the one-time code sent to you.</div>
            <label className="text-espresso block text-sm font-semibold">
              Verification code
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                inputMode="numeric"
                placeholder="6-digit code"
                autoFocus
                className="border-oat mt-1 w-full rounded-xl border px-4 py-3 text-center text-lg tracking-widest"
              />
            </label>
            {error && <p className="bg-terracotta/10 text-terracotta-dark rounded-lg px-3 py-2 text-sm font-medium">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="btn-3d bg-espresso text-cream w-full rounded-full px-6 py-3.5 text-base font-semibold disabled:opacity-60"
            >
              {busy ? "Verifying…" : "Verify & pay"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
