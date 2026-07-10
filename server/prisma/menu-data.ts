// The real Bean Avenue menu, transcribed from the printed menu boards + the
// protein-menu artwork. This is the single source of truth for the seed.
//
// Sizes are modelled as a "Size" OptionGroup: the item's `price` is the smallest
// size, and each choice carries a priceDelta on top. Single-price items have no
// options. The manager can edit everything (items, sizes, prices, nutrition,
// best-seller, availability) from the admin dashboard afterwards.

export interface MenuSeedItem {
  name: string;
  category: string;
  price: number;
  description?: string;
  options?: { name: string; choices: { label: string; priceDelta: number }[] }[];
  nutrition?: { kcal?: number; protein?: number; carbs?: number; fat?: number; fibers?: number };
  photo?: string | null;
  imageFit?: "cover" | "contain";
  isBestSeller?: boolean;
}

// Build a "Size" option group. First pair is the base (smallest) size/price.
const S = (...pairs: [string, number][]) => {
  const base = pairs[0][1];
  return {
    price: base,
    options: [
      {
        name: "Size",
        choices: pairs.map(([label, price]) => ({ label, priceDelta: Math.round((price - base) * 100) / 100 })),
      },
    ],
  };
};

// Photos carried over from the previous catalogue (only these two match).
const CAPPUCCINO_PHOTO = "https://adalo-uploads.imgix.net/4702014f812dbfd44125836a4e6d0c437233ea0b2305a30a97cf7e138c96c680.png?auto=format&q=20";
const ILLY_CREAM_PHOTO = "https://adalo-uploads.imgix.net/dd2426968705906733fdee95f362a2cbccf86040b3153c82bc8144f9a971c785.png?auto=format&q=20";

// NOTE: Protein-drink prices are placeholders ($6.50) — the menu artwork shows
// macros but no price. Set the real prices in the admin dashboard.
const PROTEIN_PRICE = 6.5;

