// Single entry point for turning a completed order into stock deductions.
// Recipe items deduct raw ingredients (Bill-of-Materials); items without a recipe
// fall back to the simple per-product finished-goods count. Both reverse on cancel.
import { prisma } from "../db";
import { consumeHansonForOrder, reverseHansonForOrder } from "./hanson";
import { recordStockSale, restoreStock, type SaleLine } from "./inventory";
import { deductRecipes, restoreRecipes, type ConsumptionLine } from "./recipe";

const round = (n: number) => Math.round((Number(n) || 0) * 1000) / 1000;

/** Deduct retail (shop) product stock for a sale — simple quantity, no recipe. */
export async function consumeShopForOrder(
  items: { shopProductId: number; quantity: number }[],
  opts: { orderId?: number; staffName?: string } = {},
): Promise<void> {
  for (const it of items) {
    const qty = Math.max(0, round(it.quantity));
    if (!qty) continue;
    const p = await prisma.shopProduct.findUnique({ where: { id: Number(it.shopProductId) } });
    if (!p) continue;
    const balance = round(p.quantity - qty);
    await prisma.shopProduct.update({ where: { id: p.id }, data: { quantity: balance } });
    await prisma.shopStockMovement.create({
      data: { productId: p.id, delta: -qty, balance, type: "SALE", reason: "Sale", staffName: opts.staffName ?? "Staff", orderId: opts.orderId },
    });
  }
}

/** Restore retail stock when an order that sold shop products is cancelled (idempotent). */
export async function reverseShopForOrder(orderId: number): Promise<void> {
  const already = await prisma.shopStockMovement.findFirst({ where: { orderId, type: "ADJUST", reason: { contains: "Reversal of sale" } } });
  if (already) return;
  const sales = await prisma.shopStockMovement.findMany({ where: { orderId, type: "SALE" } });
  for (const s of sales) {
    const p = await prisma.shopProduct.findUnique({ where: { id: s.productId } });
    if (!p) continue;
    const restore = -s.delta; // SALE delta is negative
    const balance = round(p.quantity + restore);
    await prisma.shopProduct.update({ where: { id: p.id }, data: { quantity: balance } });
    await prisma.shopStockMovement.create({
      data: { productId: p.id, delta: restore, balance, type: "ADJUST", reason: `Reversal of sale (order ${orderId})`, staffName: "System", orderId },
    });
  }
}

export async function consumeForOrder(items: ConsumptionLine[], opts: { orderId?: number; staffName?: string } = {}): Promise<void> {
  // Recipes take precedence; whatever they cover is excluded from finished-goods.
  const recipeItemIds = await deductRecipes(items, opts);
  const rest: SaleLine[] = items.filter((i) => !recipeItemIds.has(Number(i.menuItemId))).map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity }));
  await recordStockSale(rest, opts);
  await consumeHansonForOrder(items, opts); // Hanson doughnuts: decrement today's stock
}

export async function reverseForOrder(orderId: number): Promise<void> {
  await restoreRecipes(orderId); // raw ingredients
  await restoreStock(orderId); // finished-goods
  await reverseShopForOrder(orderId); // retail products
  await reverseHansonForOrder(orderId); // Hanson doughnuts
}
