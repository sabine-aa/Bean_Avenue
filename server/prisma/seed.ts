import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../src/db";
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
    openHour: 8,
    closeHour: 22,
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
    openHour: 8,
    closeHour: 22,
    amenities: ["Fast Wi-Fi", "Power outlets", "TV / screen", "Conference table", "Air conditioning"],
    rules: ["Keep noise to a minimum", "Leave it as you found it"],
    images: ["/photos/conference-room.jpg"],
    isAvailable: true,
    bufferMinutes: 0,
  },
];

async function main() {
  // Wipe existing data so the seed is repeatable.
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

  // Sample upcoming events (dates relative to today so they always show as upcoming).
  const day = 24 * 60 * 60 * 1000;
  const at = (daysAhead: number, hour: number) => {
    const d = new Date(Date.now() + daysAhead * day);
    d.setHours(hour, 0, 0, 0);
    return d;
  };
  const events = [
    { title: "Late-Night Study Session", description: "Free-flowing coffee, quiet corners, and good focus energy. Stay productive till close.", startTime: at(3, 19), price: 0, spots: 20, image: "/photos/study-room-library.jpg", sortOrder: 1 },
    { title: "Business & Productivity Workshop", description: "A hands-on session on planning, focus, and getting things done — with a coffee in hand.", startTime: at(7, 18), price: 15, spots: 12, image: "/photos/conference-room.jpg", sortOrder: 2 },
    { title: "Board Game Night", description: "Bring friends, grab a drink, and play. We supply the games and the snacks.", startTime: at(10, 20), price: 5, spots: 24, image: null, sortOrder: 3 },
    { title: "Coffee Tasting", description: "Taste your way through our beans and learn what makes each cup special.", startTime: at(14, 17), price: 10, spots: 15, image: null, sortOrder: 4 },
  ];
  for (const event of events) {
    await prisma.event.create({ data: event });
  }

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
    `Seeded ${menu.length} menu items, ${rooms.length} rooms, ${rewardCount} rewards, ${events.length} events, and 1 banner.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