export const MENU_ITEMS: MenuSeedItem[] = [
  // ---------------- Espresso Based (S / M / L) ----------------
  { name: "Cappuccino", category: "Espresso Based", ...S(["Small", 3.5], ["Medium", 4], ["Large", 4.5]), photo: CAPPUCCINO_PHOTO, isBestSeller: true },
  { name: "Latte", category: "Espresso Based", ...S(["Small", 3.5], ["Medium", 4], ["Large", 4.5]), isBestSeller: true },
  { name: "Espresso", category: "Espresso Based", price: 2.4 },
  { name: "Double Espresso", category: "Espresso Based", price: 3 },
  { name: "Single Macchiato", category: "Espresso Based", price: 3 },
  { name: "Double Macchiato", category: "Espresso Based", price: 3.23 },
  { name: "Cortado", category: "Espresso Based", price: 3.5 },
  { name: "Flat White", category: "Espresso Based", price: 3.5 },
  { name: "Americano", category: "Espresso Based", price: 3.75 },

  // ---------------- Filtered Coffee ----------------
  { name: "American", category: "Filtered Coffee", ...S(["Small", 3], ["Medium", 3.5], ["Large", 4]) },
  { name: "French Press", category: "Filtered Coffee", price: 4.5 },
  { name: "Cold Brew", category: "Filtered Coffee", price: 5 },
  { name: "V60", category: "Filtered Coffee", price: 6 },

  // ---------------- Hot Drinks ----------------
  { name: "Biscoff Latte", category: "Hot Drinks", price: 5.5 },
  { name: "Caramel Macchiato", category: "Hot Drinks", ...S(["Small", 3.75], ["Medium", 4.25], ["Large", 4.75]) },
  { name: "Coffeenut", category: "Hot Drinks", ...S(["Small", 3.75], ["Medium", 4.25], ["Large", 4.75]) },
  { name: "Dark Mocha", category: "Hot Drinks", ...S(["Small", 3.75], ["Medium", 4.25], ["Large", 4.75]) },
  { name: "White Mocha", category: "Hot Drinks", ...S(["Small", 3.75], ["Medium", 4.25], ["Large", 4.75]) },
  { name: "Nescafé", category: "Hot Drinks", price: 4.44 },
  { name: "Salted Caramel Latte", category: "Hot Drinks", price: 5.5 },
  { name: "Hot Chocolate", category: "Hot Drinks", ...S(["Small", 4], ["Medium", 4.5], ["Large", 5]) },
  { name: "Matcha Latte", category: "Hot Drinks", price: 4.5 },
  { name: "Organic Matcha", category: "Hot Drinks", price: 5.5 },
  { name: "Spanish Latte", category: "Hot Drinks", ...S(["Small", 4], ["Medium", 4.8], ["Large", 5.4]) },
  { name: "BA Latte", category: "Hot Drinks", ...S(["Small", 4], ["Medium", 5], ["Large", 6]), isBestSeller: true },
  { name: "Sledgehammer", category: "Hot Drinks", price: 5 },

  // ---------------- Iced Drinks ----------------
  { name: "Iced Americano", category: "Iced Drinks", price: 4 },
  { name: "Iced Caramel Macchiato", category: "Iced Drinks", price: 4.8 },
  { name: "Iced Latte", category: "Iced Drinks", price: 4.25 },
  { name: "Iced Matcha", category: "Iced Drinks", price: 4.5 },
  { name: "Iced Organic Matcha", category: "Iced Drinks", price: 5.5 },
  { name: "Iced Salted Caramel Latte", category: "Iced Drinks", price: 5.5 },
  { name: "Iced Mocha Latte", category: "Iced Drinks", price: 4.8 },
  { name: "Iced Spanish Latte", category: "Iced Drinks", price: 4.8, isBestSeller: true },
  { name: "Iced White Mocha", category: "Iced Drinks", price: 4.8 },
  { name: "BA Iced Latte", category: "Iced Drinks", price: 5, isBestSeller: true },
  { name: "Iced Coffeenut", category: "Iced Drinks", price: 4.8 },

  // ---------------- Special Items ----------------
  {
    name: "Illy Cream",
    category: "Special Items",
    ...S(["Small", 4], ["Large", 6]),
    description: "Illycrema — frozen coffee cream with 100% illy Arabica coffee. Soft, fresh and velvety, with micro particles of ice.",
    photo: ILLY_CREAM_PHOTO,
    isBestSeller: true,
  },
  { name: "Collagen Matcha", category: "Special Items", price: 7 },
  { name: "Dubai Chocolate Cup", category: "Special Items", price: 8 },

  // ---------------- Rakwah ----------------
  { name: "Rakwah Seda", category: "Rakwah", price: 3.5 },
  { name: "Rakwah Cardamom", category: "Rakwah", price: 4 },

  // ---------------- Frappes ----------------
  { name: "White Mocha Frappé", category: "Frappes", price: 5.5 },
  { name: "Vanilla Frappé", category: "Frappes", price: 5.5 },
  { name: "Mocha Frappé", category: "Frappes", price: 5.5 },
  { name: "Caramel Frappé", category: "Frappes", price: 5.5 },
  { name: "Roasted Hazelnut Frappé", category: "Frappes", price: 5.5 },
  { name: "BA Frappé", category: "Frappes", price: 5.5 },
  { name: "Salted Caramel Frappé", category: "Frappes", price: 5.5 },

  // ---------------- Milkshakes ----------------
  { name: "Biscoff Milkshake", category: "Milkshakes", price: 6.5 },
  { name: "Chocolate Milkshake", category: "Milkshakes", price: 5 },
  { name: "Cookies and Cream Milkshake", category: "Milkshakes", price: 5.5 },
  { name: "Strawberry Milkshake", category: "Milkshakes", price: 6.5 },
  { name: "Pistachio Milkshake", category: "Milkshakes", price: 6 },
  { name: "Vanilla Milkshake", category: "Milkshakes", price: 5 },

  // ---------------- Hot Teas ----------------
  { name: "Blue Flower Early Grey", category: "Hot Teas", price: 3 },
  { name: "Body and Soul", category: "Hot Teas", price: 3 },
  { name: "Cinnamon Orange", category: "Hot Teas", price: 3 },
  { name: "English Breakfast", category: "Hot Teas", price: 2.5 },
  { name: "Ginger Lemon", category: "Hot Teas", price: 3 },
  { name: "Matcha Berries", category: "Hot Teas", price: 3.5 },
  { name: "Mixed Berries", category: "Hot Teas", price: 3.5 },
  { name: "Moroccan Tea", category: "Hot Teas", price: 3 },
  { name: "Puriteal", category: "Hot Teas", price: 3 },
  { name: "Rooibos Bourbon Vanilla", category: "Hot Teas", price: 3 },
  { name: "Scents and Secrets", category: "Hot Teas", price: 3 },
  { name: "Spicy Rooibos", category: "Hot Teas", price: 3 },
  { name: "Teal Blue", category: "Hot Teas", price: 3 },
  { name: "Turmiric Matcha", category: "Hot Teas", price: 3 },
  { name: "Vanilla Classic", category: "Hot Teas", price: 4 },
  { name: "White Silk", category: "Hot Teas", price: 4 },
  { name: "Jasmin Dragon Phoenix", category: "Hot Teas", price: 5.5 },

  // ---------------- Refreshers ----------------
  { name: "Fresh Orange Juice", category: "Refreshers", price: 5 },
  { name: "Summer Mix", category: "Refreshers", price: 4.5 },
  { name: "Mango Smoothie", category: "Refreshers", price: 4.5 },
  { name: "Blueberry Smoothie", category: "Refreshers", price: 4.5 },
  { name: "Strawberry Smoothie", category: "Refreshers", price: 4.5 },
  { name: "Minted Lemonade", category: "Refreshers", price: 5 },
  { name: "Strawberry Banana", category: "Refreshers", price: 5 },
  { name: "Apple Coco", category: "Refreshers", price: 5 },
  { name: "Aqua", category: "Refreshers", price: 5 },
  { name: "Fruits Aura", category: "Refreshers", price: 5 },
  { name: "Spicy Mango", category: "Refreshers", price: 5 },

  // ---------------- Iced Teas (Boba add-on available) ----------------
  { name: "Iced Tea Peach", category: "Iced Teas", price: 4 },
  { name: "Iced Tea Lemon", category: "Iced Teas", price: 4 },
  { name: "Iced Tea Raspberry", category: "Iced Teas", price: 4 },
  { name: "Iced Tea Berries", category: "Iced Teas", price: 5 },

  // ---------------- Beverages ----------------
  { name: "Water 0.5L", category: "Beverages", price: 0.67 },
  { name: "Via Sparkling", category: "Beverages", price: 1.5 },
  { name: "Via Glass Water 0.33L", category: "Beverages", price: 1.2 },

  // ---------------- Protein Drinks (nutrition from the protein artwork) ----------------
  { name: "Chocolate Shred", category: "Protein Drinks", price: PROTEIN_PRICE, description: "High-protein chocolate shake — lean and low fat.", nutrition: { kcal: 243, protein: 42, carbs: 12, fat: 4 }, photo: "/api/uploads/protein-chocolate-shred.png", imageFit: "contain", isBestSeller: true },
  { name: "Vanilla Shred", category: "Protein Drinks", price: PROTEIN_PRICE, description: "Smooth vanilla protein shake — high protein, barely any fat.", nutrition: { kcal: 233, protein: 42, carbs: 15, fat: 1 }, photo: "/api/uploads/protein-vanilla-shred.png", imageFit: "contain" },
  { name: "PB Bananas Blast", category: "Protein Drinks", price: PROTEIN_PRICE, description: "Peanut butter & banana protein shake.", nutrition: { kcal: 425, protein: 33, carbs: 35, fat: 18, fibers: 7 }, photo: "/api/uploads/protein-pb-bananas-blast.png", imageFit: "contain" },
  { name: "Pink Avenue", category: "Protein Drinks", price: PROTEIN_PRICE, description: "Berry-forward protein shake.", nutrition: { kcal: 345, protein: 29, carbs: 34, fat: 8, fibers: 4 }, photo: "/api/uploads/protein-pink-avenue.png", imageFit: "contain" },
  { name: "MVP Shake", category: "Protein Drinks", price: PROTEIN_PRICE, description: "The all-rounder — big protein, big energy.", nutrition: { kcal: 545, protein: 35, carbs: 47, fat: 27, fibers: 7 }, photo: "/api/uploads/protein-mvp-shake.png", imageFit: "contain" },
  { name: "Dessert Fuel", category: "Protein Drinks", price: PROTEIN_PRICE, description: "Cookies-and-cream style protein treat.", nutrition: { kcal: 455, protein: 33, carbs: 50, fat: 15, fibers: 5 }, photo: "/api/uploads/protein-dessert-fuel.png", imageFit: "contain" },

  // ---------------- Soft Cream (Cream Avenue) — free toppings via add-ons ----------------
  { name: "Chocolate", category: "Soft Cream", price: 5, description: "Chocolate soft serve.", photo: null },
  { name: "Vanilla", category: "Soft Cream", price: 5, description: "Vanilla soft serve.", photo: null },
  { name: "Mixed Chocolate & Vanilla", category: "Soft Cream", price: 5, description: "A swirl of chocolate & vanilla soft serve.", photo: null },

  // ---------------- Special Items (dessert board) ----------------
  { name: "Strawberry Dubai Chocolate", category: "Special Items", price: 8 },

  // ---------------- Desserts ----------------
  { name: "Brownie", category: "Desserts", price: 4 },
  { name: "Brownie with Toppings", category: "Desserts", price: 5 },
  { name: "Brookie", category: "Desserts", price: 5 },
  { name: "Fondant", category: "Desserts", price: 4 },
  { name: "Carrot Cake", category: "Desserts", price: 5 },
  { name: "Red Velvet", category: "Desserts", price: 5, photo: null, description: "Soft, velvety red velvet cake with a hint of cocoa and cream cheese frosting." },
  { name: "Lazy Cake", category: "Desserts", price: 5 },
  { name: "Honey Cake", category: "Desserts", price: 6 },
  { name: "San Sebastian", category: "Desserts", price: 5 },
  { name: "Strawberry Cheesecake", category: "Desserts", price: 5 },
  { name: "Raspberry Cheesecake", category: "Desserts", price: 5 },
  { name: "Red Velvet Cheesecake", category: "Desserts", price: 5 },
  { name: "Tiramisu", category: "Desserts", price: 5 },
  { name: "Pistachio Tiramisu", category: "Desserts", price: 6 },
  { name: "Chocolate Muffin", category: "Desserts", price: 4 },
  { name: "Blueberry Muffin", category: "Desserts", price: 4 },
  { name: "Orange Cake", category: "Desserts", price: 4 },
  { name: "Cookies", category: "Desserts", price: 5, description: "Ask for flavors." },
  { name: "Banana Pudding", category: "Desserts", price: 6 },

  // ---------------- Freshly Baked ----------------
  { name: "Thyme Croissant", category: "Freshly Baked", price: 4 },
  { name: "Cheese Croissant", category: "Freshly Baked", price: 4.5 },
  { name: "Triple Chocolate Croissant", category: "Freshly Baked", price: 5 },
  { name: "Almond Croissant", category: "Freshly Baked", price: 6 },
  { name: "Cinnamon Roll", category: "Freshly Baked", price: 5 },

  // ---------------- Salads ----------------
  { name: "Chef Salad", category: "Salads", price: 9 },
  { name: "Chicken Caesar Salad", category: "Salads", price: 10 },
  { name: "Strawberry Feta Salad", category: "Salads", price: 9 },
  { name: "Tuna Salad", category: "Salads", price: 10 },
  { name: "Kale Quinoa Salad", category: "Salads", price: 9 },

  // ---------------- Sandwiches ----------------
  { name: "Chicken Avocado Sandwich", category: "Sandwiches", price: 9 },
  { name: "Halloumi Pesto Sandwich", category: "Sandwiches", price: 7.5 },
  { name: "Turkey & Cheese Sandwich", category: "Sandwiches", price: 7.5 },
  { name: "Chicken Club Sandwich", category: "Sandwiches", price: 9 },
];
