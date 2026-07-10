import { Router } from "express";
import { requireAdmin } from "../auth";
import { prisma } from "../db";
import { genNumber, getOrCreateCustomer, round2 } from "../lib/helpers";
import { awardOrderBeans } from "../lib/loyalty";
import { outOrder } from "../lib/serialize";
import { storefrontConfig } from "../lib/settings";
import { buildLines, type IncomingItem } from "./orders";

export const posRouter = Router();

// POST /api/pos/sale  (staff/admin) — record a completed in-store counter sale.
// Prices are resolved server-side from the live menu (client prices are ignored).
posRouter.post("/sale", requireAdmin, async (req, res) => {
  const body = req.body as {
    items: IncomingItem[];
    paymentMethod?: string; // CASH | CARD
    discount?: number; // manual $ off
    customerPhone?: string; // optional — attach the sale to earn beans
    customerName?: string;
  };
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

  // Optional: attach a customer by phone so the sale earns beans.
  let customer = null;
  const phone = String(body.customerPhone ?? "").trim();
  if (phone) customer = await getOrCreateCustomer(phone, String(body.customerName ?? "").trim() || "Guest");
  const beansEarned = customer ? Math.floor(Math.max(0, subtotal - discount)) : 0;

  const order = await prisma.order.create({
    data: {
      number: genNumber("POS"),
      channel: "POS",
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
    data: {
      orderId: order.id,
      provider: "pos",
      transactionId: `${genNumber("POSPAY")}-${order.id}`,
      method,
      amount: total,
      status: "PAID",
      customerId: customer?.id ?? null,
    },
  });

  if (customer) await awardOrderBeans(order.id);

  res.status(201).json(outOrder(order));
});

// GET /api/pos/summary?date=YYYY-MM-DD  (staff/admin) — a day's in-store totals + sales.
posRouter.get("/summary", requireAdmin, async (req, res) => {
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
