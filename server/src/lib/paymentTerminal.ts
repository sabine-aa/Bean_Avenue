// Card-terminal abstraction for the register. Bean Avenue starts cash-only and
// takes cards on a STANDALONE bank machine (the cashier charges the card on the
// bank's own terminal, then keys the approval code into the POS) — that's the
// "manual" provider below. When the shop moves to an INTEGRATED terminal that
// talks to the POS directly (Areeba, Credit Libanais, BoB Finance, …), add a
// provider here that implements `capture()` by calling the acquirer's API and
// point the `pos.card.provider` setting at it — no change to the sale route.
import { getSettingsMap } from "./settings";

export type CardCapture = {
  approvalCode?: string; // the terminal's approval / reference number
  last4?: string; // last 4 digits of the card (optional, for receipt matching)
  brand?: string; // Visa / Mastercard / … (optional)
};

export type CaptureResult = {
  provider: string;
  status: "PAID";
  approvalCode: string | null;
  last4: string | null;
  brand: string | null;
  transactionRef: string | null; // set by integrated providers; null for manual
};

export interface TerminalProvider {
  readonly name: string;
  /**
   * Confirm a card payment for `amount`. A standalone terminal is already
   * charged on the bank's machine, so this just normalises the reference the
   * cashier entered. An integrated provider would call its API here and return
   * the acquirer's transaction reference.
   */
  capture(amount: number, input: CardCapture): Promise<CaptureResult>;
}

const manualProvider: TerminalProvider = {
  name: "manual",
  async capture(_amount, input) {
    return {
      provider: "manual",
      status: "PAID",
      approvalCode: input.approvalCode?.trim() || null,
      last4: (input.last4 || "").replace(/\D/g, "").slice(-4) || null,
      brand: input.brand?.trim() || null,
      transactionRef: null,
    };
  },
};

// Register integrated acquirers here, keyed by the `pos.card.provider` setting.
const PROVIDERS: Record<string, TerminalProvider> = {
  manual: manualProvider,
};

/** The card provider currently configured for the register. */
export async function terminalProvider(): Promise<TerminalProvider> {
  const map = await getSettingsMap();
  return PROVIDERS[map["pos.card.provider"] || "manual"] ?? manualProvider;
}
