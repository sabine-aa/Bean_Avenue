import { Router } from "express";
import { requireAdmin } from "../auth";
import { prisma } from "../db";
import { actorCtx, audit } from "../lib/activity";
import { DOUGHNUT_CATEGORY } from "../lib/constants";

export const importRouter = Router();
importRouter.use(requireAdmin);

// ---------- payload shapes (canonical keys the frontend maps headers onto) ----------
type StockRow = { itemName?: string; category?: string; unit?: string; currentQty?: string; minQty?: string; costPerUnit?: string; supplier?: string; expiryDate?: string; trackExpiry?: string; batchLot?: string; storageLocation?: string; notes?: string };
type RecipeRow = { menuItem?: string; menuCategory?: string; size?: string; addon?: string; inventoryItemUsed?: string; qtyUsed?: string; unit?: string; deductionRule?: string; replacesInventoryItem?: string; notes?: string };
type ProductRow = { productName?: string; type?: string; currentQty?: string; minQty?: string; cost?: string; supplier?: string; expiryDate?: string; notes?: string };
type HansonRow = { date?: string; doughnut?: string; category?: string; qtyProduced?: string; costPiece?: string; availableToday?: string; notes?: string };
type Payload = { stock?: StockRow[]; recipes?: RecipeRow[]; products?: ProductRow[]; hanson?: HansonRow[] };

type Status = "ok" | "warn" | "error";
type Annotated<T> = T & { _row: number; _status: Status; _messages: string[] };

const UNITS = ["g", "ml", "pc"];
const s = (v: unknown) => String(v ?? "").trim();
const low = (v: unknown) => s(v).toLowerCase();
const num = (v: unknown): number | null => { const t = s(v); if (t === "") return null; const n = Number(t); return Number.isFinite(n) ? n : NaN; };
const yesNo = (v: unknown, dflt: boolean): boolean => { const t = low(v); if (["yes", "y", "true", "1"].includes(t)) return true; if (["no", "n", "false", "0"].includes(t)) return false; return dflt; };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const parseDate = (v: unknown): { ok: boolean; date: Date | null } => {
  const t = s(v); if (t === "") return { ok: true, date: null };
  if (!DATE_RE.test(t)) return { ok: false, date: null };
  const d = new Date(`${t}T00:00:00`); return Number.isNaN(d.getTime()) ? { ok: false, date: null } : { ok: true, date: d };
};

type Ctx = {
  inv: Map<string, { id: number; unit: string }>;         // existing inventory by lower(name)
  stockUnits: Map<string, string>;                         // this import's stock rows: lower(name) -> unit
  menu: Map<string, { id: number; sizes: string[]; hasSize: boolean }>;
  addons: Map<string, number>;
  hanson: Map<string, { id: number; subcategory: string }>;
  shop: Map<string, number>;
};

async function buildContext(payload: Payload): Promise<Ctx> {
  const invRows = await prisma.inventoryItem.findMany({ where: { isActive: true }, select: { id: true, name: true, unit: true } });
  const inv = new Map(invRows.map((r) => [r.name.toLowerCase(), { id: r.id, unit: r.unit }]));
  const stockUnits = new Map<string, string>();
  for (const r of payload.stock ?? []) { const n = low(r.itemName); if (n) stockUnits.set(n, low(r.unit)); }

  const menuRows = await prisma.menuItem.findMany({ select: { id: true, name: true, category: true, options: true } });
  const menu = new Map<string, { id: number; sizes: string[]; hasSize: boolean }>();
  for (const m of menuRows) {
    let sizes: string[] = [];
    try {
      const groups = JSON.parse(m.options || "[]") as { name?: string; choices?: { label?: string }[] }[];
      const sizeGroup = groups.find((g) => (g.name ?? "").toLowerCase() === "size");
      sizes = (sizeGroup?.choices ?? []).map((c) => s(c.label)).filter(Boolean);
    } catch { /* ignore bad options json */ }
    menu.set(m.name.toLowerCase(), { id: m.id, sizes, hasSize: sizes.length > 0 });
  }
  const addonRows = await prisma.addon.findMany({ select: { id: true, name: true } });
  const addons = new Map(addonRows.map((a) => [a.name.toLowerCase(), a.id]));
  const hansonRows = await prisma.menuItem.findMany({ where: { category: DOUGHNUT_CATEGORY }, select: { id: true, name: true, subcategory: true } });
  const hanson = new Map(hansonRows.map((h) => [h.name.toLowerCase(), { id: h.id, subcategory: h.subcategory }]));
  const shopRows = await prisma.shopProduct.findMany({ select: { id: true, name: true } });
  const shop = new Map(shopRows.map((p) => [p.name.toLowerCase(), p.id]));
  return { inv, stockUnits, menu, addons, hanson, shop };
}

