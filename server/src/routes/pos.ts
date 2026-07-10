import bcrypt from "bcryptjs";
import { Router } from "express";
import { requireStaff, signToken } from "../auth";
import { prisma } from "../db";
import { genNumber, getOrCreateCustomer, round2 } from "../lib/helpers";
import { awardOrderBeans } from "../lib/loyalty";
import { outOrder } from "../lib/serialize";
import { storefrontConfig } from "../lib/settings";
import { buildLines, type IncomingItem } from "./orders";

export const posRouter = Router();

// Current (one) open register shift, or null.
const openShift = () => prisma.shift.findFirst({ where: { status: "OPEN" }, orderBy: { openedAt: "desc" } });

// Enrich a shift with live sale + expected-cash totals.
async function withTotals(shift: NonNullable<Awaited<ReturnType<typeof openShift>>>) {
  const sales = await prisma.order.findMany({
    where: { shiftId: shift.id, channel: "POS" },
    select: { total: true, paymentMethod: true },
  });
  const cashSales = round2(sales.filter((s) => s.paymentMethod === "CASH").reduce((a, s) => a + s.total, 0));
  const cardSales = round2(sales.filter((s) => s.paymentMethod === "CARD").reduce((a, s) => a + s.total, 0));
  return {
    ...shift,
    salesCount: sales.length,
    cashSales,
    cardSales,
    salesTotal: round2(cashSales + cardSales),
    expectedCash: round2(shift.openingFloat + cashSales + shift.cashPayIns - shift.cashPayOuts),
  };
}

// ---- POS PIN login (public) --------------------------------------------------
posRouter.post("/login", async (req, res) => {
  const pin = String(req.body?.pin ?? "").trim();
  if (!pin) return res.status(400).json({ error: "Enter your PIN." });
  const staff = await prisma.staffUser.findMany({ where: { isActive: true } });
  for (const s of staff) {
    if (await bcrypt.compare(pin, s.pinHash)) {
      const token = signToken({ staffId: s.id, name: s.name, staffRole: s.role, role: "staff" });
      const shift = await openShift();
      return res.json({ token, staff: { id: s.id, name: s.name, role: s.role }, shift: shift ? await withTotals(shift) : null });
    }
  }
  res.status(401).json({ error: "Wrong PIN." });
});

// Everything below requires a signed-in staff member.
posRouter.use(requireStaff);

// GET /api/pos/session — who am I + the current open shift (with totals).
posRouter.get("/session", async (req, res) => {
  const shift = await openShift();
  res.json({
    staff: { id: req.staffId, name: req.staffName, role: req.staffRole },
    shift: shift ? await withTotals(shift) : null,
  });
});

// POST /api/pos/shift/open  { openingFloat }
posRouter.post("/shift/open", async (req, res) => {
  if (await openShift()) return res.status(409).json({ error: "A shift is already open." });
  const openingFloat = round2(Math.max(0, Number(req.body?.openingFloat) || 0));
  const shift = await prisma.shift.create({
    data: { staffId: req.staffId!, staffName: req.staffName ?? "Staff", openingFloat, status: "OPEN" },
  });
  res.status(201).json(await withTotals(shift));
});

// POST /api/pos/shift/close  { countedCash, note? }
posRouter.post("/shift/close", async (req, res) => {
  const shift = await openShift();
  if (!shift) return res.status(400).json({ error: "No open shift." });
  const t = await withTotals(shift);
  const countedCash = round2(Math.max(0, Number(req.body?.countedCash) || 0));
  const difference = round2(countedCash - t.expectedCash);
  const closed = await prisma.shift.update({
    where: { id: shift.id },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
      countedCash,
      expectedCash: t.expectedCash,
      difference,
      note: String(req.body?.note ?? "").trim().slice(0, 300) || null,
    },
  });
  res.json({ ...(await withTotals(closed)), difference });
});

