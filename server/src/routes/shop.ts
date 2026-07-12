import { Router } from "express";
import { requireAdmin, requireStaff } from "../auth";
import { prisma } from "../db";

export const shopRouter = Router();

const round = (n: number) => Math.round((Number(n) || 0) * 1000) / 1000;
const ADJUST_TYPES = ["RECEIVE", "ADJUST", "COUNT"];

// Derive a product's public status from its stock + flags.
export function shopStatus(p: { quantity: number; minQty: number; allowPreorder: boolean; isHidden: boolean }): "IN_STOCK" | "LOW" | "OUT" | "PREORDER" | "HIDDEN" {
  if (p.isHidden) return "HIDDEN";
  if (p.quantity <= 0) return p.allowPreorder ? "PREORDER" : "OUT";
  if (p.quantity <= p.minQty) return "LOW";
  return "IN_STOCK";
}

type ProductInput = Record<string, unknown>;
function cleanProduct(body: ProductInput) {
  const data: Record<string, unknown> = {};
  const str = (k: string) => { if (k in body) data[k] = String(body[k] ?? "").trim(); };
  const strNull = (k: string) => { if (k in body) data[k] = String(body[k] ?? "").trim() || null; };
  const numF = (k: string) => { if (k in body) data[k] = Math.max(0, round(Number(body[k]))); };
  const boolF = (k: string) => { if (k in body) data[k] = !!body[k]; };
  str("name"); str("category"); str("description");
  strNull("brand"); strNull("sku"); strNull("preorderEta");
  numF("price"); numF("costPrice"); numF("minQty");
  boolF("availableOnline"); boolF("availablePos"); boolF("allowPreorder"); boolF("featured"); boolF("isHidden");
  if ("sortOrder" in body) data.sortOrder = Math.round(Number(body.sortOrder) || 0);
  if ("images" in body) data.images = JSON.stringify(Array.isArray(body.images) ? body.images : []);
  return data;
}

const outProduct = (p: Awaited<ReturnType<typeof prisma.shopProduct.findMany>>[number]) => ({
  ...p,
  images: JSON.parse(p.images || "[]") as string[],
  status: shopStatus(p),
});

// ---- Public storefront ----

// GET /api/shop — products for the public shop (online + not hidden), grouped-ready.
shopRouter.get("/", async (_req, res) => {
  const products = await prisma.shopProduct.findMany({
    where: { isHidden: false, availableOnline: true },
    orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
  const categories = await prisma.shopCategory.findMany({ where: { isHidden: false }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  res.json({ products: products.map(outProduct), categories });
});

// GET /api/shop/:id — one product (public).
shopRouter.get("/:id(\\d+)", async (req, res) => {
  const p = await prisma.shopProduct.findUnique({ where: { id: Number(req.params.id) } });
  if (!p || p.isHidden || !p.availableOnline) return res.status(404).json({ error: "Product not found." });
  res.json(outProduct(p));
});

// ---- POS ----

// GET /api/shop/pos — products sellable at the register (staff-authenticated).
shopRouter.get("/pos", requireStaff, async (_req, res) => {
  const products = await prisma.shopProduct.findMany({
    where: { isHidden: false, availablePos: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  res.json(products.map(outProduct));
});

// ---- Admin: categories ----
shopRouter.get("/categories", async (_req, res) => {
  const cats = await prisma.shopCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  res.json(cats);
});
shopRouter.post("/categories", requireAdmin, async (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  if (!name) return res.status(400).json({ error: "A category name is required." });
  const exists = await prisma.shopCategory.findUnique({ where: { name } });
  if (exists) return res.status(409).json({ error: "That category already exists." });
  const count = await prisma.shopCategory.count();
  const cat = await prisma.shopCategory.create({ data: { name, sortOrder: count } });
  res.status(201).json(cat);
});
shopRouter.patch("/categories/:id", requireAdmin, async (req, res) => {
  const data: Record<string, unknown> = {};
  if ("name" in req.body) data.name = String(req.body.name ?? "").trim();
  if ("isHidden" in req.body) data.isHidden = !!req.body.isHidden;
  if ("sortOrder" in req.body) data.sortOrder = Math.round(Number(req.body.sortOrder) || 0);
  const cat = await prisma.shopCategory.update({ where: { id: Number(req.params.id) }, data });
  res.json(cat);
});
shopRouter.delete("/categories/:id", requireAdmin, async (req, res) => {
  await prisma.shopCategory.delete({ where: { id: Number(req.params.id) } }).catch(() => {});
  res.json({ ok: true });
});

// ---- Admin: products ----
shopRouter.get("/admin/all", requireAdmin, async (_req, res) => {
  const products = await prisma.shopProduct.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  res.json(products.map(outProduct));
});

shopRouter.post("/", requireAdmin, async (req, res) => {
  const data = cleanProduct(req.body);
  if (!data.name) return res.status(400).json({ error: "A product name is required." });
  if (data.price === undefined) data.price = 0;
  const count = await prisma.shopProduct.count();
  const created = await prisma.shopProduct.create({ data: { sortOrder: count, ...data } as never });
  // Record opening stock as a movement.
  if (created.quantity !== 0) {
    await prisma.shopStockMovement.create({ data: { productId: created.id, delta: created.quantity, balance: created.quantity, type: "COUNT", reason: "Opening stock", staffName: "Admin" } });
  }
  res.status(201).json(outProduct(created));
});

shopRouter.patch("/:id", requireAdmin, async (req, res) => {
  const data = cleanProduct(req.body);
  delete data.quantity; // quantity only moves through /adjust for a clean audit
  const p = await prisma.shopProduct.update({ where: { id: Number(req.params.id) }, data });
  res.json(outProduct(p));
});

shopRouter.delete("/:id", requireAdmin, async (req, res) => {
  await prisma.shopProduct.delete({ where: { id: Number(req.params.id) } }).catch(() => {});
  res.json({ ok: true });
});

// POST /api/shop/:id/adjust — receive / recount / adjust stock (audited).
shopRouter.post("/:id/adjust", requireAdmin, async (req, res) => {
  const type = String(req.body?.type ?? "").toUpperCase();
  if (!ADJUST_TYPES.includes(type)) return res.status(400).json({ error: "Invalid adjustment type." });
  const p = await prisma.shopProduct.findUnique({ where: { id: Number(req.params.id) } });
  if (!p) return res.status(404).json({ error: "Product not found." });
  const amount = round(Number(req.body?.amount));
  let delta: number;
  if (type === "RECEIVE") delta = Math.max(0, amount);
  else if (type === "COUNT") delta = round(amount - p.quantity);
  else delta = amount; // ADJUST: signed
  const balance = round(Math.max(0, p.quantity + delta));
  const updated = await prisma.shopProduct.update({ where: { id: p.id }, data: { quantity: balance } });
  await prisma.shopStockMovement.create({
    data: { productId: p.id, delta, balance, type, reason: String(req.body?.reason ?? "").trim().slice(0, 200) || null, staffName: "Admin" },
  });
  res.json(outProduct(updated));
});
