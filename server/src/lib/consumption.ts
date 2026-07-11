// Single entry point for turning a completed order into stock deductions.
// Recipe items deduct raw ingredients (Bill-of-Materials); items without a recipe
// fall back to the simple per-product finished-goods count. Both reverse on cancel.
import { recordStockSale, restoreStock, type SaleLine } from "./inventory";
import { deductRecipes, restoreRecipes, type ConsumptionLine } from "./recipe";

export async function consumeForOrder(items: ConsumptionLine[], opts: { orderId?: number; staffName?: string } = {}): Promise<void> {
  // Recipes take precedence; whatever they cover is excluded from finished-goods.
  const recipeItemIds = await deductRecipes(items, opts);
  const rest: SaleLine[] = items
    .filter((i) => !recipeItemIds.has(Number(i.menuItemId)))
    .map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity }));
  await recordStockSale(rest, opts);
}

export async function reverseForOrder(orderId: number): Promise<void> {
  await restoreRecipes(orderId); // raw ingredients
  await restoreStock(orderId); // finished-goods
}
