import bcrypt from "bcryptjs";
import { Router } from "express";
import { requireStaff, signToken } from "../auth";
import { prisma } from "../db";
import { genNumber, getOrCreateCustomer, round2 } from "../lib/helpers";
import { consumeForOrder } from "../lib/consumption";
import { validateStock } from "../lib/inventory";
import { awardOrderBeans } from "../lib/loyalty";
import { applyOrderStatus } from "../lib/orderStatus";
import { terminalProvider } from "../lib/paymentTerminal";
import { outOrder } from "../lib/serialize";
import { posConfig, storefrontConfig } from "../lib/settings";
import { buildLines, type IncomingItem } from "./orders";

export const posRouter = Router();

// Which register/device is making the request (multi-terminal). Each terminal
// runs its own independent shift + cash drawer.
const terminalOf = (req: { headers: Record<string, unknown> }) =>
  String(req.headers["x-pos-terminal"] || "").trim().slice(0, 40) || "Register 1";

// The open shift for a given register, or null.
const openShift = (terminal: string) => prisma.shift.findFirst({ where: { status: "OPEN", terminal }, orderBy: { openedAt: "desc" } });

// Enrich a shift with live sale + expected-cash totals.
async function withTotals(shift: NonNullable<Awaited<ReturnType<typeof openShift>>>) {
  const sales = await prisma.order.findMany({
    where: { shiftId: shift.id, channel: "POS" },
    select: { total: true, paymentMethod: true },
  });
  const cashSales = round2(sales.filter((s) => s.paymentMethod === "CASH").reduce((a, s) => a + s.total, 0));
  const cardSales = round2(sales.filter((s) => s.paymentMethod === "CARD").reduce((a, s) => a + s.total, 0));
  const whishSales = round2(sales.filter((s) => s.paymentMethod === "WHISH").reduce((a, s) => a + s.total, 0));
  return {
    ...shift,
    salesCount: sales.length,
    cashSales,
    cardSales,
    whishSales,
    salesTotal: round2(cashSales + cardSales + whishSales),
    // Only cash affects the drawer; card/Whish are electronic.
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
      const shift = await openShift(terminalOf(req));
      return res.json({ token, staff: { id: s.id, name: s.name, role: s.role }, shift: shift ? await withTotals(shift) : null, config: await posConfig() });
    }
  }
  res.status(401).json({ error: "Wrong PIN." });
});

// POST /api/pos/punch (public) — clock in, or clock out if already on the clock.
posRouter.post("/punch", async (req, res) => {
  const pin = String(req.body?.pin ?? "").trim();
  if (!pin) return res.status(400).json({ error: "Enter your PIN." });
  const staff = await prisma.staffUser.findMany({ where: { isActive: true } });
  for (const s of staff) {
    if (await bcrypt.compare(pin, s.pinHash)) {
      const open = await prisma.timeEntry.findFirst({ where: { staffId: s.id, clockOut: null }, orderBy: { clockIn: "desc" } });
      if (open) {
        const closed = await prisma.timeEntry.update({ where: { id: open.id }, data: { clockOut: new Date() } });
        const workedMinutes = Math.round((closed.clockOut!.getTime() - closed.clockIn.getTime()) / 60000);
        return res.json({ staff: { id: s.id, name: s.name }, action: "OUT", clockIn: closed.clockIn, clockOut: closed.clockOut, workedMinutes });
      }
      const entry = await prisma.timeEntry.create({ data: { staffId: s.id, staffName: s.name } });
      return res.json({ staff: { id: s.id, name: s.name }, action: "IN", clockIn: entry.clockIn });
    }
  }
  res.status(401).json({ error: "Wrong PIN." });
});

// Everything below requires a signed-in staff member.
posRouter.use(requireStaff);

// GET /api/pos/staff-list — active staff (for the staff-discount picker).
posRouter.get("/staff-list", async (_req, res) => {
  const staff = await prisma.staffUser.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  res.json(staff);
});

// GET /api/pos/session — who am I + the current open shift (with totals).
posRouter.get("/session", async (req, res) => {
  const shift = await openShift(terminalOf(req));
  res.json({
    staff: { id: req.staffId, name: req.staffName, role: req.staffRole },
    shift: shift ? await withTotals(shift) : null,
    config: await posConfig(),
    terminal: terminalOf(req),
  });
});

// POST /api/pos/shift/open  { openingFloat }
posRouter.post("/shift/open", async (req, res) => {
  const terminal = terminalOf(req);
  if (await openShift(terminal)) return res.status(409).json({ error: `A shift is already open on ${terminal}.` });
  const openingFloat = round2(Math.max(0, Number(req.body?.openingFloat) || 0));
  const shift = await prisma.shift.create({
    data: { staffId: req.staffId!, staffName: req.staffName ?? "Staff", terminal, openingFloat, status: "OPEN" },
  });
  res.status(201).json(await withTotals(shift));
});

