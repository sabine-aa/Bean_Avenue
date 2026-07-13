// One-off: attach the newly-added menu photos (public/photos/menu/<slug>.jpg) to
// their menu items, matching by accent/space-insensitive normalized name.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// NFD splits "é" into "e" + combining mark; [^a-z0-9] then drops the mark.
const normalize = (s) => s.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");

// normalized menu-item name -> photo slug
const SLUG = {
  bananapudding: "banana-pudding",
  chickenclubsandwich: "chicken-club-sandwich",
  collagenmatcha: "collagen-matcha",
  honeycake: "honey-cake",
  kalequinoasalad: "kale-quinoa-salad",
  nescafe: "nescafe",
  orangecake: "orange-cake",
  pistachiomilkshake: "pistachio-milkshake",
  pistachiotiramisu: "pistachio-tiramisu",
  rakwahcardamom: "rakwah-cardamom",
  redvelvet: "red-velvet",
  saltedcaramelfrappe: "salted-caramel-frappe",
  strawberrycheesecake: "strawberry-cheesecake",
  strawberryfetasalad: "strawberry-feta-salad",
  turmiricmatcha: "turmiric-matcha",
  viaglasswater033l: "via-glass-water",
  water05l: "water-05l",
  whitemochafrappe: "white-mocha-frappe",
};

const items = await prisma.menuItem.findMany({ select: { id: true, name: true, photo: true } });
let updated = 0;
const hit = new Set();
for (const it of items) {
  const slug = SLUG[normalize(it.name)];
  if (!slug) continue;
  hit.add(normalize(it.name));
  const photo = `/photos/menu/${slug}.jpg`;
  await prisma.menuItem.update({ where: { id: it.id }, data: { photo } });
  console.log(`set  ${it.name}  ->  ${photo}`);
  updated++;
}
const missing = Object.keys(SLUG).filter((k) => !hit.has(k));
console.log(`\nUpdated ${updated} items.`);
if (missing.length) console.log("No menu item matched these slugs:", missing.join(", "));
await prisma.$disconnect();
