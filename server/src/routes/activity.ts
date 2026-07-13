import { Prisma } from "@prisma/client";
import { Router } from "express";
import { requireAdmin } from "../auth";
import { prisma } from "../db";

// Owner/Manager-only audit trail. The whole admin login is owner/manager, so
// requireAdmin is the right gate; POS staff (cashiers/baristas) can't reach it.
export const activityRouter = Router();
activityRouter.use(requireAdmin);

// GET /api/activity — filtered audit log.
//   ?from ?to ?section ?action ?source ?actor ?order ?q ?limit
activityRouter.get("/", async (req, res) => {
  const q = req.query as Record<string, string>;
  const where: Prisma.AdminActivityLogWhereInput = {};

  if (q.from || q.to) {
    const range: Prisma.DateTimeFilter = {};
    if (q.from) range.gte = new Date(q.from);
    if (q.to) { const t = new Date(q.to); t.setHours(23, 59, 59, 999); range.lte = t; }
    where.createdAt = range;
  }
  if (q.section) where.section = q.section;
  if (q.action) where.action = q.action;
  if (q.source) where.source = q.source;
  if (q.actor) where.actor = { contains: q.actor, mode: "insensitive" };
  if (q.order) where.orderNumber = { contains: q.order.trim().toUpperCase() };
  if (q.q) {
    const s = q.q.trim();
    where.OR = [
      { detail: { contains: s, mode: "insensitive" } },
      { entityName: { contains: s, mode: "insensitive" } },
      { orderNumber: { contains: s.toUpperCase() } },
      { actor: { contains: s, mode: "insensitive" } },
    ];
  }

  const limit = Math.min(5000, Math.max(1, Number(q.limit) || 200));
  const rows = await prisma.adminActivityLog.findMany({ where, orderBy: { createdAt: "desc" }, take: limit });
  res.json({ rows, count: rows.length });
});

// GET /api/activity/options — distinct values for the filter dropdowns.
activityRouter.get("/options", async (_req, res) => {
  const rows = await prisma.adminActivityLog.findMany({
    select: { section: true, action: true, actor: true, source: true },
    orderBy: { createdAt: "desc" },
    take: 3000,
  });
  const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))].sort();
  res.json({
    sections: uniq(rows.map((r) => r.section)),
    actions: uniq(rows.map((r) => r.action)),
    actors: uniq(rows.map((r) => r.actor)),
    sources: uniq(rows.map((r) => r.source)),
  });
});
