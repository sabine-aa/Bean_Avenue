import { Router } from "express";
import { requireAdmin } from "../auth";
import { prisma } from "../db";
import { DOUGHNUT_CATEGORY } from "../lib/constants";

export const categoriesRouter = Router();

// GET /api/categories  (public) — categories in display order.
// Any menu category not yet in the Category table is appended at the end so
// nothing ever disappears from the menu.
categoriesRouter.get("/", async (_req, res) => {
  const [categories, items] = await Promise.all([
    prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.menuItem.findMany({ select: { category: true }, distinct: ["category"] }),
  ]);
  const ordered = categories.map((c) => c.name).filter((n) => n !== DOUGHNUT_CATEGORY);
  const extras = items
    .map((i) => i.category)
    .filter((name) => name && name !== DOUGHNUT_CATEGORY && !ordered.includes(name))
    .sort();
  res.json([...ordered, ...extras]);
});

// POST /api/categories  (admin)  { name } — create a new category (idempotent)
categoriesRouter.post("/", requireAdmin, async (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  if (!name) return res.status(400).json({ error: "Category name is required." });
  const max = await prisma.category.aggregate({ _max: { sortOrder: true } });
  await prisma.category.upsert({
    where: { name },
    create: { name, sortOrder: (max._max.sortOrder ?? 0) + 1 },
    update: {},
  });
  res.status(201).json({ ok: true, name });
});

// DELETE /api/categories/:name  (admin) — remove a category (only when empty)
categoriesRouter.delete("/:name", requireAdmin, async (req, res) => {
  const name = req.params.name;
  const inUse = await prisma.menuItem.count({ where: { category: name } });
  if (inUse > 0) return res.status(400).json({ error: `${inUse} item${inUse === 1 ? "" : "s"} still use this category — move or delete them first.` });
  await prisma.category.deleteMany({ where: { name } });
  res.json({ ok: true });
});

// PATCH /api/categories/order  (admin)  { names: string[] } — set the order
categoriesRouter.patch("/order", requireAdmin, async (req, res) => {
  const names: string[] = Array.isArray(req.body.names) ? req.body.names : [];
  await prisma.$transaction(
    names.map((name, index) =>
      prisma.category.upsert({
        where: { name },
        create: { name, sortOrder: index },
        update: { sortOrder: index },
      }),
    ),
  );
  res.json({ ok: true });
});
