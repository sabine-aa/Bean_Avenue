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

// PATCH /api/categories/order  (admin)  { names: string[] } — set the order
categoriesRouter.patch("/order", requireAdmin, async (req, res) => {
  const names: string[] = Array.isArray(req.body.names) ? req.body.names : [];
  await prisma.$transaction(
    names.map((name, index) =>
      prisma.category.upsert({
        where: { name },
        create: { name, sortOrder: index },
        update: { sortOrder: index },
      })
    )
  );
  res.json({ ok: true });
});
