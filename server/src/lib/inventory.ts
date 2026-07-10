// Finished-goods stock: menu items with `trackStock` carry a running `stockQty`
// that is auto-deducted on every sale (online + register) and audited in
// StockMovement. Untracked items (made-to-order drinks) are ignored entirely.
import { prisma } from "../db";

type SaleLine = { menuItemId: number; quantity: number; name?: string };

/** Sum requested quantity per menu item (an item can appear on several lines). */
function needsByItem(items: SaleLine[]): Map<number, number> {
  const need = new Map<number, number>();
  for (const l of items) {
    const id = Number(l.menuItemId);
    need.set(id, (need.get(id) ?? 0) + (Number(l.quantity) || 0));
  }
  return need;
}

/**
 * Reject a sale that would oversell a tracked item. Returns an error string to
 * surface to the customer/cashier, or null when every line is in stock.
 */
export async function validateStock(items: SaleLine[]): Promise<string | null> {
  const need = needsByItem(items);
  if (!need.size) return null;
  const rows = await prisma.menuItem.findMany({
    where: { id: { in: [...need.keys()] }, trackStock: true },
    select: { id: true, name: true, stockQty: true },
  });
  for (const r of rows) {
    const want = need.get(r.id) ?? 0;
    if (want > r.stockQty) {
      return r.stockQty <= 0 ? `${r.name} is sold out.` : `Only ${r.stockQty} ${r.name} left.`;
    }
  }
  return null;
}

/**
 * Deduct stock for a completed sale and log a SALE movement per tracked item.
 * The decrement is guarded (`stockQty >= want`) so concurrent registers can't
 * drive stock negative; if a race loses the guard, stock is clamped at 0 and a
 * short movement is logged rather than failing an already-paid sale.
 */
export async function recordStockSale(items: SaleLine[], opts: { orderId?: number; staffName?: string } = {}): Promise<void> {
  const need = needsByItem(items);
  if (!need.size) return;
  const rows = await prisma.menuItem.findMany({
    where: { id: { in: [...need.keys()] }, trackStock: true },
    select: { id: true, stockQty: true },
  });
  for (const r of rows) {
    const want = need.get(r.id) ?? 0;
    if (want <= 0) continue;
    const guarded = await prisma.menuItem.updateMany({
      where: { id: r.id, stockQty: { gte: want } },
      data: { stockQty: { decrement: want } },
    });
    let balance: number;
    if (guarded.count === 0) {
      // Lost the race (stock already lower than expected) — clamp at 0.
      await prisma.menuItem.update({ where: { id: r.id }, data: { stockQty: 0 } });
      balance = 0;
    } else {
      balance = r.stockQty - want;
    }
    await prisma.stockMovement.create({
      data: { menuItemId: r.id, delta: -want, balance, type: "SALE", orderId: opts.orderId ?? null, staffName: opts.staffName ?? null },
    });
  }
}

/**
 * Put back the stock a cancelled/undone order had deducted. Idempotent per
 * order: it only reverses SALE movements that haven't already been reversed,
 * so calling it twice for the same order is a no-op.
 */
export async function restoreStock(orderId: number): Promise<void> {
  const sales = await prisma.stockMovement.findMany({ where: { orderId, type: "SALE" } });
  if (!sales.length) return;
  const reversed = new Set(
    (await prisma.stockMovement.findMany({ where: { orderId, type: "RESTORE" }, select: { menuItemId: true } })).map((m) => m.menuItemId)
  );
  for (const s of sales) {
    if (reversed.has(s.menuItemId)) continue; // already restored
    const back = -s.delta; // SALE delta is negative
    const item = await prisma.menuItem.update({ where: { id: s.menuItemId }, data: { stockQty: { increment: back } } });
    await prisma.stockMovement.create({
      data: { menuItemId: s.menuItemId, delta: back, balance: item.stockQty, type: "RESTORE", orderId, reason: "Order cancelled" },
    });
  }
}
