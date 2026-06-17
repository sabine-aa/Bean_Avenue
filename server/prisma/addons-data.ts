import type { PrismaClient } from "@prisma/client";

// Starting add-on groups. The manager can edit names, prices, availability,
// assignments, single/multiple, and max quantity from the admin dashboard.
export const ADDON_GROUPS: {
  name: string;
  selection: "SINGLE" | "MULTIPLE";
  minSelect?: number;
  maxSelect?: number;
  categories: string[];
  addons: { name: string; price: number; maxQuantity?: number }[];
}[] = [
  {
    name: "Extra Shots",
    selection: "MULTIPLE",
    categories: ["Espresso Based", "Iced Drinks", "Hot Drinks", "Filtered Coffee", "Frappes", "Rakwah"],
    addons: [
      { name: "Extra espresso shot", price: 1.0, maxQuantity: 3 },
      { name: "Decaf shot", price: 1.0, maxQuantity: 3 },
    ],
  },
  {
    name: "Milk",
    selection: "SINGLE",
    categories: ["Espresso Based", "Iced Drinks", "Hot Drinks", "Filtered Coffee", "Frappes", "Milk Shakes"],
    addons: [
      { name: "Oat milk", price: 0.5 },
      { name: "Almond milk", price: 0.5 },
      { name: "Lactose-free milk", price: 0.5 },
    ],
  },
  {
    name: "Syrup",
    selection: "MULTIPLE",
    maxSelect: 3,
    categories: ["Espresso Based", "Iced Drinks", "Hot Drinks", "Frappes", "Milk Shakes", "Iced Teas", "Hot Teas", "Refreshers", "Beverages"],
    addons: [
      { name: "Vanilla", price: 0.5 },
      { name: "Caramel", price: 0.5 },
      { name: "Hazelnut", price: 0.5 },
      { name: "Chocolate", price: 0.5 },
      { name: "White chocolate", price: 0.5 },
    ],
  },
  {
    name: "Toppings",
    selection: "MULTIPLE",
    categories: ["Espresso Based", "Iced Drinks", "Frappes", "Milk Shakes", "Frozen Yogurt", "Desserts"],
    addons: [
      { name: "Whipped cream", price: 0.5 },
      { name: "Extra sauce", price: 0.5 },
      { name: "Extra toppings", price: 0.5 },
    ],
  },
];

/** Replace all add-on groups with the starting set. Preserves other data. */
export async function seedAddons(prisma: PrismaClient) {
  await prisma.addonAssignment.deleteMany();
  await prisma.addon.deleteMany();
  await prisma.addonGroup.deleteMany();

  for (let gi = 0; gi < ADDON_GROUPS.length; gi++) {
    const g = ADDON_GROUPS[gi];
    await prisma.addonGroup.create({
      data: {
        name: g.name,
        selection: g.selection,
        minSelect: g.minSelect ?? 0,
        maxSelect: g.selection === "SINGLE" ? 1 : g.maxSelect ?? 0,
        sortOrder: gi,
        addons: {
          create: g.addons.map((a, ai) => ({
            name: a.name,
            price: a.price,
            maxQuantity: a.maxQuantity ?? 1,
            sortOrder: ai,
          })),
        },
        assignments: { create: g.categories.map((category) => ({ category })) },
      },
    });
  }
  return ADDON_GROUPS.length;
}
