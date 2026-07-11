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
  // Coffee/drink add-ons, split into clean groups. Milk is SINGLE-choice so a
  // drink can't end up with two milks. Prices are straight off the menu board
  // (each syrup flavour + each non-dairy milk uses the board's price).
  {
    name: "Milk",
    selection: "SINGLE",
    categories: ["Espresso Based", "Filtered Coffee", "Hot Drinks", "Iced Drinks", "Frappes"],
    addons: [
      { name: "Regular", price: 0 },
      { name: "Lactose Free", price: 0.33 },
      { name: "Oat Milk", price: 1.0 },
      { name: "Almond Milk", price: 1.0 },
      { name: "Soy Milk", price: 1.0 },
      { name: "Coconut Milk", price: 1.0 },
    ],
  },
  {
    name: "Syrup Flavor",
    selection: "MULTIPLE",
    categories: ["Espresso Based", "Filtered Coffee", "Hot Drinks", "Iced Drinks", "Frappes"],
    addons: [
      { name: "Caramel", price: 0.33 },
      { name: "Vanilla", price: 0.33 },
      { name: "Hazelnut", price: 0.33 },
      { name: "Chocolate", price: 0.33 },
      { name: "White Mocha", price: 0.33 },
    ],
  },
  // Hot coffee options — Extra Hot makes sense, no ice option.
  {
    name: "Coffee Options",
    selection: "MULTIPLE",
    categories: ["Espresso Based", "Filtered Coffee", "Hot Drinks"],
    addons: [
      { name: "Decaf", price: 0.75 },
      { name: "Extra Shot", price: 1.0 },
      { name: "Extra Hot", price: 0 },
    ],
  },
  // Iced coffee options — Less Ice makes sense, no hot option.
  {
    name: "Coffee Options",
    selection: "MULTIPLE",
    categories: ["Iced Drinks", "Frappes"],
    addons: [
      { name: "Decaf", price: 0.75 },
      { name: "Extra Shot", price: 1.0 },
      { name: "Less Ice", price: 0 },
    ],
  },
  // Iced Teas: "ADD-ON BOBA +1.0".
  {
    name: "Boba",
    selection: "MULTIPLE",
    maxSelect: 1,
    categories: ["Iced Teas"],
    addons: [{ name: "Boba", price: 1.0 }],
  },
  // Dessert board add-ons. Applied to whole categories by default — the manager
  // can narrow this to specific items in the Add-ons admin.
  {
    name: "Dessert Add-ons",
    selection: "MULTIPLE",
    categories: ["Desserts", "Freshly Baked"],
    addons: [
      { name: "MerryCream", price: 2.0 },
      { name: "Sauce", price: 0.5 },
    ],
  },
  // Cream Avenue soft-serve free toppings (all $0 — "FREE TOPPINGS").
  {
    name: "Free Toppings",
    selection: "MULTIPLE",
    categories: ["Soft Cream"],
    addons: [
      { name: "Strawberry", price: 0 },
      { name: "Caramel", price: 0 },
      { name: "Chocolate", price: 0 },
      { name: "Pistachio", price: 0 },
      { name: "Lotus Crumble", price: 0 },
      { name: "Oreo Crumble", price: 0 },
      { name: "Granola", price: 0 },
      { name: "Sprinkles", price: 0 },
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
