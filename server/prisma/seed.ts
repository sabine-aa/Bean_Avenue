import "dotenv/config";
import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../src/db";
import { seedAddons } from "./addons-data";
import { seedCategories } from "./categories-data";
import { seedDoughnuts } from "./doughnuts-data";
import { seedFeatured } from "./featured-data";
import { MENU_ITEMS } from "./menu-data";
import { seedCategoryRewards } from "./rewards-data";

// Carry over the photos & descriptions from the previous catalogue for any item
// that survived the rebuild (matched by name). menu-data.ts values win when set.
const here = dirname(fileURLToPath(import.meta.url));
const legacy = new Map<string, { photo: string | null; description: string }>();
try {
  const old = JSON.parse(readFileSync(join(here, "seed-menu.json"), "utf-8")) as {
    name: string;
    photo: string | null;
    description: string;
  }[];
  for (const o of old) legacy.set(o.name.toLowerCase().trim(), { photo: o.photo ?? null, description: o.description ?? "" });
} catch {
  /* legacy file optional */
}

// Photo-only aliases: items that were named differently before. We reuse the old
// PHOTO (visually the same drink) but not the description, which may not fit.
const PHOTO_ALIASES: Record<string, string> = {
  "biscoff milkshake": "biscoff frappé",
  "chocolate milkshake": "chocolate frappé",
  "cookies and cream milkshake": "cookies and cream frappé",
  "dubai chocolate cup": "strawberry dubai chocolate",
  "organic matcha": "matcha latte",
  "iced organic matcha": "iced matcha",
  "san sebastian": "san sebastian cheesecake",
  "triple chocolate croissant": "chocolate croissant",
};

const rooms = [
  {
    name: "Study Room",
    type: "STUDY",
    description:
      "A quiet, private space for focused work or studying — comfy seating, good light, and the café just steps away.",
    pricePerHour: 5,
    capacityMin: 1,
    capacityMax: 4,
    openHour: 7,
    closeHour: 24,
    amenities: ["Fast Wi-Fi", "Power outlets", "Whiteboard", "Air conditioning"],
    rules: ["Keep noise to a minimum", "Leave it as you found it"],
    images: [
      "/photos/study-room-whiteboard.jpg",
      "/photos/study-room-library.jpg",
      "/photos/study-room-aerial.jpg",
    ],
    isAvailable: true,
    bufferMinutes: 0,
  },
  {
    name: "Conference Room",
    type: "CONFERENCE",
    description:
      "A bright room for meetings, presentations, and group work — seats a larger group with a screen for sharing.",
    pricePerHour: 20,
    capacityMin: 4,
    capacityMax: 12,
    openHour: 7,
    closeHour: 24,
    amenities: ["Fast Wi-Fi", "Power outlets", "TV / screen", "Conference table", "Air conditioning"],
    rules: ["Keep noise to a minimum", "Leave it as you found it"],
    images: ["/photos/conference-room.jpg"],
    isAvailable: true,
    bufferMinutes: 0,
  },
];

async function main() {
  // Wipe existing data so the seed is repeatable.
  await prisma.addonAssignment.deleteMany();
  await prisma.addon.deleteMany();
  await prisma.addonGroup.deleteMany();
  await prisma.banner.deleteMany();
  await prisma.subscriber.deleteMany();
  await prisma.event.deleteMany();
  await prisma.suggestion.deleteMany();
  await prisma.redemption.deleteMany();
  await prisma.loyaltyTransaction.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.reward.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.room.deleteMany();

  for (let i = 0; i < MENU_ITEMS.length; i++) {
    const m = MENU_ITEMS[i];
    const key = m.name.toLowerCase().trim();
    const leg = legacy.get(key);
    const aliasPhoto = PHOTO_ALIASES[key] ? legacy.get(PHOTO_ALIASES[key])?.photo ?? null : null;
    await prisma.menuItem.create({
      data: {
        name: m.name,
        category: m.category,
        description: m.description ?? leg?.description ?? "",
        price: m.price,
        options: JSON.stringify(m.options ?? []),
        tags: JSON.stringify([]),
        nutrition: m.nutrition ? JSON.stringify(m.nutrition) : "",
        photo: m.photo !== undefined ? m.photo : leg?.photo ?? aliasPhoto,
        imageFit: m.imageFit ?? "cover",
        inStock: true,
        isHidden: false,
        isBestSeller: m.isBestSeller ?? false,
        sortOrder: i,
      },
    });
  }

  for (const r of rooms) {
    await prisma.room.create({
      data: {
        ...r,
        amenities: JSON.stringify(r.amenities),
        rules: JSON.stringify(r.rules),
        images: JSON.stringify(r.images),
      },
    });
  }

  const rewardCount = await seedCategoryRewards(prisma);
  await seedAddons(prisma);
  await seedCategories(prisma);
  await seedDoughnuts(prisma);
  await seedFeatured(prisma);

  // No sample events are seeded — the Events page shows only real events the
  // manager creates and publishes from the admin dashboard. Until then customers
  // see the "Something is brewing" empty state.

  await prisma.banner.create({
    data: {
      title: "Double points every Monday",
      text: "Earn 2 beans per $1 on all orders, every Monday at Bean Avenue.",
      buttonText: "Join loyalty",
      buttonLink: "/loyalty",
      isVisible: true,
    },
  });

  // Default POS staff (a Manager, PIN 1234) so the register works out of the box.
  // The manager can change PINs / add cashiers from the admin dashboard.
  if ((await prisma.staffUser.count()) === 0) {
    await prisma.staffUser.create({ data: { name: "Manager", pinHash: await bcrypt.hash("1234", 8), role: "MANAGER" } });
  }

  console.log(
    `Seeded ${MENU_ITEMS.length} menu items, ${rooms.length} rooms, ${rewardCount} rewards, and 1 banner.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