// Known inventory (existing + this import's stock tab) → unit, for recipe checks.
const knownInvUnit = (ctx: Ctx, name: string): string | null => {
  const n = name.toLowerCase();
  if (ctx.inv.has(n)) return ctx.inv.get(n)!.unit;
  if (ctx.stockUnits.has(n)) return ctx.stockUnits.get(n)!;
  return null;
};

type ValResult = {
  summary: { stock: number; recipes: number; products: number; hanson: number; errors: number; warnings: number; willImport: number };
  tabs: { stock: Annotated<StockRow>[]; recipes: Annotated<RecipeRow>[]; products: Annotated<ProductRow>[]; hanson: Annotated<HansonRow>[] };
  errors: { tab: string; row: number; message: string }[];
  warnings: { tab: string; row: number; message: string }[];
};

function validateAll(payload: Payload, ctx: Ctx): ValResult {
  const errors: ValResult["errors"] = [];
  const warnings: ValResult["warnings"] = [];

  const annotate = <T extends object>(row: T, i: number, tab: string, checks: () => { errs: string[]; warns: string[] }): Annotated<T> => {
    const { errs, warns } = checks();
    errs.forEach((m) => errors.push({ tab, row: i + 1, message: m }));
    warns.forEach((m) => warnings.push({ tab, row: i + 1, message: m }));
    const status: Status = errs.length ? "error" : warns.length ? "warn" : "ok";
    return { ...row, _row: i + 1, _status: status, _messages: [...errs, ...warns] };
  };

  // ---- A: stock ----
  const stockSeen = new Set<string>();
  const stock = (payload.stock ?? []).filter((r) => s(r.itemName)).map((r, i) => annotate(r, i, "A - Current Stock", () => {
    const errs: string[] = []; const warns: string[] = [];
    if (!UNITS.includes(low(r.unit))) errs.push(`Unit "${s(r.unit)}" must be one of g, ml, pc.`);
    for (const [k, label] of [["currentQty", "Current Qty"], ["minQty", "Min Qty"], ["costPerUnit", "Cost/Unit"]] as const) {
      if (Number.isNaN(num(r[k]))) errs.push(`${label} "${s(r[k])}" is not a number.`);
    }
    if (!parseDate(r.expiryDate).ok) errs.push(`Expiry Date "${s(r.expiryDate)}" must be YYYY-MM-DD.`);
    const key = low(r.itemName);
    if (stockSeen.has(key)) warns.push(`Duplicate item "${s(r.itemName)}" — the last row wins.`);
    stockSeen.add(key);
    return { errs, warns };
  }));

  // ---- B: recipes ----
  const recipeSeen = new Set<string>();
  const recipes = (payload.recipes ?? []).filter((r) => s(r.menuItem)).map((r, i) => annotate(r, i, "B - Recipes", () => {
    const errs: string[] = []; const warns: string[] = [];
    const menu = ctx.menu.get(low(r.menuItem));
    if (!menu) errs.push(`Menu item "${s(r.menuItem)}" not found in the menu.`);
    const invName = s(r.inventoryItemUsed);
    if (!invName) errs.push("Inventory Item Used is required.");
    else {
      const unit = knownInvUnit(ctx, invName);
      if (unit == null) errs.push(`Inventory item "${invName}" is used here but not in Current Stock.`);
      else if (low(r.unit) && unit !== low(r.unit)) errs.push(`Unit mismatch: recipe uses ${low(r.unit)} but "${invName}" is tracked in ${unit}.`);
    }
    if (!UNITS.includes(low(r.unit))) errs.push(`Unit "${s(r.unit)}" must be one of g, ml, pc.`);
    const q = num(r.qtyUsed);
    if (q == null || Number.isNaN(q) || q <= 0) errs.push(`Qty Used "${s(r.qtyUsed)}" must be a number greater than 0.`);
    // size
    if (s(r.size) && menu) {
      if (!menu.hasSize) errs.push(`"${s(r.menuItem)}" has no sizes, but Size "${s(r.size)}" was given.`);
      else if (!menu.sizes.some((x) => x.toLowerCase() === low(r.size))) errs.push(`Size "${s(r.size)}" is not a size of "${s(r.menuItem)}" (${menu.sizes.join(", ")}).`);
    }
    // add-on
    if (s(r.addon) && !ctx.addons.has(low(r.addon))) errs.push(`Add-on "${s(r.addon)}" does not match an existing add-on.`);
    // deduction rule + replace
    const rule = low(r.deductionRule) || "add";
    if (!["add", "replace"].includes(rule)) errs.push(`Deduction Rule "${s(r.deductionRule)}" must be ADD or REPLACE.`);
    if (rule === "replace") {
      const rep = s(r.replacesInventoryItem);
      if (!rep) errs.push("REPLACE rule needs 'Replaces Inventory Item' filled in.");
      else if (knownInvUnit(ctx, rep) == null) errs.push(`"Replaces Inventory Item" = "${rep}" is not in Current Stock.`);
      if (!s(r.addon)) warns.push("REPLACE is usually on an add-on row (Add-on is blank here).");
    }
    // duplicate line
    const key = [low(r.menuItem), low(r.size), low(r.addon), low(r.inventoryItemUsed)].join("|");
    if (recipeSeen.has(key)) warns.push("Duplicate recipe line (same item/size/add-on/ingredient) — may double-deduct; only the last is kept.");
    recipeSeen.add(key);
    return { errs, warns };
  }));

  // ---- C: products ----
  const products = (payload.products ?? []).filter((r) => s(r.productName)).map((r, i) => annotate(r, i, "C - Products", () => {
    const errs: string[] = []; const warns: string[] = [];
    const type = low(r.type);
    if (!["cafe", "café", "retail", "hanson"].includes(type)) errs.push(`Type "${s(r.type)}" must be Cafe, Retail, or Hanson.`);
    if (type === "hanson") errs.push("Hanson doughnuts go in the 'D - Hanson Daily' tab, not Products.");
    else if (type === "cafe" || type === "café") { if (!ctx.menu.has(low(r.productName))) errs.push(`Cafe product "${s(r.productName)}" not found in the menu — create it in Menu Manager first.`); }
    else if (type === "retail") { if (!ctx.shop.has(low(r.productName))) errs.push(`Retail product "${s(r.productName)}" not found in Shop Products — create it there first.`); }
    for (const [k, label] of [["currentQty", "Current Qty"], ["minQty", "Min Qty"], ["cost", "Cost"]] as const) {
      if (Number.isNaN(num(r[k]))) errs.push(`${label} "${s(r[k])}" is not a number.`);
    }
    if (!parseDate(r.expiryDate).ok) errs.push(`Expiry Date "${s(r.expiryDate)}" must be YYYY-MM-DD.`);
    return { errs, warns };
  }));

  // ---- D: hanson ----
  const hanson = (payload.hanson ?? []).filter((r) => s(r.doughnut)).map((r, i) => annotate(r, i, "D - Hanson Daily", () => {
    const errs: string[] = []; const warns: string[] = [];
    if (!parseDate(r.date).ok || !s(r.date)) errs.push(`Date "${s(r.date)}" must be YYYY-MM-DD.`);
    const h = ctx.hanson.get(low(r.doughnut));
    if (!h) errs.push(`Doughnut "${s(r.doughnut)}" not found in Hanson products.`);
    const q = num(r.qtyProduced);
    if (q == null || Number.isNaN(q) || q < 0) errs.push(`Qty Produced "${s(r.qtyProduced)}" must be 0 or more.`);
    if (r.costPiece != null && s(r.costPiece) !== "" && Number.isNaN(num(r.costPiece))) errs.push(`Cost/Piece "${s(r.costPiece)}" is not a number.`);
    if (h && s(r.category) && h.subcategory && low(r.category) !== h.subcategory.toLowerCase()) warns.push(`Category "${s(r.category)}" differs from the catalogue (${h.subcategory}).`);
    return { errs, warns };
  }));

  const willImport =
    stock.filter((r) => r._status !== "error").length +
    recipes.filter((r) => r._status !== "error").length +
    products.filter((r) => r._status !== "error").length +
    hanson.filter((r) => r._status !== "error").length;

  return {
    summary: { stock: stock.length, recipes: recipes.length, products: products.length, hanson: hanson.length, errors: errors.length, warnings: warnings.length, willImport },
    tabs: { stock, recipes, products, hanson },
    errors, warnings,
  };
}

