import bcrypt from "bcryptjs";
import { Router } from "express";
import { requireAdmin } from "../auth";
import { prisma } from "../db";
import { actorCtx, audit } from "../lib/activity";
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
    return {
      id: e.id,
      staffId: e.staffId,
      staffName: e.staffName,
      clockIn: e.clockIn,
      clockOut: e.clockOut,
      minutes: Math.max(0, Math.round((end - e.clockIn.getTime()) / 60000)),
      open: !e.clockOut,
    };
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

// GET /api/staff/tabs — outstanding "charge to salary" purchases, one row per
// staff member. These are POS sales paid with SALARY that haven't been settled
// (deducted from salary) yet — a running tab the owner clears at payday.
staffRouter.get("/tabs", async (_req, res) => {
  const orders = await prisma.order.findMany({
    where: { paymentMethod: "SALARY", staffPurchaseId: { not: null }, staffTabSettledAt: null },
    select: {
      id: true,
      number: true,
      total: true,
      createdAt: true,
      staffPurchaseId: true,
      staffPurchaseName: true,
      items: { select: { name: true, quantity: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  type TabOrder = { id: number; number: string; total: number; createdAt: Date; items: { name: string; quantity: number }[] };
  const byStaff = new Map<number, { staffId: number; staffName: string; total: number; count: number; orders: TabOrder[] }>();
  for (const o of orders) {
    const id = o.staffPurchaseId as number;
    const cur = byStaff.get(id) ?? { staffId: id, staffName: o.staffPurchaseName ?? "Staff", total: 0, count: 0, orders: [] };
    cur.total = round2(cur.total + o.total);
    cur.count += 1;
    cur.orders.push({ id: o.id, number: o.number, total: o.total, createdAt: o.createdAt, items: o.items });
    byStaff.set(id, cur);
  }
  res.json([...byStaff.values()].sort((a, b) => b.total - a.total));
});

// POST /api/staff/:id/settle-tab — clear a staff member's outstanding tab (mark
// the purchases as deducted from salary). Returns how much was settled.
staffRouter.post("/:id/settle-tab", async (req, res) => {
  const staffId = Number(req.params.id);
  const outstanding = await prisma.order.findMany({
    where: { paymentMethod: "SALARY", staffPurchaseId: staffId, staffTabSettledAt: null },
    select: { id: true, total: true },
  });
  const amount = round2(outstanding.reduce((a, o) => a + o.total, 0));
  const ids = outstanding.map((o) => o.id);
  if (ids.length) {
    const now = new Date();
    await prisma.order.updateMany({ where: { id: { in: ids } }, data: { staffTabSettledAt: now, paymentStatus: "PAID", paidAt: now } });
    await prisma.payment.updateMany({ where: { orderId: { in: ids } }, data: { status: "PAID" } });
  }
  res.json({ ok: true, settled: ids.length, amount });
});

// POST /api/staff  { name, pin, role }
staffRouter.post("/", async (req, res) => {
  const name = String(req.body?.name ?? "")
    .trim()
    .slice(0, 60);
  const pin = String(req.body?.pin ?? "").trim();
  const role = String(req.body?.role ?? "CASHIER").toUpperCase() === "MANAGER" ? "MANAGER" : "CASHIER";
  if (!name) return res.status(400).json({ error: "Name is required." });
  if (!/^\d{4,6}$/.test(pin)) return res.status(400).json({ error: "PIN must be 4–6 digits." });
  const staff = await prisma.staffUser.create({ data: { name, pinHash: await bcrypt.hash(pin, 8), role } });
  await audit(actorCtx(req), {
    section: "Staff",
    action: "staff_created",
    description: `Created staff ${staff.name} (${role})`,
    entity: "Staff",
    entityId: staff.id,
    entityName: staff.name,
    newValue: { role },
  });
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
  const before = await prisma.staffUser.findUnique({ where: { id } });
  const staff = await prisma.staffUser.update({ where: { id }, data });
  const actor = actorCtx(req);
  if (before && "role" in data && before.role !== staff.role) {
    await audit(actor, {
      section: "Staff",
      action: "role_changed",
      description: `${staff.name} role ${before.role} → ${staff.role}`,
      entity: "Staff",
      entityId: id,
      entityName: staff.name,
      oldValue: { role: before.role },
      newValue: { role: staff.role },
    });
  }
  if ("pinHash" in data) {
    await audit(actor, {
      section: "Staff",
      action: "pin_changed",
      description: `PIN changed for ${staff.name}`,
      entity: "Staff",
      entityId: id,
      entityName: staff.name,
    });
  }
  if (before && "isActive" in data && before.isActive !== staff.isActive) {
    await audit(actor, {
      section: "Staff",
      action: staff.isActive ? "staff_enabled" : "staff_disabled",
      description: `${staff.name} ${staff.isActive ? "enabled" : "disabled"}`,
      entity: "Staff",
      entityId: id,
      entityName: staff.name,
    });
  }
  res.json(publicStaff(staff));
});

// DELETE /api/staff/:id
staffRouter.delete("/:id", async (req, res) => {
  await prisma.staffUser.delete({ where: { id: Number(req.params.id) } }).catch(() => {});
  res.json({ ok: true });
});
