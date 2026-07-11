import { Router } from "express";
import { requireAdmin } from "../auth";
import { prisma } from "../db";
import { genNumber } from "../lib/helpers";

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

// ---- Restock / supplier receiving ----

// GET /api/stock/restocks?limit= — restock history (newest first).
stockRouter.get("/restocks", async (req, res) => {
  const limit = Math.min(200, Math.max(1, Number((req.query as Record<string, string>).limit) || 100));
  const rows = await prisma.restock.findMany({ orderBy: { createdAt: "desc" }, take: limit });
  res.json(rows);
});

// GET /api/stock/restocks/:id — one restock with all its received lines.
stockRouter.get("/restocks/:id", async (req, res) => {
  const restock = await prisma.restock.findUnique({ where: { id: Number(req.params.id) }, include: { lines: true } });
  if (!restock) return res.status(404).json({ error: "Restock not found." });
  res.json(restock);
});

// POST /api/stock/restock — record a whole supplier delivery in one transaction.
//   { supplierId?, supplierName, supplierPhone?, invoiceNo?, invoicePhoto?, deliveryDate?,
//     receivedBy?, notes?, lines: [{ inventoryItemId? | newItem{...}, quantity, costPerUnit?,
//     expiryDate?, batchNo?, notes? }] }
// Increases each item's on-hand quantity, logs a RECEIVE movement per line, and can
// create brand-new inventory items inline. Everything is applied atomically.
stockRouter.post("/restock", async (req, res) => {
  const b = req.body ?? {};
  const rawLines: Record<string, unknown>[] = Array.isArray(b.lines) ? b.lines : [];
  const supplierName = String(b.supplierName ?? "").trim();
  if (!supplierName) return res.status(400).json({ error: "Choose or enter a supplier." });
  if (!rawLines.length) return res.status(400).json({ error: "Add at least one item to the restock." });

  const supplierId = b.supplierId ? Number(b.supplierId) : null;
  const invoiceNo = String(b.invoiceNo ?? "").trim() || null;
  const invoicePhoto = String(b.invoicePhoto ?? "").trim() || null;
  const supplierPhone = String(b.supplierPhone ?? "").trim() || null;
  const receivedBy = String(b.receivedBy ?? "").trim() || null;
  const notes = String(b.notes ?? "").trim() || null;
  const deliveryDate = b.deliveryDate ? new Date(String(b.deliveryDate)) : new Date();

  type Prepared = { itemId: number; itemName: string; unit: string; qty: number; cost: number; lineTotal: number; expiry: Date | null; batchNo: string | null; noteLine: string | null };
  const prepared: Prepared[] = [];
  for (const l of rawLines) {
    const qty = round(Number(l.quantity));
    if (!(qty > 0)) continue; // skip blank lines
    const cost = Math.max(0, round(Number(l.costPerUnit)));
    const itemId = l.inventoryItemId ? Number(l.inventoryItemId) : 0;
    let item = itemId ? await prisma.inventoryItem.findUnique({ where: { id: itemId } }) : null;

    // Create a brand-new inventory item straight from the restock, if requested.
    const ni = l.newItem as Record<string, unknown> | undefined;
    if (!item && ni && String(ni.name ?? "").trim()) {
      const name = String(ni.name).trim();
      const existing = await prisma.inventoryItem.findUnique({ where: { name } });
      item = existing ?? (await prisma.inventoryItem.create({
        data: {
          name,
          category: String(ni.category ?? "").trim(),
          unit: String(ni.unit ?? l.unit ?? "pcs").trim() || "pcs",
          quantity: 0,
          minQty: Math.max(0, round(Number(ni.minQty))),
          costPerUnit: cost,
          supplier: supplierName,
        },
      }));
    }
    if (!item) return res.status(400).json({ error: "Each line needs an existing item or a new item name." });

    prepared.push({
      itemId: item.id,
      itemName: item.name,
      unit: item.unit,
      qty,
      cost,
      lineTotal: round(qty * cost),
      expiry: l.expiryDate ? new Date(String(l.expiryDate)) : null,
      batchNo: String(l.batchNo ?? "").trim() || null,
      noteLine: String(l.notes ?? "").trim() || null,
    });
  }
  if (!prepared.length) return res.status(400).json({ error: "Add at least one item with a quantity." });

  const totalCost = round(prepared.reduce((s, p) => s + p.lineTotal, 0));
  const number = genNumber("RS");

  const restock = await prisma.$transaction(async (tx) => {
    const header = await tx.restock.create({
      data: {
        number, supplierId, supplierName, supplierPhone, invoiceNo, invoicePhoto,
        deliveryDate, receivedBy, notes, itemCount: prepared.length, totalCost, createdBy: "Admin",
      },
    });
    for (const p of prepared) {
      const current = await tx.inventoryItem.findUnique({ where: { id: p.itemId } });
      const balance = round((current?.quantity ?? 0) + p.qty);
      await tx.inventoryItem.update({
        where: { id: p.itemId },
        data: {
          quantity: balance,
          ...(p.cost > 0 ? { costPerUnit: p.cost } : {}),
          supplier: supplierName,
          ...(p.expiry ? { expiryDate: p.expiry } : {}),
        },
      });
      await tx.inventoryMovement.create({
        data: {
          inventoryItemId: p.itemId, delta: p.qty, balance, type: "RECEIVE",
          reason: `Restock ${number} from ${supplierName}${invoiceNo ? `, Invoice #${invoiceNo}` : ""}`,
          staffName: receivedBy || "Admin", invoiceNo, costPerUnit: p.cost || null, restockId: header.id,
        },
      });
      await tx.restockLine.create({
        data: {
          restockId: header.id, inventoryItemId: p.itemId, itemName: p.itemName, quantity: p.qty,
          unit: p.unit, costPerUnit: p.cost, totalCost: p.lineTotal, expiryDate: p.expiry, batchNo: p.batchNo, notes: p.noteLine,
        },
      });
    }
    return header;
  });

  res.status(201).json(restock);
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

// GET /api/stock/recipes/coverage — menu items that already have a recipe.
stockRouter.get("/recipes/coverage", async (_req, res) => {
  const rows = await prisma.recipeComponent.findMany({ select: { menuItemId: true }, distinct: ["menuItemId"] });
  res.json({ menuItemIds: rows.map((r) => r.menuItemId) });
});

// GET /api/stock/recipe/:menuItemId — a product's recipe + everything the editor
// needs (its sizes, applicable add-ons, and the stock-item list for dropdowns).
stockRouter.get("/recipe/:menuItemId", async (req, res) => {
  const menuItemId = Number(req.params.menuItemId);
  const menuItem = await prisma.menuItem.findUnique({ where: { id: menuItemId } });
  if (!menuItem) return res.status(404).json({ error: "Product not found." });

  let sizes: string[] = [];
  try {
    const options = JSON.parse(menuItem.options || "[]") as { name: string; choices: { label: string }[] }[];
    sizes = options.find((g) => g.name.toLowerCase() === "size")?.choices.map((c) => c.label) ?? [];
  } catch { /* no options */ }

  const groups = await prisma.addonGroup.findMany({
    where: { isAvailable: true, assignments: { some: { OR: [{ menuItemId }, { category: menuItem.category }] } } },
    include: { addons: { where: { isAvailable: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } },
  });
  const addons = groups.flatMap((g) => g.addons.map((a) => ({ id: a.id, name: a.name, group: g.name })));
  const stockItems = await prisma.inventoryItem.findMany({ where: { isActive: true }, orderBy: [{ category: "asc" }, { name: "asc" }], select: { id: true, name: true, unit: true } });
  const components = await prisma.recipeComponent.findMany({ where: { menuItemId } });
  res.json({ menuItem: { id: menuItem.id, name: menuItem.name, category: menuItem.category, sizes }, addons, stockItems, components });
});

// PUT /api/stock/recipe/:menuItemId — replace a product's whole recipe.
//   { components: [{ size|null, addonId|null, inventoryItemId, quantity }] }
stockRouter.put("/recipe/:menuItemId", async (req, res) => {
  const menuItemId = Number(req.params.menuItemId);
  const raw = Array.isArray(req.body?.components) ? req.body.components : [];
  const clean = raw
    .map((c: Record<string, unknown>) => ({
      menuItemId,
      size: c.size ? String(c.size) : null,
      addonId: c.addonId ? Number(c.addonId) : null,
      inventoryItemId: Number(c.inventoryItemId),
      quantity: round(Number(c.quantity)),
    }))
    .filter((c: { inventoryItemId: number; quantity: number }) => c.inventoryItemId && c.quantity > 0);
  await prisma.$transaction([
    prisma.recipeComponent.deleteMany({ where: { menuItemId } }),
    prisma.recipeComponent.createMany({ data: clean }),
  ]);
  res.json({ ok: true, count: clean.length });
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
