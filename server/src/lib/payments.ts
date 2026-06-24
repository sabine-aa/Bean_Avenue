import { genNumber, round2 } from "./helpers";

// ---------------------------------------------------------------------------
// Payment gateway abstraction.
//
// The app talks to a payment gateway ONLY through the PaymentProvider interface
// below. A real provider (Stripe, Telr, PayTabs, Checkout.com, ...) is dropped
// in by implementing this interface and exporting it as `paymentProvider` — no
// route or UI code changes.
//
// IMPORTANT: full card data (PAN, expiry, CVV) is NEVER persisted. The gateway
// owns it. With a real gateway the card details are captured by the gateway's
// own SDK/hosted page and never touch this server. The MockProvider below
// simulates that boundary: it accepts a test card number, derives only the safe
// brand + last4, authorises/declines, and discards everything else.
// ---------------------------------------------------------------------------

export interface CreatePaymentInput {
  amount: number;
  currency: string;
  orderId?: number;
  customerId?: number;
  /** Test-only: the card number entered in the mock card form. Never stored. */
  cardNumber?: string;
}

export type PaymentOutcome = "PAID" | "FAILED" | "REQUIRES_3DS";

export interface PaymentResult {
  provider: string;
  transactionId: string;
  outcome: PaymentOutcome;
  cardBrand?: string;
  cardLast4?: string;
  failureReason?: string;
}

export interface RefundResult {
  status: "REFUNDED" | "PARTIALLY_REFUNDED";
  refundedAmount: number;
}

export interface PaymentProvider {
  readonly name: string;
  /** Authorise a payment. May return REQUIRES_3DS, which the client resolves via confirm3DS. */
  createPayment(input: CreatePaymentInput): Promise<PaymentResult>;
  /** Complete a 3D Secure / OTP challenge for a pending transaction. */
  confirm3DS(transactionId: string, otp: string): Promise<PaymentResult>;
  /** Refund all or part of a captured payment. */
  refund(transactionId: string, amount: number, alreadyRefunded: number, originalAmount: number): Promise<RefundResult>;
}

function cardBrand(num: string): string {
  const n = num.replace(/\D/g, "");
  if (/^4/.test(n)) return "Visa";
  if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return "Mastercard";
  if (/^3[47]/.test(n)) return "Amex";
  if (/^6/.test(n)) return "Discover";
  return "Card";
}

/**
 * A deterministic in-memory gateway for development & testing. Behaviour is
 * driven by the test card number so every checkout scenario is reproducible:
 *
 *   • ends in 0002  -> declined (FAILED)
 *   • ends in 3155  -> requires 3D Secure (OTP 123456 approves, anything else fails)
 *   • anything else -> approved (PAID)
 *
 * Pending 3DS challenges are held in memory keyed by transactionId.
 */
class MockProvider implements PaymentProvider {
  readonly name = "mock";
  private pending = new Map<string, { last4: string; brand: string }>();

  async createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
    const raw = (input.cardNumber ?? "").replace(/\D/g, "");
    const last4 = raw.slice(-4) || "0000";
    const brand = cardBrand(raw);
    const transactionId = genNumber("MOCK");

    if (raw.endsWith("0002")) {
      return { provider: this.name, transactionId, outcome: "FAILED", cardBrand: brand, cardLast4: last4, failureReason: "Your card was declined." };
    }
    if (raw.endsWith("3155")) {
      this.pending.set(transactionId, { last4, brand });
      return { provider: this.name, transactionId, outcome: "REQUIRES_3DS", cardBrand: brand, cardLast4: last4 };
    }
    return { provider: this.name, transactionId, outcome: "PAID", cardBrand: brand, cardLast4: last4 };
  }

  async confirm3DS(transactionId: string, otp: string): Promise<PaymentResult> {
    const held = this.pending.get(transactionId);
    if (!held) {
      return { provider: this.name, transactionId, outcome: "FAILED", failureReason: "This payment session expired. Please try again." };
    }
    this.pending.delete(transactionId);
    if (otp.trim() === "123456") {
      return { provider: this.name, transactionId, outcome: "PAID", cardBrand: held.brand, cardLast4: held.last4 };
    }
    return { provider: this.name, transactionId, outcome: "FAILED", cardBrand: held.brand, cardLast4: held.last4, failureReason: "3D Secure verification failed." };
  }

  async refund(_transactionId: string, amount: number, alreadyRefunded: number, originalAmount: number): Promise<RefundResult> {
    const totalRefunded = round2(alreadyRefunded + amount);
    return {
      status: totalRefunded >= originalAmount ? "REFUNDED" : "PARTIALLY_REFUNDED",
      refundedAmount: totalRefunded,
    };
  }
}

// The active provider. Swap this line to use a real gateway implementation.
export const paymentProvider: PaymentProvider = new MockProvider();
