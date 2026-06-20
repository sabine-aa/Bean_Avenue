import { Router } from "express";
import { requireAdmin } from "../auth";
import { prisma } from "../db";
import { DOUGHNUT_CATEGORY } from "../lib/constants";
import { outMenuItem, toJson } from "../lib/serialize";

export const menuRouter = Router();

// GET /api/menu  (public — visible items, excluding doughnuts which have their
// own page)   |   ?all=1 returns everything (admin list)
menuRouter.get("/", async (req, res) => {
  const all = req.query.all === "1";
  const items = await prisma.menuItem.findMany({
    where: all ? undefined : { isHidden: false, category: { not: DOUGHNUT_CATEGORY } },
    orderBy: { sortOrder: "asc" },
  });
  res.json(items.map(outMenuItem));
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
      ingredients: b.ingredients ?? null,
      tags: toJson(b.tags ?? []),
      options: toJson(b.options ?? []),
      inStock: b.inStock ?? true,
      isHidden: b.isHidden ?? false,
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
  for (const key of ["name", "category", "description", "photo", "ingredients", "inStock", "isHidden", "availableToday"]) {
    if (key in b) data[key] = b[key];
  }
  if ("price" in b) data.price = Number(b.price);
  if ("tags" in b) data.tags = toJson(b.tags);
  if ("options" in b) data.options = toJson(b.options);
  const item = await prisma.menuItem.update({ where: { id }, data });
  res.json(outMenuItem(item));
});

// DELETE /api/menu/:id  (admin)
menuRouter.delete("/:id", requireAdmin, async (req, res) => {
  await prisma.menuItem.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});
