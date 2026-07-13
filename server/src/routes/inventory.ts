import { Router } from "express";
import { requireAdmin } from "../auth";
import { prisma } from "../db";
import { actorCtx, audit } from "../lib/activity";

const ADJUST_ACTION: Record<string, string> = { RECEIVE: "stock_received", WASTE: "stock_wasted", COUNT: "stock_recount", ADJUST: "stock_adjusted" };

export const inventoryRouter = Router();
inventoryRouter.use(requireAdmin);

const MOVEMENT_TYPES = ["RECEIVE", "WASTE", "COUNT", "ADJUST"];

// GET /api/inventory — every menu item with its stock state + a headline summary.
inventoryRouter.get("/", async (_req, res) => {
  const items = await prisma.menuItem.findMany({
    where: { isHidden: false },
    orderBy: [{ trackStock: "desc" }, { category: "asc" }, { sortOrder: "asc" }],
    select: { id: true, name: true, category: true, inStock: true, trackStock: true, stockQty: true, lowStockAt: true },
  });
  const tracked = items.filter((i) => i.trackStock);
  res.json({
    items,
    summary: {
      tracked: tracked.length,
      out: tracked.filter((i) => i.stockQty <= 0).length,
      low: tracked.filter((i) => i.stockQty > 0 && i.stockQty <= i.lowStockAt).length,
    },
  });
});

// GET /api/inventory/movements?limit= — recent stock changes (with item names).
inventoryRouter.get("/movements", async (req, res) => {
  const limit = Math.min(200, Math.max(1, Number((req.query as Record<string, string>).limit) || 60));
  const moves = await prisma.stockMovement.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { menuItem: { select: { name: true } } },
  });
  res.json(moves.map((m) => ({ ...m, name: m.menuItem?.name ?? "—", menuItem: undefined })));
});

// PATCH /api/inventory/:id — turn tracking on/off + set the low-stock threshold.
inventoryRouter.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const item = await prisma.menuItem.findUnique({ where: { id } });
  if (!item) return res.status(404).json({ error: "Item not found." });
  const data: { trackStock?: boolean; lowStockAt?: number } = {};
  if (typeof req.body?.trackStock === "boolean") data.trackStock = req.body.trackStock;
  if (req.body?.lowStockAt !== undefined) data.lowStockAt = Math.max(0, Math.round(Number(req.body.lowStockAt) || 0));
  const updated = await prisma.menuItem.update({ where: { id }, data });
  res.json({ id: updated.id, trackStock: updated.trackStock, stockQty: updated.stockQty, lowStockAt: updated.lowStockAt });
});

// POST /api/inventory/:id/adjust — receive stock, log wastage, or recount.
//   { type: RECEIVE|WASTE|COUNT|ADJUST, amount, reason? }
inventoryRouter.post("/:id/adjust", async (req, res) => {
  const id = Number(req.params.id);
  const type = String(req.body?.type ?? "").toUpperCase();
  if (!MOVEMENT_TYPES.includes(type)) return res.status(400).json({ error: "Invalid adjustment type." });
  const item = await prisma.menuItem.findUnique({ where: { id } });
  if (!item) return res.status(404).json({ error: "Item not found." });

  const amount = Math.round(Number(req.body?.amount) || 0);
  const reason = String(req.body?.reason ?? "").trim().slice(0, 200) || null;

  // Resolve the signed delta + the resulting balance for each adjustment type.
  let delta: number;
  if (type === "RECEIVE") delta = Math.max(0, amount);
  else if (type === "WASTE") delta = -Math.min(Math.max(0, amount), item.stockQty);
  else if (type === "COUNT") delta = amount - item.stockQty; // set on-hand to `amount`
  else delta = amount; // ADJUST: signed
  const balance = Math.max(0, item.stockQty + delta);

  const updated = await prisma.menuItem.update({
    where: { id },
    // Setting stock on an item turns tracking on automatically.
    data: { stockQty: balance, trackStock: true },
  });
  await prisma.stockMovement.create({
    data: { menuItemId: id, delta, balance, type, reason, staffName: "Admin" },
  });
  await audit(actorCtx(req), {
    section: "Inventory",
    action: ADJUST_ACTION[type] ?? "stock_adjusted",
    description: `${item.name}: ${delta >= 0 ? "+" : ""}${delta} → ${balance} on hand${reason ? ` (${reason})` : ""}`,
    entity: "MenuItem", entityId: id, entityName: item.name,
    oldValue: { stockQty: item.stockQty }, newValue: { stockQty: balance },
  });
  res.json({ id: updated.id, trackStock: updated.trackStock, stockQty: updated.stockQty, lowStockAt: updated.lowStockAt });
});
