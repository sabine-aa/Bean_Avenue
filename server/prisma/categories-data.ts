import type { PrismaClient } from "@prisma/client";

// Coffee-shop display order: coffee first, through hot/cold drinks, then food,
// with "Special Item" always last. The manager can rearrange this in the admin.
export const CATEGORY_ORDER = [
  "Espresso Based",
  "Hot Drinks",
  "Filtered Coffee",
  "Rakwah",
  "Hot Teas",
  "Iced Drinks",
  "Refreshers",
  "Iced Teas",
  "Frappes",
  "Milk Shakes",
  "Beverages",
  "Freshly Baked",
  "Desserts",
  "Frozen Yogurt",
  "Sandwiches",
  "Salads",
  "Special Item",
];

/** Upsert the categories with their display order. Safe to re-run; preserves other data. */
export async function seedCategories(prisma: PrismaClient) {
  for (let i = 0; i < CATEGORY_ORDER.length; i++) {
    await prisma.category.upsert({
      where: { name: CATEGORY_ORDER[i] },
      create: { name: CATEGORY_ORDER[i], sortOrder: i },
      update: { sortOrder: i },
    });
  }
  return CATEGORY_ORDER.length;
}
