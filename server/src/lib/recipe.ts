// Recipe-based (Bill-of-Materials) consumption: turn what was sold into how much
// raw stock to deduct. A menu item's recipe is a set of RecipeComponents, each
// optionally scoped to a size and/or an add-on:
//   size = null → applies to every size; addonId set → consumed when that add-on
//   is chosen (on top of the base recipe).
import { prisma } from "../db";

export type ConsumptionLine = {
  menuItemId: number;
  quantity: number;
  selectedOptions?: { group: string; choice: string }[];
  addons?: { addonId: number; quantity: number }[];
};

const round = (n: number) => Math.round(n * 1000) / 1000;

// The chosen size label for a line (from its "Size" option), or null.
function sizeOf(line: ConsumptionLine): string | null {
  const s = (line.selectedOptions ?? []).find((o) => o.group?.toLowerCase() === "size");
  return s ? s.choice : null;
}

/** Menu items (among `ids`) that have any recipe — so finished-goods deduction skips them. */
export async function menuItemIdsWithRecipe(ids: number[]): Promise<Set<number>> {
  if (!ids.length) return new Set();
  const rows = await prisma.recipeComponent.findMany({ where: { menuItemId: { in: ids } }, select: { menuItemId: true }, distinct: ["menuItemId"] });
  return new Set(rows.map((r) => r.menuItemId));
}

/** Total stock consumption for a set of order lines → Map<inventoryItemId, quantity>. */
export async function resolveConsumption(items: ConsumptionLine[]): Promise<Map<number, number>> {
  const need = new Map<number, number>();
  const add = (invId: number, qty: number) => need.set(invId, round((need.get(invId) ?? 0) + qty));
  const menuIds = [...new Set(items.map((i) => Number(i.menuItemId)))];
  if (!menuIds.length) return need;
  const comps = await prisma.recipeComponent.findMany({ where: { menuItemId: { in: menuIds } } });
  if (!comps.length) return need;

  for (const line of items) {
    const mid = Number(line.menuItemId);
    const qty = Number(line.quantity) || 1;
    const size = sizeOf(line);
    const chosenAddonIds = new Set((line.addons ?? []).map((a) => Number(a.addonId)));
    // REPLACE add-ons: any base ingredient these swap out must NOT be deducted
    // (e.g. Oat Milk add-on replaces Milk → deduct oat milk, not regular milk).
    const replaced = new Set<number>();
    for (const c of comps) {
      if (c.menuItemId === mid && c.addonId != null && chosenAddonIds.has(c.addonId) && c.replacesInventoryItemId != null) {
        replaced.add(c.replacesInventoryItemId);
      }
    }
    // Base recipe: no add-on, size unset or matching the chosen size, not replaced.
    for (const c of comps) {
      if (c.menuItemId !== mid || c.addonId != null) continue;
      if (c.size != null && c.size !== size) continue;
      if (replaced.has(c.inventoryItemId)) continue;
      add(c.inventoryItemId, c.quantity * qty);
    }
    // Add-on recipes: consumed per chosen add-on (× its quantity).
    for (const a of line.addons ?? []) {
      const aId = Number(a.addonId);
      const aQty = Number(a.quantity) || 1;
      for (const c of comps) {
        if (c.menuItemId !== mid || c.addonId !== aId) continue;
        if (c.size != null && c.size !== size) continue;
        add(c.inventoryItemId, c.quantity * qty * aQty);
      }
    }
  }
  return need;
}

/**
 * Deduct recipe ingredients for an order and log a SALE movement per stock item.
 * Clamped at 0 (never negative). Returns the set of menuItemIds that had recipes
 * so the caller can skip finished-goods deduction for those items.
 */
export async function deductRecipes(items: ConsumptionLine[], opts: { orderId?: number; staffName?: string } = {}): Promise<Set<number>> {
  const menuIds = [...new Set(items.map((i) => Number(i.menuItemId)))];
  const handled = await menuItemIdsWithRecipe(menuIds);
  if (!handled.size) return handled;
  const need = await resolveConsumption(items);
  for (const [invId, qty] of need) {
    if (qty <= 0) continue;
    const item = await prisma.inventoryItem.findUnique({ where: { id: invId } });
    if (!item) continue;
    const balance = round(Math.max(0, item.quantity - qty));
    await prisma.inventoryItem.update({ where: { id: invId }, data: { quantity: balance } });
    await prisma.inventoryMovement.create({
      data: { inventoryItemId: invId, delta: -qty, balance, type: "SALE", orderId: opts.orderId ?? null, staffName: opts.staffName ?? null },
    });
  }
  return handled;
}

/** Put back recipe ingredients an order consumed (idempotent per order). */
export async function restoreRecipes(orderId: number): Promise<void> {
  const sales = await prisma.inventoryMovement.findMany({ where: { orderId, type: "SALE" } });
  if (!sales.length) return;
  const reversed = new Set(
    (await prisma.inventoryMovement.findMany({ where: { orderId, type: "REFUND_REVERSAL" }, select: { inventoryItemId: true } })).map((m) => m.inventoryItemId),
  );
  for (const s of sales) {
    if (reversed.has(s.inventoryItemId)) continue;
    const back = -s.delta;
    const item = await prisma.inventoryItem.update({ where: { id: s.inventoryItemId }, data: { quantity: { increment: back } } });
    await prisma.inventoryMovement.create({
      data: { inventoryItemId: s.inventoryItemId, delta: back, balance: item.quantity, type: "REFUND_REVERSAL", orderId, reason: "Order cancelled" },
    });
  }
}
