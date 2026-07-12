import { Router } from "express";
import { requireAdmin } from "../auth";
import { prisma } from "../db";
import { DOUGHNUT_CATEGORY } from "../lib/constants";
import { outMenuItem, toJson } from "../lib/serialize";

export const menuRouter = Router();

// Clamp a focal-point coordinate to an integer 0–100 (%), defaulting to centre.
const clampPct = (v: unknown): number => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, n));
};

// GET /api/menu  (public — visible items, excluding doughnuts which have their
// own page)   |   ?all=1 returns everything (admin list)
menuRouter.get("/", async (req, res) => {
  const all = req.query.all === "1";
  const items = await prisma.menuItem.findMany({
    where: all ? undefined : { isHidden: false, category: { not: DOUGHNUT_CATEGORY } },
    orderBy: { sortOrder: "asc" },
  });
  // For customers/register, a tracked item at zero stock reads as sold out so all
  // existing "inStock" UI just works. Admin (?all) keeps the raw stock fields.
  res.json(items.map((m) => (all ? outMenuItem(m) : { ...outMenuItem(m), inStock: m.inStock && !(m.trackStock && m.stockQty <= 0) })));
});

// PATCH /api/menu/reorder  (admin) — must be declared before "/:id"
menuRouter.patch("/reorder", requireAdmin, async (req, res) => {
  const ids: number[] = req.body.ids ?? [];
  await prisma.$transaction(
    ids.map((id, index) => prisma.menuItem.update({ where: { id }, data: { sortOrder: index } }))
  );
  res.json({ ok: true });
});

// GET /api/menu/:id  (public) — item plus a few suggestions from the same category
menuRouter.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const item = await prisma.menuItem.findUnique({ where: { id } });
  if (!item) return res.status(404).json({ error: "Item not found." });
  const suggestions = await prisma.menuItem.findMany({
    where: { category: item.category, isHidden: false, id: { not: id } },
    orderBy: { sortOrder: "asc" },
    take: 3,
  });
  res.json({ ...outMenuItem(item), suggestions: suggestions.map(outMenuItem) });
});

// POST /api/menu  (admin)
menuRouter.post("/", requireAdmin, async (req, res) => {
  const b = req.body;
  const max = await prisma.menuItem.aggregate({ _max: { sortOrder: true } });
  const item = await prisma.menuItem.create({
    data: {
      name: b.name,
      category: b.category,
      description: b.description ?? "",
      price: Number(b.price) || 0,
      photo: b.photo ?? null,
      imageFit: b.imageFit === "contain" ? "contain" : "cover",
      focalX: clampPct(b.focalX),
      focalY: clampPct(b.focalY),
      ingredients: b.ingredients ?? null,
      nutrition: b.nutrition ? JSON.stringify(b.nutrition) : "",
      tags: toJson(b.tags ?? []),
      options: toJson(b.options ?? []),
      inStock: b.inStock ?? true,
      isHidden: b.isHidden ?? false,
      isBestSeller: b.isBestSeller ?? false,
      availableToday: b.availableToday ?? true,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });
  res.status(201).json(outMenuItem(item));
});

// PATCH /api/menu/:id  (admin)
menuRouter.patch("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body;
  const data: Record<string, unknown> = {};
  for (const key of ["name", "category", "description", "photo", "ingredients", "inStock", "isHidden", "isBestSeller", "availableToday"]) {
    if (key in b) data[key] = b[key];
  }
  if ("price" in b) data.price = Number(b.price);
  if ("nutrition" in b) data.nutrition = b.nutrition ? JSON.stringify(b.nutrition) : "";
  if ("tags" in b) data.tags = toJson(b.tags);
  if ("options" in b) data.options = toJson(b.options);
  if ("imageFit" in b) data.imageFit = b.imageFit === "contain" ? "contain" : "cover";
  if ("focalX" in b) data.focalX = clampPct(b.focalX);
  if ("focalY" in b) data.focalY = clampPct(b.focalY);
  const item = await prisma.menuItem.update({ where: { id }, data });
  res.json(outMenuItem(item));
});

// DELETE /api/menu/:id  (admin)
menuRouter.delete("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  try {
    // Recipe components reference the item by plain id (no cascade) — tidy them up
    // so a deleted product leaves no orphan recipe rows.
    await prisma.recipeComponent.deleteMany({ where: { menuItemId: id } });
    await prisma.menuItem.delete({ where: { id } });
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: "Couldn't delete this product. Try hiding it instead." });
  }
});
