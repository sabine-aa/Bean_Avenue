import bcrypt from "bcryptjs";
import { Router } from "express";
import { requireStaff, signToken } from "../auth";
import { prisma } from "../db";
import { genNumber, getOrCreateCustomer, round2 } from "../lib/helpers";
import { recordStockSale, validateStock } from "../lib/inventory";
import { awardOrderBeans } from "../lib/loyalty";
import { notify } from "../lib/notify";
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
      const shift = await openShift(terminalOf(req));
      return res.json({ token, staff: { id: s.id, name: s.name, role: s.role }, shift: shift ? await withTotals(shift) : null, config: await posConfig() });
    }
  }
  res.status(401).json({ error: "Wrong PIN." });
});

// Everything below requires a signed-in staff member.
posRouter.use(requireStaff);

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

  const body = req.body as { items: IncomingItem[]; paymentMethod?: string; discount?: number; customerPhone?: string; customerName?: string; orderType?: string; tableNumber?: string; clientRef?: string; cardApprovalCode?: string; cardLast4?: string; cardBrand?: string };
  if (!body.items?.length) return res.status(400).json({ error: "No items in the sale." });

  const method = String(body.paymentMethod ?? "CASH").toUpperCase() === "CARD" ? "CARD" : "CASH";
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
  const discount = round2(Math.min(Math.max(0, Number(body.discount) || 0), subtotal));
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
      status: "RECEIVED",
      paymentStatus: "PAID",
      paidAt: new Date(),
      beansEarned,
      items: { create: built },
    },
    include: { items: true },
  });

  await prisma.payment.create({
    data: {
      orderId: order.id,
      provider: card ? `pos-${card.provider}` : "pos",
      transactionId: card?.transactionRef || `${genNumber("POSPAY")}-${order.id}`,
      method,
      amount: total,
      status: "PAID",
      cardBrand: card?.brand ?? null,
      cardLast4: card?.last4 ?? null,
      approvalCode: card?.approvalCode ?? null,
      customerId: customer?.id ?? null,
    },
  });
  if (customer) await awardOrderBeans(order.id);
  await recordStockSale(body.items.map((i) => ({ menuItemId: i.menuItemId, quantity: Number(i.quantity) || 1 })), { orderId: order.id, staffName: req.staffName ?? "Staff" });

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

// ---- Kitchen Display (KDS) ----------------------------------------------------
const KITCHEN_ACTIVE = ["RECEIVED", "ACCEPTED", "PREPARING", "READY_FOR_PICKUP"];

// GET /api/pos/kds — live tickets the kitchen must make (POS + pickup online).
posRouter.get("/kds", async (_req, res) => {
  const orders = await prisma.order.findMany({
    where: { status: { in: KITCHEN_ACTIVE }, fulfillment: { not: "DELIVERY" } },
    include: { items: true },
    orderBy: { createdAt: "asc" },
  });
  res.json(orders.map(outOrder));
});

// PATCH /api/pos/kds/:id/status  { status } — advance a ticket through the kitchen.
posRouter.patch("/kds/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status ?? "");
  if (!["RECEIVED", "PREPARING", "READY_FOR_PICKUP", "COMPLETED"].includes(status)) {
    return res.status(400).json({ error: "Invalid status." });
  }
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return res.status(404).json({ error: "Ticket not found." });
  const updated = await prisma.order.update({ where: { id }, data: { status }, include: { items: true } });

  if (status === "COMPLETED") await awardOrderBeans(id); // idempotent — mainly for online orders
  // Keep the online customer informed as their order advances.
  if (updated.customerId && updated.channel === "ONLINE") {
    if (status === "READY_FOR_PICKUP")
      await notify(updated.customerId, { type: "ORDER", title: "Ready for pickup", message: `Order ${updated.number} is ready for pickup.`, link: `/order-success/${updated.number}` });
    if (status === "COMPLETED")
      await notify(updated.customerId, { type: "ORDER", title: "Order completed", message: `Order ${updated.number} is complete. Enjoy! ☕`, link: `/order-success/${updated.number}` });
  }
  res.json(outOrder(updated));
});
