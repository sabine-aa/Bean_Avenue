import type { PrismaClient } from "@prisma/client";

// Starting rewards: one per menu category with the manager's chosen bean values.
// The manager can change all of this from the admin dashboard at any time.
export const CATEGORY_REWARDS: { category: string; name: string; cost: number; description: string }[] = [
  { category: "Special Item", name: "Manager's Special Pick", cost: 100, description: "A rotating free item chosen by the team — ask at the counter." },
  { category: "Espresso Based", name: "Free Espresso Drink", cost: 80, description: "Any espresso-based drink, on the house." },
  { category: "Sandwiches", name: "Free Sandwich", cost: 180, description: "Pick any sandwich from the menu." },
  { category: "Salads", name: "Free Salad", cost: 170, description: "Any fresh salad of your choice." },
  { category: "Freshly Baked", name: "Free Freshly Baked Treat", cost: 90, description: "A freshly baked treat, free with your beans." },
  { category: "Desserts", name: "Free Dessert", cost: 120, description: "Any dessert from our selection." },
  { category: "Beverages", name: "Free Beverage", cost: 70, description: "Any beverage on us." },
  { category: "Refreshers", name: "Free Refresher", cost: 90, description: "A refreshing pick-me-up of your choice." },
  { category: "Iced Teas", name: "Free Iced Tea", cost: 80, description: "Any iced tea, free." },
  { category: "Milk Shakes", name: "Free Milkshake", cost: 110, description: "Any milkshake of your choice." },
  { category: "Frappes", name: "Free Frappe", cost: 110, description: "Any frappe, on the house." },
  { category: "Hot Teas", name: "Free Hot Tea", cost: 60, description: "Any hot tea of your choice." },
  { category: "Rakwah", name: "Free Rakwah", cost: 70, description: "A traditional rakwah, free with your beans." },
  { category: "Frozen Yogurt", name: "Free Frozen Yogurt", cost: 130, description: "Any frozen yogurt of your choice." },
  { category: "Iced Drinks", name: "Free Iced Drink", cost: 90, description: "Any iced drink on us." },
  { category: "Filtered Coffee", name: "Free Filtered Coffee", cost: 60, description: "A cup of filtered coffee, free." },
  { category: "Hot Drinks", name: "Free Hot Drink", cost: 70, description: "Any hot drink of your choice." },
];

/**
 * Replace all rewards with the category-based starting set, pulling a real
 * product image from each menu category. Preserves customers/orders/etc.
 */
export async function seedCategoryRewards(prisma: PrismaClient) {
  // Detach past redemptions, then clear existing rewards so this is repeatable.
  await prisma.redemption.updateMany({ data: { rewardId: null } });
  await prisma.reward.deleteMany();

  for (let i = 0; i < CATEGORY_REWARDS.length; i++) {
    const r = CATEGORY_REWARDS[i];
    const sample = await prisma.menuItem.findFirst({
      where: { category: r.category, photo: { not: null } },
      select: { photo: true },
    });
    await prisma.reward.create({
      data: {
        name: r.name,
        description: r.description,
        category: r.category,
        cost: r.cost,
        image: sample?.photo ?? null,
        sortOrder: i,
      },
    });
  }
  return CATEGORY_REWARDS.length;
}