// POST /api/pos/shift/close  { countedCash, note? }
posRouter.post("/shift/close", async (req, res) => {
  const shift = await openShift(terminalOf(req));
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
  const shift = await openShift(terminalOf(req));
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
  res.json(await withTotals((await openShift(terminalOf(req)))!));
});

// POST /api/pos/sale — record a completed in-store sale (needs an open shift).
posRouter.post("/sale", async (req, res) => {
  const terminal = terminalOf(req);
  const shift = await openShift(terminal);
  if (!shift) return res.status(400).json({ error: "Open a shift before selling." });

  const body = req.body as { items: IncomingItem[]; paymentMethod?: string; discount?: number; customerPhone?: string; customerName?: string; orderType?: string; tableNumber?: string; clientRef?: string; cardApprovalCode?: string; cardLast4?: string; cardBrand?: string; staffDiscountId?: number };
  if (!body.items?.length) return res.status(400).json({ error: "No items in the sale." });

  const rawMethod = String(body.paymentMethod ?? "CASH").toUpperCase();
  // SALARY = "charge to staff tab" — the sale is added to the staff member's tab
  // and deducted from their salary later; it is NOT paid at the counter.
  const method = rawMethod === "CARD" ? "CARD" : rawMethod === "WHISH" ? "WHISH" : rawMethod === "SALARY" ? "SALARY" : "CASH";
  const pos = await posConfig();
  if (method === "CARD") {
    if (!pos.card.enabled) return res.status(400).json({ error: "Card payments aren't enabled at the register." });
    if (pos.card.requireApprovalCode && !String(body.cardApprovalCode ?? "").trim())
      return res.status(400).json({ error: "Enter the terminal's approval code." });
  }

  // Idempotency: a sale queued offline then re-synced carries a clientRef — if we
  // already recorded it, return the existing order instead of charging twice.
  const clientRef = String(body.clientRef ?? "").trim() || null;
  if (clientRef) {
    const existing = await prisma.order.findUnique({ where: { clientRef }, include: { items: true } });
    if (existing) return res.status(200).json(outOrder(existing));
  }
  const orderType = String(body.orderType ?? "TAKEAWAY").toUpperCase() === "DINE_IN" ? "DINE_IN" : "TAKEAWAY";
  const tableNumber = orderType === "DINE_IN" ? String(body.tableNumber ?? "").trim().slice(0, 20) || null : null;

  // Block overselling any stock-tracked item before we take payment.
  const stockError = await validateStock(body.items.map((i) => ({ menuItemId: i.menuItemId, quantity: Number(i.quantity) || 1 })));
  if (stockError) return res.status(409).json({ error: stockError });

  const result = await buildLines(body.items);
  if ("error" in result) return res.status(400).json({ error: result.error });
  const { built, addonsTotal } = result;

  const subtotal = round2(built.reduce((s, l) => s + l.lineTotal, 0));
  // Staff discount: applies the global % for the chosen staff member and tags the
  // sale as their purchase; otherwise the cashier's manual discount is used.
  let staffPurchaseId: number | null = null;
  let staffPurchaseName: string | null = null;
  const staffDiscId = Number(body.staffDiscountId) || 0;
  if (staffDiscId && pos.staffDiscount > 0) {
    const sp = await prisma.staffUser.findUnique({ where: { id: staffDiscId } });
    if (sp) { staffPurchaseId = sp.id; staffPurchaseName = sp.name; }
  }
  // "Charge to salary" is only valid on a staff purchase — it goes on that
  // staff member's tab and is deducted from their salary later.
  const isTab = method === "SALARY";
  if (isTab && !staffPurchaseId) return res.status(400).json({ error: "Charge to salary needs a staff member selected." });
  const discount = staffPurchaseId
    ? round2(Math.min(subtotal, (subtotal * pos.staffDiscount) / 100))
    : round2(Math.min(Math.max(0, Number(body.discount) || 0), subtotal));
  const config = await storefrontConfig();
  const taxable = Math.max(0, round2(subtotal - discount));
  const tax = round2(taxable * (config.tax.rate / 100));
  const total = round2(taxable + tax);

  // Card sales go through the configured terminal provider (standalone bank
  // machine today) which normalises the approval code / card reference.
  const card = method === "CARD" ? await (await terminalProvider()).capture(total, { approvalCode: body.cardApprovalCode, last4: body.cardLast4, brand: body.cardBrand }) : null;

  let customer = null;
  const phone = String(body.customerPhone ?? "").trim();
  if (phone) customer = await getOrCreateCustomer(phone, String(body.customerName ?? "").trim() || "Guest");
  const beansEarned = customer ? Math.floor(Math.max(0, subtotal - discount)) : 0;

  const order = await prisma.order.create({
    data: {
      number: genNumber("POS"),
      channel: "POS",
      shiftId: shift.id,
      terminal,
      staffId: req.staffId,
      staffName: req.staffName ?? "Staff",
      staffPurchaseId,
      staffPurchaseName,
      customerId: customer?.id,
      customerName: String(body.customerName ?? "").trim() || "Walk-in",
      phone: phone || "-",
      fulfillment: "PICKUP",
      orderType,
      tableNumber,
      clientRef,
      subtotal,
      addonsTotal,
      discount,
      tax,
      total,
      paymentMethod: method,
      // Paid at the counter, but still a live ticket the kitchen must make.
      // A staff-tab sale is UNPAID (owed against salary) until the owner settles it.
      status: "RECEIVED",
      paymentStatus: isTab ? "UNPAID" : "PAID",
      paidAt: isTab ? null : new Date(),
      beansEarned,
      items: { create: built },
    },
    include: { items: true },
  });

  await prisma.payment.create({
    data: {
      orderId: order.id,
      provider: isTab ? "pos-staff-tab" : card ? `pos-${card.provider}` : method === "WHISH" ? "pos-whish" : "pos",
      transactionId: card?.transactionRef || `${genNumber("POSPAY")}-${order.id}`,
      method,
      amount: total,
      status: isTab ? "UNPAID" : "PAID",
      cardBrand: card?.brand ?? null,
      cardLast4: card?.last4 ?? null,
      approvalCode: card?.approvalCode ?? null,
      customerId: customer?.id ?? null,
    },
  });
  if (customer) await awardOrderBeans(order.id);
  await consumeForOrder(body.items, { orderId: order.id, staffName: req.staffName ?? "Staff" });

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
    whish: sum(sales.filter((o) => o.paymentMethod === "WHISH")),
    sales: sales.map(outOrder),
  });
});

