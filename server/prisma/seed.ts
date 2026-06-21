import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../src/db";
import { seedAddons } from "./addons-data";
import { seedCategories } from "./categories-data";
import { seedDoughnuts } from "./doughnuts-data";
import { seedFeatured } from "./featured-data";
import { seedCategoryRewards } from "./rewards-data";

const here = dirname(fileURLToPath(import.meta.url));

interface SeedMenuItem {
  id: number;
  name: string;
  category: string;
  description: string;
  price: number;
  options: unknown;
  tags: unknown;
  photo: string | null;
  inStock: boolean;
  isHidden: boolean;
  sortOrder: number;
}

const menu: SeedMenuItem[] = JSON.parse(readFileSync(join(here, "seed-menu.json"), "utf-8"));

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

  for (const m of menu) {
    await prisma.menuItem.create({
      data: {
        id: m.id,
        name: m.name,
        category: m.category,
        description: m.description,
        price: m.price,
        options: JSON.stringify(m.options ?? []),
        tags: JSON.stringify(m.tags ?? []),
        photo: m.photo,
        inStock: m.inStock,
        isHidden: m.isHidden,
        sortOrder: m.sortOrder,
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

  console.log(
    `Seeded ${menu.length} menu items, ${rooms.length} rooms, ${rewardCount} rewards, and 1 banner.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
