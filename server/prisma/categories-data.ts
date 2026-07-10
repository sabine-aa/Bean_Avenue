import type { PrismaClient } from "@prisma/client";

// Display order for the real Bean Avenue menu (matches the printed menu boards).
// Hanson Doughnuts is last — it has its own page, not the main menu grid.
// The manager can rearrange all of this from the admin dashboard.
export const CATEGORY_ORDER = [
  "Espresso Based",
  "Filtered Coffee",
  "Hot Drinks",
  "Iced Drinks",
  "Special Items",
  "Rakwah",
  "Frappes",
  "Milkshakes",
  "Hot Teas",
  "Refreshers",
  "Iced Teas",
  "Beverages",
  "Protein Drinks",
  "Soft Cream",
  "Desserts",
  "Freshly Baked",
  "Salads",
  "Sandwiches",
  "Hanson Doughnuts",
];

/** Upsert the categories with their display order, pruning any that are no longer
 *  part of the menu. Safe to re-run; preserves other data. */
export async function seedCategories(prisma: PrismaClient) {
  await prisma.category.deleteMany({ where: { name: { notIn: CATEGORY_ORDER } } });
  for (let i = 0; i < CATEGORY_ORDER.length; i++) {
    await prisma.category.upsert({
      where: { name: CATEGORY_ORDER[i] },
      create: { name: CATEGORY_ORDER[i], sortOrder: i },
      update: { sortOrder: i },
    });
  }
  return CATEGORY_ORDER.length;
}
