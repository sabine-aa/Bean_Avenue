import type { PrismaClient } from "@prisma/client";

// Preferred homepage pick per category (falls back to best-seller / first item).
const PREFERRED: Record<string, string> = {
  "Espresso Based": "Cappuccino",
  "Filtered Coffee": "American",
  "Hot Drinks": "Spanish Latte",
  "Iced Drinks": "Iced Spanish Latte",
  "Frappes": "White Mocha Frappé",
  "Milkshakes": "Biscoff Milkshake",
  "Refreshers": "Fresh Orange Juice",
  "Desserts": "Brownie",
  "Freshly Baked": "Croissant",
  "Sandwiches": "Chicken Club Sandwich",
  "Salads": "Chicken Caesar Salad",
  "Protein Drinks": "Pink Avenue",
};

/** Seed one featured product PER category (category-locked). Manager can change it. */
export async function seedFeatured(prisma: PrismaClient) {
  await prisma.featuredProduct.deleteMany();

  const items = await prisma.menuItem.findMany({ where: { isHidden: false }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
  const cats: string[] = [];
  const byCat = new Map<string, typeof items>();
  for (const it of items) {
    if (!byCat.has(it.category)) { byCat.set(it.category, []); cats.push(it.category); }
    byCat.get(it.category)!.push(it);
  }

  let order = 0;
  for (const cat of cats) {
    const list = byCat.get(cat)!;
    const pick =
      list.find((i) => PREFERRED[cat] && i.name.toLowerCase() === PREFERRED[cat].toLowerCase()) ||
      list.find((i) => i.isBestSeller && i.inStock) ||
      list.find((i) => i.inStock) ||
      list[0];
    if (pick) await prisma.featuredProduct.create({ data: { category: cat, menuItemId: pick.id, sortOrder: order++ } });
  }

  for (const [key, value] of [["featured.title", "The usual suspects."], ["featured.visible", "true"], ["featured.limit", "0"]] as const) {
    await prisma.setting.upsert({ where: { key }, create: { key, value }, update: {} });
  }
  return order;
}
