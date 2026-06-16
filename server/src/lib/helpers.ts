import { prisma } from "../db";

// ---- Loyalty tiers & rewards ----

export const TIERS = [
  { name: "Bronze", min: 0 },
  { name: "Silver", min: 100 },
  { name: "Gold", min: 300 },
];

export function tierFor(lifetimeBeans: number): string {
  let tier = TIERS[0].name;
  for (const t of TIERS) if (lifetimeBeans >= t.min) tier = t.name;
  return tier;
}

export function nextTierInfo(lifetimeBeans: number): { name: string; beansToGo: number } | null {
  const next = TIERS.find((t) => t.min > lifetimeBeans);
  return next ? { name: next.name, beansToGo: next.min - lifetimeBeans } : null;
}

// ---- Promo codes (subtotal multiplier discount) ----

const PROMOS: Record<string, number> = {
  BEAN10: 0.1,
  WELCOME: 0.15,
};

export function promoDiscount(code: string | undefined, subtotal: number): number {
  if (!code) return 0;
  const rate = PROMOS[code.trim().toUpperCase()];
  return rate ? round2(subtotal * rate) : 0;
}

// ---- Misc helpers ----

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function genNumber(prefix: string): string {
  const stamp = Date.now().toString(36).slice(-5).toUpperCase();
  const rand = Math.floor(Math.random() * 36 ** 2)
    .toString(36)
    .toUpperCase()
    .padStart(2, "0");
  return `${prefix}-${stamp}${rand}`;
}

/** Find a customer by phone, creating one if needed. */
export async function getOrCreateCustomer(phone: string, name: string) {
  const existing = await prisma.customer.findUnique({ where: { phone } });
  if (existing) return existing;
  return prisma.customer.create({ data: { phone, name: name || "Guest" } });
}

/**
 * Credit a customer with beans for an order/booking and log the transaction.
 * Updates the bean balance, lifetime total, and tier.
 */
export async function earnBeans(
  customerId: number,
  amount: number,
  source: string,
  refId: string
) {
  if (amount <= 0) return;
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) return;
  const lifetimeBeans = customer.lifetimeBeans + amount;
  const balanceAfter = customer.beanBalance + amount;
  await prisma.customer.update({
    where: { id: customerId },
    data: {
      beanBalance: balanceAfter,
      lifetimeBeans,
      tier: tierFor(lifetimeBeans),
    },
  });
  await prisma.loyaltyTransaction.create({
    data: { customerId, type: "EARN", amount, balanceAfter, source, refId },
  });
}

/** Start/end of a YYYY-MM-DD day in the server's local timezone. */
export function dayBounds(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d, 23, 59, 59, 999);
  return { start, end };
}
