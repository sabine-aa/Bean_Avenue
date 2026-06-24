// Promo codes mirrored from the backend (server/src/lib/helpers.ts) so the cart
// and checkout can show an accurate discount estimate. The server re-validates
// and stays authoritative when the order is placed.
export const PROMOS: Record<string, number> = { BEAN10: 0.1, WELCOME: 0.15 };

export interface PromoInfo {
  code: string;
  rate: number;
}

/** Returns the matched promo (normalised code + rate) or null if unknown. */
export function promoInfo(code: string): PromoInfo | null {
  const c = code.trim().toUpperCase();
  const rate = PROMOS[c];
  return rate ? { code: c, rate } : null;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
