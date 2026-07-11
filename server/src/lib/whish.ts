import { genNumber } from "./helpers";

// ---------------------------------------------------------------------------
// Whish payment seam.
//
// Whish (whish.money) is a redirect/approve flow, NOT a card form: we create a
// "collection" for the order, send the customer to Whish to approve it in their
// app, and Whish confirms the outcome (via a redirect back + a server callback,
// or by polling the collection status).
//
// The app talks to Whish ONLY through the WhishProvider interface below. Until
// real merchant credentials exist, a MockWhishProvider drives the whole flow so
// checkout is testable end-to-end in development. When the WHISH_* env vars are
// set, the real provider takes over — no route or UI changes needed.
//
// SAFETY: `isConfigured` is false until real credentials are present. The
// payment routes refuse to settle a Whish order in production while
// unconfigured, so a customer can never get a "paid" order without money moving.
// ---------------------------------------------------------------------------

export type WhishOutcome = "PAID" | "PENDING" | "FAILED";

export interface CreateCollectionInput {
  amount: number;
  currency: string;
  orderNumber: string;
  /** Our idempotency key for this collection (unique per order attempt). */
  externalId: string;
  /** Where Whish sends the customer back after they approve/decline. */
  successRedirectUrl: string;
  failureRedirectUrl: string;
}

export interface CreateCollectionResult {
  transactionId: string;
  /** URL to send the customer to so they can approve in Whish. Empty in mock. */
  redirectUrl: string;
  /** True when this provider is the mock (client shows an inline approve step). */
  mock: boolean;
}

export interface WhishProvider {
  readonly name: string;
  /** Whether real credentials are wired. False = mock / not safe to take real money. */
  readonly isConfigured: boolean;
  createCollection(input: CreateCollectionInput): Promise<CreateCollectionResult>;
  /** Current outcome of a collection, keyed by our externalId. */
  getStatus(externalId: string): Promise<WhishOutcome>;
}

/**
 * Development/testing provider. Holds collections in memory and lets the client
 * approve them inline (no real Whish app). Every mock collection resolves PAID
 * once the client calls confirm — good enough to exercise the full order flow.
 */
class MockWhishProvider implements WhishProvider {
  readonly name = "whish-mock";
  readonly isConfigured = false;
  private collections = new Map<string, WhishOutcome>();

  async createCollection(input: CreateCollectionInput): Promise<CreateCollectionResult> {
    this.collections.set(input.externalId, "PENDING");
    return { transactionId: genNumber("WHISH-MOCK"), redirectUrl: "", mock: true };
  }

  async getStatus(externalId: string): Promise<WhishOutcome> {
    return this.collections.get(externalId) ?? "FAILED";
  }

  /** Mock-only: the client "approves" the collection, flipping it to PAID. */
  approve(externalId: string) {
    if (this.collections.has(externalId)) this.collections.set(externalId, "PAID");
  }
}

/**
 * Real Whish Money provider. Activated when the WHISH_* env vars are present.
 * The HTTP shape follows the Whish "collect" API: create a collection, receive
 * a collectUrl to redirect the customer to, then read the collection status.
 *
 * The exact endpoint paths/field names come from the merchant's Whish account;
 * they're isolated here so wiring the real account is a localized change.
 */
class WhishApiProvider implements WhishProvider {
  readonly name = "whish";
  readonly isConfigured = true;
  constructor(
    private base: string,
    private channel: string,
    private secret: string,
    private websiteUrl: string,
  ) {}

  private headers() {
    return {
      "Content-Type": "application/json",
      channel: this.channel,
      secret: this.secret,
      websiteurl: this.websiteUrl,
    };
  }

  async createCollection(input: CreateCollectionInput): Promise<CreateCollectionResult> {
    const res = await fetch(`${this.base}/payment/whish`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        amount: input.amount,
        currency: input.currency,
        invoice: `Order ${input.orderNumber}`,
        externalId: input.externalId,
        successCallbackUrl: input.successRedirectUrl,
        failureCallbackUrl: input.failureRedirectUrl,
        successRedirectUrl: input.successRedirectUrl,
        failureRedirectUrl: input.failureRedirectUrl,
      }),
    });
    const json = (await res.json()) as { status?: boolean; data?: { collectUrl?: string } };
    if (!res.ok || !json?.data?.collectUrl) throw new Error("Whish: couldn't create the payment.");
    return { transactionId: input.externalId, redirectUrl: json.data.collectUrl, mock: false };
  }

  async getStatus(externalId: string): Promise<WhishOutcome> {
    const res = await fetch(`${this.base}/payment/collect/status?externalId=${encodeURIComponent(externalId)}`, {
      headers: this.headers(),
    });
    const json = (await res.json()) as { data?: { collectStatus?: string } };
    const s = String(json?.data?.collectStatus ?? "").toLowerCase();
    if (s === "success" || s === "paid") return "PAID";
    if (s === "pending") return "PENDING";
    return "FAILED";
  }
}

function buildProvider(): WhishProvider {
  const base = process.env.WHISH_API_BASE;
  const channel = process.env.WHISH_CHANNEL;
  const secret = process.env.WHISH_SECRET;
  const websiteUrl = process.env.WHISH_WEBSITE_URL;
  if (base && channel && secret && websiteUrl) {
    return new WhishApiProvider(base, channel, secret, websiteUrl);
  }
  return new MockWhishProvider();
}

// The active provider. Real when WHISH_* env vars are set, mock otherwise.
export const whishProvider: WhishProvider = buildProvider();

/** Mock-only helper the confirm route uses to approve a pending mock collection. */
export function approveMockCollection(externalId: string): boolean {
  if (whishProvider instanceof MockWhishProvider) {
    whishProvider.approve(externalId);
    return true;
  }
  return false;
}
