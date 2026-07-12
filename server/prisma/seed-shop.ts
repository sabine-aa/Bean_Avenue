import "dotenv/config";
import { prisma } from "../src/db";

// Seed the Illy retail catalogue (from the owner's Illy website screenshots).
// Images were cropped into the frontend's /photos/shop/ assets. Idempotent:
// re-running updates price/category/image but never resets stock quantity.

const CATEGORIES = [
  "Whole Bean Coffee",
  "Ground Coffee",
  "IperEspresso Capsules",
  "Espresso Compatible Capsules",
  "K-Cup Coffee Pods",
  "E.S.E. Pods",
  "Ready-to-Drink Cold Brew",
  "Arabica Selection Coffee",
  "Instant",
];

type P = { slug: string; name: string; category: string; price: number; roast: string; intensity: number; notes?: string; featured?: boolean };
const PRODUCTS: P[] = [
  { slug: "whole-bean-classico", name: "Whole Bean Coffee Classico - Medium Roast", category: "Whole Bean Coffee", price: 17.29, roast: "Medium", intensity: 5, featured: true },
  { slug: "whole-bean-classico-500g", name: "Whole Bean Coffee Classico - Medium Roast - 500g Bag", category: "Whole Bean Coffee", price: 30.49, roast: "Medium", intensity: 5 },
  { slug: "whole-bean-intenso", name: "Whole Bean Coffee Intenso - Dark Roast", category: "Whole Bean Coffee", price: 17.29, roast: "Dark", intensity: 7 },
  { slug: "whole-bean-intenso-500g", name: "Whole Bean Coffee Intenso - Dark Roast - 500g Bag", category: "Whole Bean Coffee", price: 30.49, roast: "Dark", intensity: 7 },
  { slug: "whole-bean-decaf-classico", name: "Whole Bean Decaffeinated Coffee Classico - Medium Roast", category: "Whole Bean Coffee", price: 17.29, roast: "Medium (Decaf)", intensity: 5 },
  { slug: "ground-espresso-classico", name: "Ground Espresso Classico Coffee - Medium Roast", category: "Ground Coffee", price: 17.29, roast: "Medium", intensity: 5, featured: true },
  { slug: "ground-drip-classico", name: "Ground Drip Coffee Classico - Medium Roast", category: "Ground Coffee", price: 17.29, roast: "Medium", intensity: 5, featured: true },
  { slug: "ground-drip-intenso", name: "Ground Drip Coffee Intenso - Dark Roast", category: "Ground Coffee", price: 17.29, roast: "Dark", intensity: 7 },
  { slug: "classico-decaf-ground-espresso", name: "Classico Decaffeinated Ground Espresso Coffee - Medium Roast", category: "Ground Coffee", price: 17.29, roast: "Medium (Decaf)", intensity: 5 },
  { slug: "moka-ground-classico", name: "Moka Ground Coffee Classico - Medium Roast", category: "Ground Coffee", price: 17.29, roast: "Medium", intensity: 5 },
  { slug: "iperespresso-classico", name: "IperEspresso Capsules Classico - Medium Roast", category: "IperEspresso Capsules", price: 19.99, roast: "Medium", intensity: 5, featured: true },
  { slug: "iperespresso-intenso", name: "IperEspresso Capsules Intenso - Dark Roast", category: "IperEspresso Capsules", price: 19.99, roast: "Dark", intensity: 7 },
  { slug: "iperespresso-decaf", name: "IperEspresso Coffee Capsules Decaf - 18 Capsules", category: "IperEspresso Capsules", price: 19.99, roast: "Medium (Decaf)", intensity: 5 },
  { slug: "iperespresso-classico-lungo", name: "IperEspresso Capsules Classico Lungo - Medium Roast", category: "IperEspresso Capsules", price: 19.99, roast: "Medium", intensity: 5 },
  { slug: "iperespresso-singles-classico-lungo-100", name: "IperEspresso Capsule Singles Classico Lungo - 100 Capsules", category: "IperEspresso Capsules", price: 107.99, roast: "Medium", intensity: 5 },
  { slug: "espresso-compatible-classico", name: "Espresso Compatible* Capsules Classico - Medium Roast", category: "Espresso Compatible Capsules", price: 11.99, roast: "Medium", intensity: 5 },
  { slug: "espresso-compatible-intenso", name: "Espresso Compatible* Capsules Intenso - Dark Roast", category: "Espresso Compatible Capsules", price: 11.99, roast: "Dark", intensity: 7 },
  { slug: "espresso-compatible-classico-lungo", name: "Espresso Compatible* Capsules Classico Lungo - Medium Roast", category: "Espresso Compatible Capsules", price: 11.99, roast: "Medium", intensity: 5 },
  { slug: "kcup-classico", name: "illy K-Cup Pods Classico - Medium Roast", category: "K-Cup Coffee Pods", price: 13.99, roast: "Medium", intensity: 5 },
  { slug: "kcup-intenso", name: "illy K-Cup Pods Intenso - Dark Roast", category: "K-Cup Coffee Pods", price: 13.99, roast: "Dark", intensity: 7 },
  { slug: "kcup-classico-20", name: "Keurig illy K-Cup Pods Classico Roast - 20 Count", category: "K-Cup Coffee Pods", price: 24.99, roast: "Medium", intensity: 5 },
  { slug: "ese-pods-classico", name: "E.S.E. Pods Classico - Medium Roast", category: "E.S.E. Pods", price: 16.29, roast: "Medium", intensity: 5 },
  { slug: "ese-pods-intenso", name: "E.S.E. Pods Intenso - Dark Roast", category: "E.S.E. Pods", price: 16.29, roast: "Dark", intensity: 7 },
  { slug: "ese-decaf-classico", name: "E.S.E. Decaffeinated Espresso Pods Classico - Medium Roast", category: "E.S.E. Pods", price: 16.29, roast: "Medium (Decaf)", intensity: 5 },
  { slug: "arabica-whole-bean-brasile", name: "Arabica Selection Whole Bean Brasile Cerrado Mineiro", category: "Arabica Selection Coffee", price: 17.29, roast: "Medium", intensity: 5, notes: "Caramel notes" },
  { slug: "arabica-iperespresso-brasile", name: "Arabica Selection IperEspresso Capsules Brasile", category: "Arabica Selection Coffee", price: 19.99, roast: "Medium", intensity: 5, notes: "Caramel notes" },
  { slug: "arabica-ground-drip-brasile", name: "Arabica Selection Ground Drip Coffee Brasile Cerrado Mineiro", category: "Arabica Selection Coffee", price: 17.29, roast: "Medium", intensity: 5, notes: "Caramel notes" },
  { slug: "arabica-whole-bean-guatemala", name: "Arabica Selection Whole Bean Coffee Guatemala", category: "Arabica Selection Coffee", price: 17.29, roast: "Medium", intensity: 5, notes: "Chocolate notes" },
  { slug: "arabica-iperespresso-guatemala", name: "Arabica Selection IperEspresso Capsules Guatemala", category: "Arabica Selection Coffee", price: 19.99, roast: "Medium", intensity: 5, notes: "Chocolate notes" },
  { slug: "arabica-ground-espresso-guatemala", name: "Arabica Selection Ground Espresso Guatemala", category: "Arabica Selection Coffee", price: 10.29, roast: "Medium", intensity: 5, notes: "Chocolate notes" },
  { slug: "arabica-whole-bean-colombia", name: "Arabica Selection Whole Bean Coffee Colombia", category: "Arabica Selection Coffee", price: 17.29, roast: "Medium", intensity: 4, notes: "Fruit notes" },
  { slug: "arabica-ground-espresso-colombia", name: "Arabica Selection Ground Espresso Colombia", category: "Arabica Selection Coffee", price: 10.29, roast: "Medium", intensity: 4, notes: "Fruit notes" },
  { slug: "arabica-whole-bean-etiopia", name: "Arabica Selection Whole Bean Coffee Etiopia", category: "Arabica Selection Coffee", price: 17.29, roast: "Light", intensity: 3, notes: "Floral notes" },
  { slug: "arabica-iperespresso-etiopia", name: "Arabica Selection IperEspresso Capsules Etiopia", category: "Arabica Selection Coffee", price: 19.99, roast: "Light", intensity: 3, notes: "Floral notes" },
  { slug: "arabica-ground-espresso-etiopia", name: "Arabica Selection Ground Espresso Etiopia", category: "Arabica Selection Coffee", price: 10.29, roast: "Light", intensity: 3, notes: "Floral notes" },
  { slug: "kcup-arabica-brasile", name: "illy Arabica Selection K-Cup Pods Brasile", category: "Arabica Selection Coffee", price: 13.99, roast: "Medium", intensity: 5, notes: "Caramel notes" },
  { slug: "kcup-arabica-colombia", name: "illy Arabica Selection K-Cup Pods Colombia", category: "Arabica Selection Coffee", price: 13.99, roast: "Medium", intensity: 4, notes: "Fruit notes" },
  { slug: "instant-classico", name: "Instant Stick Pack - Classico", category: "Instant", price: 14.49, roast: "Medium", intensity: 5 },
  { slug: "instant-decaf", name: "Instant Stick Pack - Decaffeinated", category: "Instant", price: 14.49, roast: "Medium (Decaf)", intensity: 5 },
  { slug: "instant-intenso", name: "Instant Stick Pack - Intenso", category: "Instant", price: 14.49, roast: "Dark", intensity: 7 },
  { slug: "ground-instant-classico", name: "Ground Classico Instant Coffee - Medium Roast", category: "Instant", price: 13.99, roast: "Medium", intensity: 5 },
  { slug: "ground-instant-intenso", name: "Ground Instant Coffee Intenso - Dark Roast", category: "Instant", price: 13.99, roast: "Dark", intensity: 7 },
  // ---- additional singles ----
  { slug: "ground-drip-forte", name: "Ground Drip Coffee Forte - Extra Bold Roast", category: "Ground Coffee", price: 17.29, roast: "Extra Bold", intensity: 8 },
  { slug: "ground-espresso-intenso", name: "Ground Espresso Coffee Intenso - Dark Roast", category: "Ground Coffee", price: 17.29, roast: "Dark", intensity: 7 },
  { slug: "ground-moka-intenso", name: "Ground Moka Coffee Intenso - Dark Roast", category: "Ground Coffee", price: 17.29, roast: "Dark", intensity: 7 },
  { slug: "ground-espresso-classico-can", name: "Ground Espresso Coffee Classico - Medium Roast - 4.4oz Can", category: "Ground Coffee", price: 10.29, roast: "Medium", intensity: 5 },
  { slug: "ground-espresso-intenso-can", name: "Ground Espresso Coffee Intenso - Dark Roast - 4.4oz Can", category: "Ground Coffee", price: 10.29, roast: "Dark", intensity: 7 },
  { slug: "iper-cube-classico", name: "Iper Coffee Capsule Cube Classico - Medium Roast", category: "IperEspresso Capsules", price: 19.99, roast: "Medium", intensity: 5 },
  { slug: "iper-cube-intenso", name: "Iper Coffee Capsule Cube Intenso - Dark Roast", category: "IperEspresso Capsules", price: 19.99, roast: "Dark", intensity: 7 },
  { slug: "iper-cube-singles-classico-100", name: "Iper Coffee Capsule Singles Classico - Medium Roast - 100 Capsules", category: "IperEspresso Capsules", price: 107.99, roast: "Medium", intensity: 5 },
  { slug: "iper-drip-singles-intenso-100", name: "Iper Coffee Drip Capsule Singles Intenso - Dark Roast - 100 Capsules", category: "IperEspresso Capsules", price: 107.99, roast: "Dark", intensity: 7 },
  { slug: "iper-drip-singles-decaf-100", name: "Iper Coffee Drip Capsule Singles Classico Decaffeinated - 100 Capsules", category: "IperEspresso Capsules", price: 107.99, roast: "Medium (Decaf)", intensity: 5 },
  { slug: "iper-singles-classico-100", name: "IperEspresso Capsule Singles Classico - Medium Roast - 100 Capsules", category: "IperEspresso Capsules", price: 107.99, roast: "Medium", intensity: 5 },
  { slug: "iperespresso-singles-intenso-100", name: "IperEspresso Capsule Singles Intenso - Dark Roast - 100 Capsules", category: "IperEspresso Capsules", price: 107.99, roast: "Dark", intensity: 7 },
  { slug: "iperespresso-singles-decaf-100", name: "IperEspresso Capsule Singles Decaffeinated Classico - Medium Roast - 100 Capsules", category: "IperEspresso Capsules", price: 107.99, roast: "Medium (Decaf)", intensity: 5 },
  { slug: "kcup-decaf-classico", name: "illy K-Cup Pods Decaffeinated Classico - Medium Roast", category: "K-Cup Coffee Pods", price: 13.99, roast: "Medium (Decaf)", intensity: 5 },
  { slug: "kcup-intenso-20", name: "Keurig illy K-Cup Pods Intenso Roast - 20 Count", category: "K-Cup Coffee Pods", price: 24.99, roast: "Dark", intensity: 7 },
  { slug: "kcup-forte", name: "illy K-Cup Pods Forte - Extra Dark Roast", category: "K-Cup Coffee Pods", price: 13.99, roast: "Extra Bold", intensity: 8 },
  { slug: "espresso-compatible-decaf", name: "Espresso Compatible* Capsules Decaffeinated Classico - Medium Roast", category: "Espresso Compatible Capsules", price: 11.99, roast: "Medium (Decaf)", intensity: 5 },
  { slug: "espresso-compatible-forte", name: "Espresso Compatible* Capsules Forte - Extra Bold Roast", category: "Espresso Compatible Capsules", price: 11.99, roast: "Extra Bold", intensity: 8 },
  { slug: "espresso-compatible-lungo-intenso", name: "Espresso Compatible* Capsules Lungo Intenso - Dark Roast", category: "Espresso Compatible Capsules", price: 11.99, roast: "Dark", intensity: 7 },
  { slug: "ese-pods-classico-lungo", name: "E.S.E. Pods Classico Lungo - Medium Roast", category: "E.S.E. Pods", price: 16.29, roast: "Medium", intensity: 5 },
  { slug: "ese-pods-forte", name: "E.S.E. Pods Forte - Extra Dark Roast", category: "E.S.E. Pods", price: 16.29, roast: "Extra Bold", intensity: 8 },
  { slug: "arabica-ground-espresso-brasile", name: "Arabica Selection Ground Espresso Brasile", category: "Arabica Selection Coffee", price: 10.29, roast: "Medium", intensity: 5, notes: "Caramel notes" },
  { slug: "arabica-whole-bean-costa-rica", name: "Arabica Selection Whole Bean Coffee Costa Rica", category: "Arabica Selection Coffee", price: 17.29, roast: "Medium", intensity: 4, notes: "Honey notes" },
  { slug: "arabica-whole-bean-nicaragua", name: "Arabica Selection Whole Bean Coffee Nicaragua", category: "Arabica Selection Coffee", price: 17.29, roast: "Medium", intensity: 5, notes: "Nutty notes" },
  { slug: "arabica-whole-bean-india", name: "Arabica Selection Whole Bean Coffee India", category: "Arabica Selection Coffee", price: 17.29, roast: "Medium", intensity: 6, notes: "Spicy notes" },
  // ---- Ready-to-Drink Cold Brew ----
  { slug: "coldbrew-coffee-12", name: "illy Ready-to-Drink Cold Brew Coffee - 12 Cans", category: "Ready-to-Drink Cold Brew", price: 53.04, roast: "Cold brew", intensity: 5 },
  { slug: "coldbrew-cappuccino-12", name: "illy Ready-to-Drink Cold Brew Cappuccino - 12 Pack", category: "Ready-to-Drink Cold Brew", price: 53.04, roast: "Cold brew", intensity: 4 },
  { slug: "coldbrew-latte-12", name: "illy Ready-to-Drink Cold Brew Latte Macchiato - 12 Pack", category: "Ready-to-Drink Cold Brew", price: 53.04, roast: "Cold brew", intensity: 4 },
  // ---- multipacks (6-pack / 12-pack / 100-count / 10-pack) ----
  { slug: "whole-bean-classico-6pack", name: "Whole Bean Classico Coffee - Medium Roast - 6-Pack", category: "Whole Bean Coffee", price: 97.74, roast: "Medium", intensity: 5 },
  { slug: "whole-bean-intenso-6pack", name: "Whole Bean Intenso Coffee - Dark Roast - 6-Pack", category: "Whole Bean Coffee", price: 97.74, roast: "Dark", intensity: 7 },
  { slug: "whole-bean-decaf-6pack", name: "Whole Bean Decaffeinated Coffee - 6-Pack", category: "Whole Bean Coffee", price: 97.74, roast: "Medium (Decaf)", intensity: 5 },
  { slug: "ground-drip-classico-2pack", name: "Ground Drip Classico Coffee - Medium Roast - 2-Pack", category: "Ground Coffee", price: 31.98, roast: "Medium", intensity: 5 },
  { slug: "ground-drip-classico-6pack", name: "Ground Drip Classico Coffee - Medium Roast - 6-Pack", category: "Ground Coffee", price: 97.74, roast: "Medium", intensity: 5 },
  { slug: "ground-drip-classico-12pack", name: "Ground Drip Classico Coffee - Medium Roast - 12-Pack", category: "Ground Coffee", price: 179.88, roast: "Medium", intensity: 5 },
  { slug: "ground-espresso-classico-6pack", name: "Ground Espresso Classico Coffee - Medium Roast - 6-Pack", category: "Ground Coffee", price: 97.74, roast: "Medium", intensity: 5 },
  { slug: "ground-espresso-decaf-6pack", name: "Ground Espresso Classico Decaffeinated Coffee - Medium Roast - 6-Pack", category: "Ground Coffee", price: 97.74, roast: "Medium (Decaf)", intensity: 5 },
  { slug: "ground-drip-forte-6pack", name: "Ground Drip Coffee Forte - Extra Bold Roast - 6-Pack", category: "Ground Coffee", price: 97.74, roast: "Extra Bold", intensity: 8 },
  { slug: "ground-drip-intenso-6pack", name: "Ground Drip Intenso Coffee - Dark Roast - 6-Pack", category: "Ground Coffee", price: 97.74, roast: "Dark", intensity: 7 },
  { slug: "ground-espresso-intenso-6pack", name: "Ground Espresso Coffee Intenso - Dark Roast - 6-Pack", category: "Ground Coffee", price: 97.74, roast: "Dark", intensity: 7 },
  { slug: "ground-moka-intenso-6pack", name: "Ground Moka Coffee Intenso - Dark Roast - 6-Pack", category: "Ground Coffee", price: 97.74, roast: "Dark", intensity: 7 },
  { slug: "iperespresso-classico-6pack", name: "IperEspresso Capsules Classico - Medium Roast - 6-Pack", category: "IperEspresso Capsules", price: 113.94, roast: "Medium", intensity: 5 },
  { slug: "iperespresso-intenso-6pack", name: "IperEspresso Capsules Intenso - Dark Roast - 6-Pack", category: "IperEspresso Capsules", price: 113.94, roast: "Dark", intensity: 7 },
  { slug: "iper-cube-classico-6pack", name: "Iper Coffee Capsule Cube Classico - Medium Roast - 6-Pack", category: "IperEspresso Capsules", price: 113.94, roast: "Medium", intensity: 5 },
  { slug: "iper-cube-dark-6pack", name: "Iper Coffee Capsule Cube Dark Roast - 6-Pack", category: "IperEspresso Capsules", price: 113.94, roast: "Dark", intensity: 7 },
  { slug: "espresso-compatible-decaf-100", name: "Espresso Compatible* Capsules Decaffeinated Classico - Medium Roast - 100 Capsules", category: "Espresso Compatible Capsules", price: 113.90, roast: "Medium (Decaf)", intensity: 5 },
  { slug: "espresso-compatible-lungo-intenso-100", name: "Espresso Compatible* Capsules Lungo Intenso - Dark Roast - 100 Capsules", category: "Espresso Compatible Capsules", price: 119.90, roast: "Dark", intensity: 7 },
  { slug: "ese-decaf-6pack", name: "E.S.E. Decaffeinated Espresso Pods Classico - Medium Roast - 6-Pack", category: "E.S.E. Pods", price: 91.74, roast: "Medium (Decaf)", intensity: 5 },
  { slug: "ese-classico-lungo-6pack", name: "E.S.E. Pods Classico Lungo - Medium Roast - 6-Pack", category: "E.S.E. Pods", price: 91.74, roast: "Medium", intensity: 5 },
  { slug: "ese-forte-6pack", name: "E.S.E. Pods Forte - Extra Dark Roast - 6-Pack", category: "E.S.E. Pods", price: 91.74, roast: "Extra Bold", intensity: 8 },
  { slug: "instant-decaf-10pack", name: "Instant Stick Pack - Decaf - 10 Pack", category: "Instant", price: 134.99, roast: "Medium (Decaf)", intensity: 5 },
  { slug: "instant-intenso-10pack", name: "Instant Stick Pack - Intenso - 10 Pack", category: "Instant", price: 134.99, roast: "Dark", intensity: 7 },
  { slug: "instant-classico-10pack", name: "Instant Stick Pack - Classico - 10 Pack", category: "Instant", price: 134.99, roast: "Medium", intensity: 5 },
  { slug: "kcup-arabica-brasile-6pack", name: "illy Arabica Selection K-Cup Pods Brasile - 6-Pack", category: "Arabica Selection Coffee", price: 77.94, roast: "Medium", intensity: 5, notes: "Caramel notes" },
];

