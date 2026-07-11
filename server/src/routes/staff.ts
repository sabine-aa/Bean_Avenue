import bcrypt from "bcryptjs";
import { Router } from "express";
import { requireAdmin } from "../auth";
import { prisma } from "../db";
import { round2 } from "../lib/helpers";

export const staffRouter = Router();
staffRouter.use(requireAdmin);

const publicStaff = (s: { id: number; name: string; role: string; isActive: boolean }) => ({
  id: s.id,
  name: s.name,
  role: s.role,
  isActive: s.isActive,
});

// GET /api/staff — list staff (never expose PIN hashes).
staffRouter.get("/", async (_req, res) => {
  const staff = await prisma.staffUser.findMany({ orderBy: { id: "asc" } });
  res.json(staff.map(publicStaff));
});

// GET /api/staff/shifts — recent shift Z-reports with sale totals.
staffRouter.get("/shifts", async (_req, res) => {
  const shifts = await prisma.shift.findMany({ orderBy: { openedAt: "desc" }, take: 60, include: { movements: true } });
  const out = [];
  for (const sh of shifts) {
    const sales = await prisma.order.findMany({ where: { shiftId: sh.id, channel: "POS" }, select: { total: true, paymentMethod: true } });
    out.push({
      ...sh,
      salesCount: sales.length,
      cashSales: round2(sales.filter((s) => s.paymentMethod === "CASH").reduce((a, s) => a + s.total, 0)),
      cardSales: round2(sales.filter((s) => s.paymentMethod === "CARD").reduce((a, s) => a + s.total, 0)),
    });
  }
  res.json(out);
});

// GET /api/staff/timesheets?from=&to= — attendance entries + per-staff totals.
staffRouter.get("/timesheets", async (req, res) => {
  const q = req.query as Record<string, string>;
  const from = q.from ? new Date(q.from) : new Date(Date.now() - 14 * 86400000);
  const to = q.to ? new Date(q.to) : new Date();
  to.setHours(23, 59, 59, 999);
  const rows = await prisma.timeEntry.findMany({ where: { clockIn: { gte: from, lte: to } }, orderBy: { clockIn: "desc" } });
  const entries = rows.map((e) => {
    const end = e.clockOut ? e.clockOut.getTime() : Date.now();
    return { id: e.id, staffId: e.staffId, staffName: e.staffName, clockIn: e.clockIn, clockOut: e.clockOut, minutes: Math.max(0, Math.round((end - e.clockIn.getTime()) / 60000)), open: !e.clockOut };
  });
  const byStaff = new Map<number, { staffId: number; staffName: string; minutes: number; shifts: number; open: boolean }>();
  for (const e of entries) {
    const cur = byStaff.get(e.staffId) ?? { staffId: e.staffId, staffName: e.staffName, minutes: 0, shifts: 0, open: false };
    cur.minutes += e.minutes;
    cur.shifts += 1;
    if (e.open) cur.open = true;
    byStaff.set(e.staffId, cur);
  }
  res.json({ entries, summary: [...byStaff.values()].sort((a, b) => b.minutes - a.minutes) });
});

// DELETE /api/staff/timesheets/:id — remove a mistaken punch.
staffRouter.delete("/timesheets/:id", async (req, res) => {
  await prisma.timeEntry.delete({ where: { id: Number(req.params.id) } }).catch(() => {});
  res.json({ ok: true });
});

// POST /api/staff  { name, pin, role }
staffRouter.post("/", async (req, res) => {
  const name = String(req.body?.name ?? "").trim().slice(0, 60);
  const pin = String(req.body?.pin ?? "").trim();
  const role = String(req.body?.role ?? "CASHIER").toUpperCase() === "MANAGER" ? "MANAGER" : "CASHIER";
  if (!name) return res.status(400).json({ error: "Name is required." });
  if (!/^\d{4,6}$/.test(pin)) return res.status(400).json({ error: "PIN must be 4–6 digits." });
  const staff = await prisma.staffUser.create({ data: { name, pinHash: await bcrypt.hash(pin, 8), role } });
  res.status(201).json(publicStaff(staff));
});

// PATCH /api/staff/:id  { name?, pin?, role?, isActive? }
staffRouter.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const data: Record<string, unknown> = {};
  if (req.body.name !== undefined) data.name = String(req.body.name).trim().slice(0, 60);
  if (req.body.role !== undefined) data.role = String(req.body.role).toUpperCase() === "MANAGER" ? "MANAGER" : "CASHIER";
  if (req.body.isActive !== undefined) data.isActive = !!req.body.isActive;
  if (req.body.pin !== undefined) {
    const pin = String(req.body.pin).trim();
    if (!/^\d{4,6}$/.test(pin)) return res.status(400).json({ error: "PIN must be 4–6 digits." });
    data.pinHash = await bcrypt.hash(pin, 8);
  }
  const staff = await prisma.staffUser.update({ where: { id }, data });
  res.json(publicStaff(staff));
});

// DELETE /api/staff/:id
staffRouter.delete("/:id", async (req, res) => {
  await prisma.staffUser.delete({ where: { id: Number(req.params.id) } }).catch(() => {});
  res.json({ ok: true });
});