// ---- Online orders (website/app) in the register -----------------------------
// Live customer orders staff work from the POS. NEW = just arrived (RECEIVED).
const ONLINE_ACTIVE = ["RECEIVED", "ACCEPTED", "PREPARING", "READY_FOR_PICKUP", "READY_FOR_DELIVERY", "OUT_FOR_DELIVERY"];

// GET /api/pos/online — active website/app orders (oldest first = work queue).
posRouter.get("/online", async (_req, res) => {
  const orders = await prisma.order.findMany({
    where: { channel: "ONLINE", status: { in: ONLINE_ACTIVE } },
    include: { items: true, payments: { orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "asc" },
  });
  res.json({ newCount: orders.filter((o) => o.status === "RECEIVED").length, orders: orders.map(outOrder) });
});

// PATCH /api/pos/online/:id/status — advance a website order (accept → preparing →
// ready → complete, or cancel). Shares the exact same engine as the admin screen.
posRouter.patch("/online/:id/status", async (req, res) => {
  const result = await applyOrderStatus(Number(req.params.id), String(req.body?.status), { reason: req.body?.reason, actor: req.staffName ?? "Register" });
  if (!result.ok) return res.status(result.code).json({ error: result.error });
  res.json(result.order);
});

// ---- Kitchen Display (KDS) ----------------------------------------------------
// Everything the kitchen still has to make — POS, online pickup AND delivery.
const KITCHEN_ACTIVE = ["RECEIVED", "ACCEPTED", "PREPARING", "READY_FOR_PICKUP", "READY_FOR_DELIVERY"];

// GET /api/pos/kds — live tickets the kitchen must make (POS + online pickup + delivery).
posRouter.get("/kds", async (_req, res) => {
  const orders = await prisma.order.findMany({
    where: { status: { in: KITCHEN_ACTIVE } },
    include: { items: true },
    orderBy: { createdAt: "asc" },
  });
  res.json(orders.map(outOrder));
});

// PATCH /api/pos/kds/:id/status  { status } — advance a kitchen ticket. Goes
// through the shared engine, so online customers get notified + loyalty applies.
const KITCHEN_TRANSITIONS = ["PREPARING", "READY_FOR_PICKUP", "READY_FOR_DELIVERY", "OUT_FOR_DELIVERY", "COMPLETED"];
posRouter.patch("/kds/:id/status", async (req, res) => {
  const status = String(req.body?.status ?? "");
  if (!KITCHEN_TRANSITIONS.includes(status)) return res.status(400).json({ error: "Invalid status." });
  const result = await applyOrderStatus(Number(req.params.id), status, { actor: req.staffName ?? "Kitchen" });
  if (!result.ok) return res.status(result.code).json({ error: result.error });
  res.json(result.order);
});
