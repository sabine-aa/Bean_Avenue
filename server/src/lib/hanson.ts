import { prisma } from "../db";
import { DOUGHNUT_CATEGORY } from "./constants";

// Business "today" in Beirut (UTC+3 approx) — the doughnut day. The shop closes
// at midnight, so this rolls over while closed.
const BEIRUT_OFFSET_MS = 3 * 3600 * 1000;
export function hansonToday(at: Date = new Date()): string {
  return new Date(at.getTime() + BEIRUT_OFFSET_MS).toISOString().slice(0, 10);
}

async function doughnutIds(): Promise<Set<number>> {
  const rows = await prisma.menuItem.findMany({ where: { category: DOUGHNUT_CATEGORY }, select: { id: true } });
  return new Set(rows.map((r) => r.id));
}

export type HansonAvail = { made: number; sold: number; remaining: number };
export async function hansonMap(date: string): Promise<Map<number, HansonAvail>> {
  const rows = await prisma.hansonProduction.findMany({ where: { date } });
  const m = new Map<number, HansonAvail>();
  for (const r of rows) m.set(r.menuItemId, { made: r.made, sold: r.sold, remaining: Math.max(0, r.made - r.sold) });
  return m;
}

type Line = { menuItemId?: number | null; quantity: number };

/** Returns an error message if any doughnut in the order exceeds today's remaining. */
export async function checkHansonAvailability(items: Line[]): Promise<string | null> {
  const ids = await doughnutIds();
  const donuts = items.filter((i) => i.menuItemId && ids.has(Number(i.menuItemId)));
  if (!donuts.length) return null;
  const map = await hansonMap(hansonToday());
  const req = new Map<number, number>();
  for (const d of donuts) req.set(Number(d.menuItemId), (req.get(Number(d.menuItemId)) ?? 0) + Math.max(1, Number(d.quantity) || 1));
  for (const [id, qty] of req) {
    const a = map.get(id);
    if (!a) continue; // not produced/tracked today → unlimited (untracked)
    if (qty > a.remaining) {
      const item = await prisma.menuItem.findUnique({ where: { id }, select: { name: true } });
      return a.remaining <= 0 ? `${item?.name ?? "That doughnut"} is sold out today.` : `Only ${a.remaining} ${item?.name ?? "doughnut"}${a.remaining === 1 ? "" : "s"} left today.`;
    }
  }
  return null;
}

/** Increment today's sold count for any TRACKED doughnut (has a production row). */
export async function consumeHansonForOrder(items: Line[], _opts: { staffName?: string } = {}): Promise<void> {
  const ids = await doughnutIds();
  const date = hansonToday();
  for (const it of items) {
    if (!it.menuItemId || !ids.has(Number(it.menuItemId))) continue;
    const qty = Math.max(1, Math.round(Number(it.quantity) || 1));
    await prisma.hansonProduction.updateMany({ where: { menuItemId: Number(it.menuItemId), date }, data: { sold: { increment: qty } } });
  }
}

/** Restore today's/that-day's sold count when an order with doughnuts is cancelled. */
export async function reverseHansonForOrder(orderId: number): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return;
  const date = hansonToday(order.createdAt);
  const ids = await doughnutIds();
  for (const it of order.items) {
    if (!it.menuItemId || !ids.has(it.menuItemId)) continue;
    await prisma.hansonProduction.updateMany({ where: { menuItemId: it.menuItemId, date }, data: { sold: { decrement: it.quantity } } });
  }
}
