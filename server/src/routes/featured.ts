import { Router } from "express";
import { requireAdmin } from "../auth";
import { prisma } from "../db";
import { outMenuItem } from "../lib/serialize";

export const featuredRouter = Router();

const DEFAULTS = { title: "The usual suspects.", visible: true, limit: 6 };

async function getSettings() {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ["featured.title", "featured.visible", "featured.limit"] } },
  });
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

// GET /api/featured  (public) — the resolved homepage section
featuredRouter.get("/", async (_req, res) => {
  const settings = await getSettings();
  const featured = await prisma.featuredProduct.findMany({
    orderBy: { sortOrder: "asc" },
    include: { menuItem: true },
  });
  // Resolve live from the menu; drop hidden items; apply the display limit.
  let items = featured.filter((f) => f.menuItem && !f.menuItem.isHidden).map((f) => f.menuItem);
  if (settings.limit > 0) items = items.slice(0, settings.limit);
  res.json({ title: settings.title, visible: settings.visible, items: items.map(outMenuItem) });
});

// ---- Admin ----
featuredRouter.use(requireAdmin);

// GET /api/featured/admin — settings + the chosen products (with full menu info)
featuredRouter.get("/admin", async (_req, res) => {
  const settings = await getSettings();
  const featured = await prisma.featuredProduct.findMany({
    orderBy: { sortOrder: "asc" },
    include: { menuItem: true },
  });
  res.json({
    settings,
    items: featured.map((f) => ({ id: f.id, sortOrder: f.sortOrder, menuItem: outMenuItem(f.menuItem) })),
  });
});

// POST /api/featured/settings  { title?, visible?, limit? }
featuredRouter.post("/settings", async (req, res) => {
  if ("title" in req.body) await setSetting("featured.title", String(req.body.title ?? "").trim() || DEFAULTS.title);
  if ("visible" in req.body) await setSetting("featured.visible", req.body.visible ? "true" : "false");
  if ("limit" in req.body) await setSetting("featured.limit", String(Math.max(0, Math.round(Number(req.body.limit) || 0))));
  res.json(await getSettings());
});

// POST /api/featured/items  { menuItemId } — add a product to the homepage
featuredRouter.post("/items", async (req, res) => {
  const menuItemId = Number(req.body.menuItemId);
  if (!menuItemId) return res.status(400).json({ error: "Pick a product." });
  const exists = await prisma.featuredProduct.findUnique({ where: { menuItemId } });
  if (exists) return res.json(exists);
  const max = await prisma.featuredProduct.aggregate({ _max: { sortOrder: true } });
  const created = await prisma.featuredProduct.create({
    data: { menuItemId, sortOrder: (max._max.sortOrder ?? -1) + 1 },
  });
  res.status(201).json(created);
});

// DELETE /api/featured/items/:menuItemId
featuredRouter.delete("/items/:menuItemId", async (req, res) => {
  await prisma.featuredProduct.deleteMany({ where: { menuItemId: Number(req.params.menuItemId) } });
  res.json({ ok: true });
});

// PATCH /api/featured/order  { ids: number[] } — menuItemIds in display order
featuredRouter.patch("/order", async (req, res) => {
  const ids: number[] = Array.isArray(req.body.ids) ? req.body.ids : [];
  await prisma.$transaction(
    ids.map((menuItemId, index) =>
      prisma.featuredProduct.updateMany({ where: { menuItemId }, data: { sortOrder: index } })
    )
  );
  res.json({ ok: true });
});
