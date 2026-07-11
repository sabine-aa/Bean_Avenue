import { Router } from "express";
import { requireAdmin } from "../auth";
import { prisma } from "../db";

export const stockRouter = Router();
stockRouter.use(requireAdmin);

const round = (n: number) => Math.round((Number(n) || 0) * 1000) / 1000;
// Manual movement types available in Phase 1 (SALE / REFUND_REVERSAL come from orders).
const ADJUST_TYPES = ["RECEIVE", "WASTE", "EXPIRED", "DAMAGED", "COUNT", "ADJUST"];

// GET /api/stock — all stock items + a headline summary (incl. total stock value).
stockRouter.get("/", async (_req, res) => {
  const items = await prisma.inventoryItem.findMany({ where: { isActive: true }, orderBy: [{ category: "asc" }, { name: "asc" }] });
  res.json({
    items,
    summary: {
      items: items.length,
      low: items.filter((i) => i.quantity > 0 && i.quantity <= i.minQty).length,
      out: items.filter((i) => i.quantity <= 0).length,
      value: round(items.reduce((s, i) => s + i.quantity * i.costPerUnit, 0)),
    },
    categories: [...new Set(items.map((i) => i.category).filter(Boolean))].sort(),
  });
});

// GET /api/stock/movements?limit= — recent stock changes with item names.
stockRouter.get("/movements", async (req, res) => {
  const limit = Math.min(300, Math.max(1, Number((req.query as Record<string, string>).limit) || 60));
  const moves = await prisma.inventoryMovement.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { item: { select: { name: true, unit: true } } },
  });
  res.json(moves.map((m) => ({ ...m, name: m.item?.name ?? "—", unit: m.item?.unit ?? "", item: undefined })));
});

function cleanItem(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  if ("name" in body) data.name = String(body.name ?? "").trim();
  if ("category" in body) data.category = String(body.category ?? "").trim();
  if ("unit" in body) data.unit = String(body.unit ?? "pcs").trim() || "pcs";
  if ("quantity" in body) data.quantity = round(Number(body.quantity));
  if ("minQty" in body) data.minQty = Math.max(0, round(Number(body.minQty)));
  if ("costPerUnit" in body) data.costPerUnit = Math.max(0, round(Number(body.costPerUnit)));
  if ("supplier" in body) data.supplier = String(body.supplier ?? "").trim() || null;
  if ("expiryDate" in body) data.expiryDate = body.expiryDate ? new Date(String(body.expiryDate)) : null;
  return data;
}

// POST /api/stock — create a stock item.
stockRouter.post("/", async (req, res) => {
  const data = cleanItem(req.body);
  if (!data.name) return res.status(400).json({ error: "An item name is required." });
  const exists = await prisma.inventoryItem.findUnique({ where: { name: data.name as string } });
  if (exists) return res.status(409).json({ error: "A stock item with that name already exists." });
  const item = await prisma.inventoryItem.create({ data: data as never });
  // Record the opening quantity as a movement for the audit trail.
  if (item.quantity !== 0) {
    await prisma.inventoryMovement.create({ data: { inventoryItemId: item.id, delta: item.quantity, balance: item.quantity, type: "COUNT", reason: "Opening stock", staffName: "Admin" } });
  }
  res.status(201).json(item);
});

// PATCH /api/stock/:id — edit item details (name, unit, min, cost, supplier…).
// Does NOT change quantity — use /adjust so every quantity change is audited.
stockRouter.patch("/:id", async (req, res) => {
  const data = cleanItem(req.body);
  delete data.quantity; // quantity only moves through /adjust
  const item = await prisma.inventoryItem.update({ where: { id: Number(req.params.id) }, data });
  res.json(item);
});

// DELETE /api/stock/:id — soft-delete (keeps history + recipe links intact).
stockRouter.delete("/:id", async (req, res) => {
  await prisma.inventoryItem.update({ where: { id: Number(req.params.id) }, data: { isActive: false } });
  res.json({ ok: true });
});

// POST /api/stock/:id/adjust — receive / waste / expire / damage / recount / adjust.
//   { type, amount, reason?, invoiceNo?, supplier?, costPerUnit?, expiryDate? }
stockRouter.post("/:id/adjust", async (req, res) => {
  const type = String(req.body?.type ?? "").toUpperCase();
  if (!ADJUST_TYPES.includes(type)) return res.status(400).json({ error: "Invalid adjustment type." });
  const item = await prisma.inventoryItem.findUnique({ where: { id: Number(req.params.id) } });
  if (!item) return res.status(404).json({ error: "Stock item not found." });

  const amount = round(Number(req.body?.amount));
  const reason = String(req.body?.reason ?? "").trim().slice(0, 200) || null;

  let delta: number;
  if (type === "RECEIVE") delta = Math.max(0, amount);
  else if (["WASTE", "EXPIRED", "DAMAGED"].includes(type)) delta = -Math.min(Math.max(0, amount), item.quantity);
  else if (type === "COUNT") delta = round(amount - item.quantity); // set on-hand to `amount`
  else delta = amount; // ADJUST: signed
  const balance = round(Math.max(0, item.quantity + delta));

  // On RECEIVE, refresh cost/supplier/expiry from the delivery when provided.
  const itemUpdate: Record<string, unknown> = { quantity: balance };
  if (type === "RECEIVE") {
    if (req.body?.costPerUnit !== undefined) itemUpdate.costPerUnit = Math.max(0, round(Number(req.body.costPerUnit)));
    if (req.body?.supplier) itemUpdate.supplier = String(req.body.supplier).trim();
    if (req.body?.expiryDate) itemUpdate.expiryDate = new Date(String(req.body.expiryDate));
  }
  const updated = await prisma.inventoryItem.update({ where: { id: item.id }, data: itemUpdate });
  await prisma.inventoryMovement.create({
    data: {
      inventoryItemId: item.id,
      delta,
      balance,
      type,
      reason,
      staffName: "Admin",
      invoiceNo: type === "RECEIVE" ? String(req.body?.invoiceNo ?? "").trim() || null : null,
      costPerUnit: type === "RECEIVE" && req.body?.costPerUnit !== undefined ? Math.max(0, round(Number(req.body.costPerUnit))) : null,
    },
  });
  res.json(updated);
});
