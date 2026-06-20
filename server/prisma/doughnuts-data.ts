import type { PrismaClient } from "@prisma/client";
import { DOUGHNUT_CATEGORY } from "../src/lib/constants";

const PLACEHOLDER = "/doughnut-placeholder.svg";
const ALLERGENS = "Contains gluten, dairy, egg. May contain traces of nuts.";

// Hanson Doughnuts full catalogue (~30). The manager activates ~5 per day.
const DOUGHNUTS: { name: string; description: string; price: number; ingredients?: string }[] = [
  { name: "Classic Glazed", description: "The original — light, fluffy, and coated in a sweet vanilla glaze.", price: 2.5 },
  { name: "Chocolate Frosted", description: "Soft ring doughnut dipped in rich chocolate frosting.", price: 2.75 },
  { name: "Strawberry Frosted", description: "Pillowy doughnut with strawberry icing and rainbow sprinkles.", price: 2.75 },
  { name: "Boston Cream", description: "Filled with vanilla custard and topped with chocolate ganache.", price: 3.25 },
  { name: "Cinnamon Sugar", description: "Warm doughnut tossed in cinnamon sugar.", price: 2.5 },
  { name: "Maple Bacon", description: "Maple-glazed doughnut finished with crispy bacon bits.", price: 3.75, ingredients: "Contains gluten, dairy, egg, pork. May contain nuts." },
  { name: "Jelly Filled", description: "Sugar-dusted doughnut bursting with raspberry jam.", price: 3.0 },
  { name: "Powdered Sugar", description: "Simple, soft, and snowed under powdered sugar.", price: 2.5 },
  { name: "Old Fashioned", description: "Dense, cakey buttermilk doughnut with a crackly glaze.", price: 2.75 },
  { name: "Apple Fritter", description: "Craggy fried fritter loaded with cinnamon apples.", price: 3.5 },
  { name: "Boston Caramel", description: "Custard-filled doughnut topped with salted caramel.", price: 3.5 },
  { name: "Double Chocolate", description: "Chocolate cake doughnut with chocolate glaze and chips.", price: 3.0 },
  { name: "Vanilla Sprinkle", description: "Vanilla-iced doughnut piled with rainbow sprinkles.", price: 2.75 },
  { name: "Lemon Filled", description: "Soft doughnut filled with tangy lemon curd.", price: 3.0 },
  { name: "Nutella Stuffed", description: "Pillowy doughnut filled with hazelnut chocolate spread.", price: 3.75, ingredients: "Contains gluten, dairy, egg, hazelnut." },
  { name: "Pistachio Cream", description: "Topped with pistachio cream and chopped pistachios.", price: 3.95, ingredients: "Contains gluten, dairy, egg, pistachio." },
  { name: "Biscoff Crunch", description: "Biscoff glaze with crushed cookie crumble.", price: 3.5 },
  { name: "Cookies & Cream", description: "Vanilla icing loaded with crushed chocolate cookies.", price: 3.25 },
  { name: "Salted Caramel", description: "Caramel glaze with a sprinkle of sea salt.", price: 3.25 },
  { name: "Honey Glazed", description: "Delicate doughnut brushed with golden honey glaze.", price: 2.75 },
  { name: "Coconut Crunch", description: "Vanilla glaze rolled in toasted coconut.", price: 3.0, ingredients: "Contains gluten, dairy, egg, coconut." },
  { name: "Red Velvet", description: "Red velvet cake doughnut with cream cheese icing.", price: 3.5 },
  { name: "Matcha Glaze", description: "Earthy matcha glaze on a soft ring doughnut.", price: 3.5 },
  { name: "Tiramisu", description: "Coffee-soaked doughnut with mascarpone cream and cocoa.", price: 3.95 },
  { name: "Peanut Butter Cup", description: "Peanut butter glaze with chocolate drizzle.", price: 3.5, ingredients: "Contains gluten, dairy, egg, peanut." },
  { name: "Caramel Pecan", description: "Caramel glaze topped with candied pecans.", price: 3.75, ingredients: "Contains gluten, dairy, egg, pecan." },
  { name: "Blueberry Cake", description: "Buttery cake doughnut studded with blueberries.", price: 3.0 },
  { name: "Lemon Poppy", description: "Zesty lemon glaze with poppy seeds.", price: 3.0 },
  { name: "Churro", description: "Cinnamon-sugar doughnut with a dulce de leche core.", price: 3.5 },
  { name: "Birthday Cake", description: "Vanilla cake doughnut with confetti icing and sprinkles.", price: 3.25 },
];

/** Seed the full Hanson Doughnuts catalogue; first 5 are available today. */
export async function seedDoughnuts(prisma: PrismaClient) {
  await prisma.menuItem.deleteMany({ where: { category: DOUGHNUT_CATEGORY } });
  for (let i = 0; i < DOUGHNUTS.length; i++) {
    const d = DOUGHNUTS[i];
    await prisma.menuItem.create({
      data: {
        name: d.name,
        category: DOUGHNUT_CATEGORY,
        description: d.description,
        price: d.price,
        photo: PLACEHOLDER,
        ingredients: d.ingredients ?? ALLERGENS,
        inStock: true,
        isHidden: false,
        availableToday: i < 5, // ~5 available today by default
        sortOrder: i,
      },
    });
  }

  // Homepage promo defaults.
  const promo = [
    ["doughnuts.visible", "true"],
    ["doughnuts.title", "Today's Hanson Doughnuts"],
    ["doughnuts.description", "Discover today's freshly available doughnut selection at Bean Avenue."],
    ["doughnuts.buttonText", "View Today's Doughnuts"],
    ["doughnuts.image", "/hanson-doughnuts-logo.png"],
  ];
  for (const [key, value] of promo) {
    await prisma.setting.upsert({ where: { key }, create: { key, value }, update: {} });
  }

  return DOUGHNUTS.length;
}