// POST /api/pos/cash  { type: PAYIN|PAYOUT, amount, reason }
posRouter.post("/cash", async (req, res) => {
  const shift = await openShift();
  if (!shift) return res.status(400).json({ error: "Open a shift first." });
  const type = String(req.body?.type ?? "").toUpperCase() === "PAYOUT" ? "PAYOUT" : "PAYIN";
  const amount = round2(Math.max(0, Number(req.body?.amount) || 0));
  if (amount <= 0) return res.status(400).json({ error: "Enter an amount." });
  const reason = String(req.body?.reason ?? "").trim().slice(0, 200);
  await prisma.cashMovement.create({ data: { shiftId: shift.id, type, amount, reason, staffName: req.staffName ?? "Staff" } });
  await prisma.shift.update({
    where: { id: shift.id },
    data: type === "PAYIN" ? { cashPayIns: { increment: amount } } : { cashPayOuts: { increment: amount } },
  });
  res.json(await withTotals((await openShift())!));
});

// POST /api/pos/sale — record a completed in-store sale (needs an open shift).
posRouter.post("/sale", async (req, res) => {
  const shift = await openShift();
  if (!shift) return res.status(400).json({ error: "Open a shift before selling." });

  const body = req.body as { items: IncomingItem[]; paymentMethod?: string; discount?: number; customerPhone?: string; customerName?: string };
  if (!body.items?.length) return res.status(400).json({ error: "No items in the sale." });

  const result = await buildLines(body.items);
  if ("error" in result) return res.status(400).json({ error: result.error });
  const { built, addonsTotal } = result;

  const subtotal = round2(built.reduce((s, l) => s + l.lineTotal, 0));
  const discount = round2(Math.min(Math.max(0, Number(body.discount) || 0), subtotal));
  const config = await storefrontConfig();
  const taxable = Math.max(0, round2(subtotal - discount));
  const tax = round2(taxable * (config.tax.rate / 100));
  const total = round2(taxable + tax);
  const method = String(body.paymentMethod ?? "CASH").toUpperCase() === "CARD" ? "CARD" : "CASH";

  let customer = null;
  const phone = String(body.customerPhone ?? "").trim();
  if (phone) customer = await getOrCreateCustomer(phone, String(body.customerName ?? "").trim() || "Guest");
  const beansEarned = customer ? Math.floor(Math.max(0, subtotal - discount)) : 0;

  const order = await prisma.order.create({
    data: {
      number: genNumber("POS"),
      channel: "POS",
      shiftId: shift.id,
      staffId: req.staffId,
      staffName: req.staffName ?? "Staff",
      customerId: customer?.id,
      customerName: String(body.customerName ?? "").trim() || "Walk-in",
      phone: phone || "-",
      fulfillment: "PICKUP",
      subtotal,
      addonsTotal,
      discount,
      tax,
      total,
      paymentMethod: method,
      status: "COMPLETED",
      paymentStatus: "PAID",
      paidAt: new Date(),
      beansEarned,
      items: { create: built },
    },
    include: { items: true },
  });

  await prisma.payment.create({
    data: { orderId: order.id, provider: "pos", transactionId: `${genNumber("POSPAY")}-${order.id}`, method, amount: total, status: "PAID", customerId: customer?.id ?? null },
  });
  if (customer) await awardOrderBeans(order.id);

  res.status(201).json(outOrder(order));
});

// GET /api/pos/summary?date=YYYY-MM-DD — a day's in-store totals + sales.
posRouter.get("/summary", async (req, res) => {
  const date = String((req.query as Record<string, string>).date || "").trim();
  const start = date ? new Date(`${date}T00:00:00`) : new Date(new Date().setHours(0, 0, 0, 0));
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  const sales = await prisma.order.findMany({
    where: { channel: "POS", createdAt: { gte: start, lt: end } },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
  const sum = (arr: typeof sales) => round2(arr.reduce((s, o) => s + o.total, 0));
  res.json({
    count: sales.length,
    total: sum(sales),
    cash: sum(sales.filter((o) => o.paymentMethod === "CASH")),
    card: sum(sales.filter((o) => o.paymentMethod === "CARD")),
    sales: sales.map(outOrder),
  });
});
