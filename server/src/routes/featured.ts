import { Router } from "express";
import { requireAdmin } from "../auth";
import { prisma } from "../db";
import { outMenuItem } from "../lib/serialize";

export const featuredRouter = Router();

const DEFAULTS = { title: "The usual suspects.", visible: true, limit: 0 };

async function getSettings() {
  const rows = await prisma.setting.findMany({ where: { key: { in: ["featured.title", "featured.visible", "featured.limit"] } } });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    title: map["featured.title"] ?? DEFAULTS.title,
    visible: map["featured.visible"] ? map["featured.visible"] === "true" : DEFAULTS.visible,
    limit: map["featured.limit"] ? Number(map["featured.limit"]) : DEFAULTS.limit,
  };
}
async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

// GET /api/featured  (public) — one product per category, hidden ones dropped.
featuredRouter.get("/", async (_req, res) => {
  const settings = await getSettings();
  const featured = await prisma.featuredProduct.findMany({ where: { isHidden: false }, orderBy: { sortOrder: "asc" }, include: { menuItem: true } });
  let items = featured.filter((f) => f.menuItem && !f.menuItem.isHidden).map((f) => f.menuItem);
  if (settings.limit > 0) items = items.slice(0, settings.limit);
  res.json({ title: settings.title, visible: settings.visible, items: items.map(outMenuItem) });
});

// ---- Admin ----
featuredRouter.use(requireAdmin);

// GET /api/featured/admin — settings + the category→product table + pickers.
featuredRouter.get("/admin", async (_req, res) => {
  const settings = await getSettings();
  const rows = await prisma.featuredProduct.findMany({ orderBy: { sortOrder: "asc" }, include: { menuItem: true } });
  // Categories + products per category, in menu display order.
  const items = await prisma.menuItem.findMany({ where: { isHidden: false }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, name: true, category: true, price: true, inStock: true } });
  const catOrder: string[] = [];
  const menuByCategory: Record<string, { id: number; name: string; price: number; inStock: boolean }[]> = {};
  for (const it of items) {
    if (!menuByCategory[it.category]) { menuByCategory[it.category] = []; catOrder.push(it.category); }
    menuByCategory[it.category].push({ id: it.id, name: it.name, price: it.price, inStock: it.inStock });
  }
  res.json({
    settings,
    categories: catOrder,
    menuByCategory,
    rows: rows.map((f) => ({ category: f.category, menuItemId: f.menuItemId, sortOrder: f.sortOrder, isHidden: f.isHidden, menuItem: outMenuItem(f.menuItem) })),
  });
});

// POST /api/featured/settings  { title?, visible?, limit? }
featuredRouter.post("/settings", async (req, res) => {
  if ("title" in req.body) await setSetting("featured.title", String(req.body.title ?? "").trim() || DEFAULTS.title);
  if ("visible" in req.body) await setSetting("featured.visible", req.body.visible ? "true" : "false");
  if ("limit" in req.body) await setSetting("featured.limit", String(Math.max(0, Math.round(Number(req.body.limit) || 0))));
  res.json(await getSettings());
});

// POST /api/featured/set  { category, menuItemId } — set/change/clear the featured
// product for a category. menuItemId 0/empty clears that category.
featuredRouter.post("/set", async (req, res) => {
  const category = String(req.body.category ?? "").trim();
  if (!category) return res.status(400).json({ error: "Category is required." });
  const menuItemId = Number(req.body.menuItemId) || 0;

  if (!menuItemId) {
    await prisma.featuredProduct.deleteMany({ where: { category } });
    return res.json({ ok: true, cleared: true });
  }
  const item = await prisma.menuItem.findUnique({ where: { id: menuItemId } });
  if (!item) return res.status(400).json({ error: "Product not found." });
  // A product can only be featured once (menuItemId is unique) — release it elsewhere first.
  await prisma.featuredProduct.deleteMany({ where: { menuItemId, category: { not: category } } });
  const existing = await prisma.featuredProduct.findUnique({ where: { category } });
  if (existing) {
    const row = await prisma.featuredProduct.update({ where: { category }, data: { menuItemId } });
    return res.json(row);
  }
  const max = await prisma.featuredProduct.aggregate({ _max: { sortOrder: true } });
  const row = await prisma.featuredProduct.create({ data: { category, menuItemId, sortOrder: (max._max.sortOrder ?? -1) + 1 } });
  res.status(201).json(row);
});

// PATCH /api/featured/hide  { category, isHidden }
featuredRouter.patch("/hide", async (req, res) => {
  const category = String(req.body.category ?? "").trim();
  await prisma.featuredProduct.updateMany({ where: { category }, data: { isHidden: !!req.body.isHidden } });
  res.json({ ok: true });
});

// PATCH /api/featured/order  { categories: string[] } — carousel order by category.
featuredRouter.patch("/order", async (req, res) => {
  const cats: string[] = Array.isArray(req.body.categories) ? req.body.categories : [];
  await prisma.$transaction(cats.map((category, index) => prisma.featuredProduct.updateMany({ where: { category }, data: { sortOrder: index } })));
  res.json({ ok: true });
});
