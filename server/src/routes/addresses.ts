import { Router } from "express";
import { requireCustomer } from "../auth";
import { prisma } from "../db";

export const addressesRouter = Router();

const LABELS = ["Home", "Work", "Other"];

function cleanAddress(body: Record<string, unknown>) {
  const str = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);
  const label = LABELS.includes(String(body.label)) ? String(body.label) : "Home";
  const numOrNull = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    label,
    fullName: str(body.fullName, 120),
    phone: str(body.phone, 30),
    addressLine: str(body.addressLine),
    building: str(body.building, 120),
    floor: str(body.floor, 60),
    apartment: str(body.apartment, 60),
    area: str(body.area, 120),
    landmark: str(body.landmark),
    instructions: str(body.instructions, 400),
    lat: numOrNull(body.lat),
    lng: numOrNull(body.lng),
  };
}

// GET /api/addresses — the logged-in customer's saved addresses
addressesRouter.get("/", requireCustomer, async (req, res) => {
  const addresses = await prisma.address.findMany({
    where: { customerId: req.customerId! },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  res.json(addresses);
});

// POST /api/addresses — save a new address
addressesRouter.post("/", requireCustomer, async (req, res) => {
  const data = cleanAddress(req.body);
  if (!data.fullName) return res.status(400).json({ error: "Please enter the recipient's full name." });
  if (!data.phone) return res.status(400).json({ error: "Please enter a phone number." });
  if (!data.area) return res.status(400).json({ error: "Please enter the delivery area." });

  const count = await prisma.address.count({ where: { customerId: req.customerId! } });
  const makeDefault = count === 0 || req.body.isDefault === true;
  if (makeDefault) {
    await prisma.address.updateMany({ where: { customerId: req.customerId! }, data: { isDefault: false } });
  }
  const address = await prisma.address.create({
    data: { ...data, customerId: req.customerId!, isDefault: makeDefault },
  });
  res.status(201).json(address);
});

// PATCH /api/addresses/:id — edit a saved address
addressesRouter.patch("/:id", requireCustomer, async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.address.findUnique({ where: { id } });
  if (!existing || existing.customerId !== req.customerId) {
    return res.status(404).json({ error: "Address not found." });
  }
  const data = cleanAddress({ ...existing, ...req.body });
  if (req.body.isDefault === true) {
    await prisma.address.updateMany({ where: { customerId: req.customerId! }, data: { isDefault: false } });
  }
  const address = await prisma.address.update({
    where: { id },
    data: { ...data, ...(req.body.isDefault === true ? { isDefault: true } : {}) },
  });
  res.json(address);
});

// DELETE /api/addresses/:id — remove a saved address
addressesRouter.delete("/:id", requireCustomer, async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.address.findUnique({ where: { id } });
  if (!existing || existing.customerId !== req.customerId) {
    return res.status(404).json({ error: "Address not found." });
  }
  await prisma.address.delete({ where: { id } });
  // If we removed the default, promote the next one so there's always a default.
  if (existing.isDefault) {
    const next = await prisma.address.findFirst({ where: { customerId: req.customerId! }, orderBy: { createdAt: "asc" } });
    if (next) await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
  }
  res.json({ ok: true });
});
