import { Router } from "express";
import { requireAdmin } from "../auth";
import { prisma } from "../db";

export const suppliersRouter = Router();
suppliersRouter.use(requireAdmin);

function cleanSupplier(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  if ("name" in body) data.name = String(body.name ?? "").trim();
  if ("contactPerson" in body) data.contactPerson = String(body.contactPerson ?? "").trim() || null;
  if ("phone" in body) data.phone = String(body.phone ?? "").trim() || null;
  if ("whatsapp" in body) data.whatsapp = String(body.whatsapp ?? "").trim() || null;
  if ("email" in body) data.email = String(body.email ?? "").trim() || null;
  if ("address" in body) data.address = String(body.address ?? "").trim() || null;
  if ("notes" in body) data.notes = String(body.notes ?? "").trim() || null;
  if ("isActive" in body) data.isActive = !!body.isActive;
  return data;
}

// GET /api/suppliers?all=1 — list suppliers (active only unless all=1).
suppliersRouter.get("/", async (req, res) => {
  const all = (req.query as Record<string, string>).all === "1";
  const suppliers = await prisma.supplier.findMany({
    where: all ? {} : { isActive: true },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  res.json(suppliers);
});

// POST /api/suppliers — create a supplier.
suppliersRouter.post("/", async (req, res) => {
  const data = cleanSupplier(req.body);
  if (!data.name) return res.status(400).json({ error: "A supplier name is required." });
  const supplier = await prisma.supplier.create({ data: { isActive: true, ...data } as never });
  res.status(201).json(supplier);
});

// PATCH /api/suppliers/:id — edit a supplier.
suppliersRouter.patch("/:id", async (req, res) => {
  const data = cleanSupplier(req.body);
  if ("name" in data && !data.name) return res.status(400).json({ error: "A supplier name is required." });
  const supplier = await prisma.supplier.update({ where: { id: Number(req.params.id) }, data });
  res.json(supplier);
});

// DELETE /api/suppliers/:id — soft-delete (keeps restock history intact).
suppliersRouter.delete("/:id", async (req, res) => {
  await prisma.supplier.update({ where: { id: Number(req.params.id) }, data: { isActive: false } });
  res.json({ ok: true });
});