async function main() {
  for (let i = 0; i < CATEGORIES.length; i++) {
    await prisma.shopCategory.upsert({ where: { name: CATEGORIES[i] }, update: { sortOrder: i }, create: { name: CATEGORIES[i], sortOrder: i } });
  }
  let added = 0, updated = 0;
  for (let i = 0; i < PRODUCTS.length; i++) {
    const p = PRODUCTS[i];
    const description = `100% Arabica · ${p.roast} roast · Intensity ${p.intensity}/9${p.notes ? ` · ${p.notes}` : ""}`;
    const image = `/photos/shop/${p.slug}.png`;
    const existing = await prisma.shopProduct.findFirst({ where: { name: p.name } });
    const base = {
      name: p.name, category: p.category, brand: "illy", description,
      images: JSON.stringify([image]), price: p.price, minQty: 5,
      availableOnline: true, availablePos: true, allowPreorder: false,
      featured: !!p.featured, sortOrder: i, isHidden: false,
    };
    if (existing) {
      await prisma.shopProduct.update({ where: { id: existing.id }, data: base });
      updated++;
    } else {
      const created = await prisma.shopProduct.create({ data: { ...base, quantity: 25 } });
      await prisma.shopStockMovement.create({ data: { productId: created.id, delta: 25, balance: 25, type: "COUNT", reason: "Initial catalogue seed", staffName: "Admin" } });
      added++;
    }
  }
  console.log(`Shop seed done. Categories ${CATEGORIES.length}. Products added ${added}, updated ${updated}.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