// POST /api/import/validate — dry run, returns annotated preview.
importRouter.post("/validate", async (req, res) => {
  const payload = (req.body ?? {}) as Payload;
  const ctx = await buildContext(payload);
  res.json(validateAll(payload, ctx));
});

// POST /api/import/commit — apply everything that isn't an error, in tab order.
importRouter.post("/commit", async (req, res) => {
  const payload = (req.body ?? {}) as Payload;
  const ctx = await buildContext(payload);
  const v = validateAll(payload, ctx);
  const actor = actorCtx(req);
  const results = { stock: 0, recipes: 0, products: 0, hanson: 0, skipped: 0 };
  const skip = () => { results.skipped++; };

  // ---- A: stock (upsert by name; log a COUNT movement for the set quantity) ----
  for (const r of v.tabs.stock) {
    if (r._status === "error") { skip(); continue; }
    const qty = num(r.currentQty) ?? 0;
    const data = {
      category: s(r.category), unit: low(r.unit), quantity: qty as number, minQty: num(r.minQty) ?? 0, costPerUnit: num(r.costPerUnit) ?? 0,
      supplier: s(r.supplier) || null, expiryDate: parseDate(r.expiryDate).date, trackExpiry: yesNo(r.trackExpiry, false),
      batchLot: s(r.batchLot) || null, storageLocation: s(r.storageLocation) || null, notes: s(r.notes) || null, isActive: true,
    };
    const existing = await prisma.inventoryItem.findUnique({ where: { name: s(r.itemName) } });
    const item = existing
      ? await prisma.inventoryItem.update({ where: { id: existing.id }, data })
      : await prisma.inventoryItem.create({ data: { name: s(r.itemName), ...data } });
    const delta = Math.round(((qty as number) - (existing?.quantity ?? 0)) * 1000) / 1000;
    await prisma.inventoryMovement.create({ data: { inventoryItemId: item.id, delta, balance: qty as number, type: "COUNT", reason: "Excel import", staffName: actor.actorName } });
    results.stock++;
  }

  // Reload inventory ids now that new stock items exist.
  const invById = new Map((await prisma.inventoryItem.findMany({ select: { id: true, name: true } })).map((x) => [x.name.toLowerCase(), x.id]));

  // ---- B: recipes (source of truth per menu item: replace that item's recipe) ----
  const recipeRows = v.tabs.recipes.filter((r) => r._status !== "error");
  const byMenu = new Map<number, RecipeRow[]>();
  for (const r of recipeRows) {
    const mid = ctx.menu.get(low(r.menuItem))!.id;
    if (!byMenu.has(mid)) byMenu.set(mid, []);
    byMenu.get(mid)!.push(r);
  }
  for (const [mid, rows] of byMenu) {
    await prisma.recipeComponent.deleteMany({ where: { menuItemId: mid } });
    const seen = new Set<string>();
    for (const r of rows) {
      const key = [low(r.size), low(r.addon), low(r.inventoryItemUsed)].join("|");
      if (seen.has(key)) { skip(); continue; } // drop duplicate line
      seen.add(key);
      const invId = invById.get(low(r.inventoryItemUsed));
      if (!invId) { skip(); continue; }
      const addonId = s(r.addon) ? ctx.addons.get(low(r.addon)) ?? null : null;
      const replacesId = low(r.deductionRule) === "replace" && s(r.replacesInventoryItem) ? invById.get(low(r.replacesInventoryItem)) ?? null : null;
      await prisma.recipeComponent.create({
        data: { menuItemId: mid, size: s(r.size) || null, addonId, inventoryItemId: invId, quantity: num(r.qtyUsed) ?? 0, replacesInventoryItemId: replacesId },
      });
      results.recipes++;
    }
  }

  // ---- C: products ----
  for (const r of v.tabs.products) {
    if (r._status === "error") { skip(); continue; }
    const type = low(r.type);
    const qty = num(r.currentQty) ?? 0;
    if (type === "cafe" || type === "café") {
      const mid = ctx.menu.get(low(r.productName))!.id;
      const before = await prisma.menuItem.findUnique({ where: { id: mid }, select: { stockQty: true } });
      await prisma.menuItem.update({ where: { id: mid }, data: { trackStock: true, stockQty: qty, lowStockAt: num(r.minQty) ?? 0, costPrice: num(r.cost) ?? 0 } });
      await prisma.stockMovement.create({ data: { menuItemId: mid, delta: qty - (before?.stockQty ?? 0), balance: qty, type: "COUNT", reason: "Excel import", staffName: actor.actorName } });
      results.products++;
    } else if (type === "retail") {
      const pid = ctx.shop.get(low(r.productName))!;
      const before = await prisma.shopProduct.findUnique({ where: { id: pid }, select: { quantity: true } });
      await prisma.shopProduct.update({ where: { id: pid }, data: { quantity: qty, minQty: num(r.minQty) ?? 0, costPrice: num(r.cost) ?? 0 } });
      await prisma.shopStockMovement.create({ data: { productId: pid, delta: qty - (before?.quantity ?? 0), balance: qty, type: "COUNT", reason: "Excel import", staffName: actor.actorName } });
      results.products++;
    } else skip();
  }

  // ---- D: hanson daily ----
  for (const r of v.tabs.hanson) {
    if (r._status === "error") { skip(); continue; }
    const h = ctx.hanson.get(low(r.doughnut))!;
    const made = Math.max(0, Math.round(num(r.qtyProduced) ?? 0));
    const date = s(r.date);
    await prisma.hansonProduction.upsert({
      where: { menuItemId_date: { menuItemId: h.id, date } },
      create: { menuItemId: h.id, date, made, sold: 0, createdBy: actor.actorName },
      update: { made },
    });
    const cost = num(r.costPiece);
    await prisma.menuItem.update({ where: { id: h.id }, data: { availableToday: yesNo(r.availableToday, true), ...(cost != null && !Number.isNaN(cost) ? { costPrice: cost } : {}) } });
    results.hanson++;
  }

  // ---- audit ----
  if (results.stock) await audit(actor, { section: "Inventory", action: "import_stock", description: `Excel import: ${results.stock} inventory item(s)`, entity: "Import", newValue: { count: results.stock } });
  if (results.recipes) await audit(actor, { section: "Inventory", action: "import_recipes", description: `Excel import: ${results.recipes} recipe line(s) across ${byMenu.size} menu item(s)`, entity: "Import", newValue: { count: results.recipes, menuItems: byMenu.size } });
  if (results.products) await audit(actor, { section: "Inventory", action: "import_products", description: `Excel import: ${results.products} product stock row(s)`, entity: "Import", newValue: { count: results.products } });
  if (results.hanson) await audit(actor, { section: "Hanson", action: "import_hanson", description: `Excel import: ${results.hanson} Hanson daily row(s)`, entity: "Import", newValue: { count: results.hanson } });

  res.json({ results, errors: v.errors, warnings: v.warnings });
});
