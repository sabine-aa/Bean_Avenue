import { Router } from "express";
import { requireAdmin } from "../auth";
import { prisma } from "../db";
import { earnBeans, genNumber, getOrCreateCustomer, promoDiscount, round2 } from "../lib/helpers";
import { outOrder, parseArr, toJson } from "../lib/serialize";

export const ordersRouter = Router();

interface IncomingItem {
  menuItemId: number;
  quantity: number;
  selectedOptions: { group: string; choice: string }[];
}

interface OptionChoice { label: string; priceDelta: number }
interface OptionGroup { name: string; choices: OptionChoice[] }

// POST /api/orders  (public) — place an order
ordersRouter.post("/", async (req, res) => {
  const { customerName, phone, email, pickupTime, promoCode, items } = req.body as {
    customerName: string;
    phone: string;
    email?: string;
    pickupTime?: string;
    promoCode?: string;
    items: IncomingItem[];
  };

  if (!items?.length) return res.status(400).json({ error: "Your cart is empty." });

  // Resolve each line against the live menu (never trust client prices).
  const built = [];
  for (const line of items) {
    const menuItem = await prisma.menuItem.findUnique({ where: { id: Number(line.menuItemId) } });
    if (!menuItem) return res.status(400).json({ error: "An item in your cart is no longer available." });

    const groups = parseArr(menuItem.options) as OptionGroup[];
    const selected = (line.selectedOptions ?? []).map((sel) => {
      const group = groups.find((g) => g.name === sel.group);
      const choice = group?.choices.find((c) => c.label === sel.choice);
      return { group: sel.group, choice: sel.choice, priceDelta: choice?.priceDelta ?? 0 };
    });

    const unitPrice = round2(menuItem.price + selected.reduce((s, o) => s + o.priceDelta, 0));
    const quantity = Number(line.quantity) || 1;
    built.push({
      menuItemId: menuItem.id,
      name: menuItem.name,
      unitPrice,
      quantity,
      selectedOptions: toJson(selected),
      lineTotal: round2(unitPrice * quantity),
    });
  }

  const subtotal = round2(built.reduce((s, l) => s + l.lineTotal, 0));
  const discount = promoDiscount(promoCode, subtotal);
  const total = round2(subtotal - discount);
  const beansEarned = Math.floor(total);
  const customer = phone ? await getOrCreateCustomer(phone, customerName) : null;

  const order = await prisma.order.create({
    data: {
      number: genNumber("ORD"),
      customerId: customer?.id,
      customerName,
      phone,
      email: email || null,
      subtotal,
      discount,
      total,
      promoCode: promoCode || null,
      pickupTime: pickupTime || null,
      status: "NEW",
      beansEarned,
      items: { create: built },
    },
    include: { items: true },
  });

  if (customer) await earnBeans(customer.id, beansEarned, "Order", order.number);

  res.status(201).json(outOrder(order));
});

// GET /api/orders/track/:number  (public)
ordersRouter.get("/track/:number", async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { number: req.params.number },
    include: { items: true },
  });
  if (!order) return res.status(404).json({ error: "Order not found." });
  res.json(outOrder(order));
});

// GET /api/orders  (admin) — filtered list
ordersRouter.get("/", requireAdmin, async (req, res) => {
  const { status, search } = req.query as Record<string, string>;
  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { customerName: { contains: search } },
      { phone: { contains: search } },
      { number: { contains: search } },
    ];
  }
  const orders = await prisma.order.findMany({
    where,
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(orders.map(outOrder));
});

// PATCH /api/orders/:id/status  (admin)
ordersRouter.patch("/:id/status", requireAdmin, async (req, res) => {
  const order = await prisma.order.update({
    where: { id: Number(req.params.id) },
    data: { status: req.body.status },
    include: { items: true },
  });
  res.json(outOrder(order));
});
