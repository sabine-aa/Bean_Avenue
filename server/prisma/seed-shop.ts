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
