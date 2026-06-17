import type { PrismaClient } from "@prisma/client";

// Default homepage line-up: drink-focused. Exact names first, then the most
// popular Frappe and Refresher by sort order. The manager can change all of this.
const EXACT_NAMES = ["Iced Spanish Latte", "BA Iced Latte", "Iced Coffeenut", "Iced White Mocha"];

/** Seed the default "The usual suspects" featured products. Preserves other data. */
export async function seedFeatured(prisma: PrismaClient) {
  await prisma.featuredProduct.deleteMany();

  const chosen: number[] = [];
  for (const name of EXACT_NAMES) {
    const item = await prisma.menuItem.findFirst({ where: { name } });
    if (item) chosen.push(item.id);
  }
  const frappe = await prisma.menuItem.findFirst({
    where: { category: "Frappes", isHidden: false },
    orderBy: { sortOrder: "asc" },
  });
  if (frappe) chosen.push(frappe.id);
  const refresher = await prisma.menuItem.findFirst({
    where: { category: "Refreshers", isHidden: false },
    orderBy: { sortOrder: "asc" },
  });
  if (refresher) chosen.push(refresher.id);

  for (let i = 0; i < chosen.length; i++) {
    await prisma.featuredProduct.create({ data: { menuItemId: chosen[i], sortOrder: i } });
  }

  // Default section settings.
  await prisma.setting.upsert({
    where: { key: "featured.title" },
    create: { key: "featured.title", value: "The usual suspects." },
    update: {},
  });
  await prisma.setting.upsert({
    where: { key: "featured.visible" },
    create: { key: "featured.visible", value: "true" },
    update: {},
  });
  await prisma.setting.upsert({
    where: { key: "featured.limit" },
    create: { key: "featured.limit", value: "6" },
    update: {},
  });

  return chosen.length;
}
