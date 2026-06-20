import { Router } from "express";
import { optionalCustomer, requireAdmin } from "../auth";
import { prisma } from "../db";
import { earnBeans, genNumber, getOrCreateCustomer, promoDiscount, round2 } from "../lib/helpers";
import { notify } from "../lib/notify";
import { outOrder, parseArr, toJson } from "../lib/serialize";

// Customer-friendly notification text per order status.
const ORDER_NOTIFICATIONS: Record<string, { title: string; message: (n: string) => string }> = {
  PREPARING: { title: "Order accepted", message: (n) => `We're preparing order ${n} now.` },
  READY: { title: "Your order is ready", message: (n) => `Order ${n} is ready for pickup.` },
  PICKED_UP: { title: "Order completed", message: (n) => `Order ${n} is complete. Enjoy! ☕` },
  CANCELLED: { title: "Order cancelled", message: (n) => `Order ${n} was cancelled.` },
};

export const ordersRouter = Router();

interface IncomingItem {
  menuItemId: number;
  quantity: number;
  selectedOptions: { group: string; choice: string }[];
  addons?: { addonId: number; quantity: number }[];
  specialInstructions?: string;
}

interface OptionChoice { label: string; priceDelta: number }
interface OptionGroup { name: string; choices: OptionChoice[] }

// POST /api/orders  (public; uses the logged-in customer when a token is present)
ordersRouter.post("/", optionalCustomer, async (req, res) => {
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

    // Resolve add-ons against the DB (never trust client prices), respecting
    // availability and each add-on's max quantity.
    const resolvedAddons: { addonId: number; name: string; price: number; quantity: number }[] = [];
    for (const sel of line.addons ?? []) {
      const addon = await prisma.addon.findUnique({ where: { id: Number(sel.addonId) } });
      if (!addon || !addon.isAvailable) continue;
      const qty = Math.min(Math.max(1, Math.round(Number(sel.quantity) || 1)), addon.maxQuantity);
      resolvedAddons.push({ addonId: addon.id, name: addon.name, price: addon.price, quantity: qty });
    }
    const addonTotal = resolvedAddons.reduce((s, a) => s + a.price * a.quantity, 0);

    const unitPrice = round2(
      menuItem.price + selected.reduce((s, o) => s + o.priceDelta, 0) + addonTotal
    );
    const quantity = Number(line.quantity) || 1;
    const specialInstructions = line.specialInstructions
      ? String(line.specialInstructions).trim().slice(0, 300) || null
      : null;
    built.push({
      menuItemId: menuItem.id,
      name: menuItem.name,
      unitPrice,
      quantity,
      selectedOptions: toJson(selected),
      addons: toJson(resolvedAddons),
      specialInstructions,
      lineTotal: round2(unitPrice * quantity),
    });
  }

  const subtotal = round2(built.reduce((s, l) => s + l.lineTotal, 0));
  const discount = promoDiscount(promoCode, subtotal);
  const total = round2(subtotal - discount);
  const beansEarned = Math.floor(total);
  // Prefer the logged-in (verified) customer; fall back to phone for guests.
  let customer = req.customerId
    ? await prisma.customer.findUnique({ where: { id: req.customerId } })
    : null;
  if (!customer && phone) customer = await getOrCreateCustomer(phone, customerName);

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

  if (customer) {
    await earnBeans(customer.id, beansEarned, "Order", order.number);
    await notify(customer.id, {
      type: "ORDER",
      title: "Order received",
      message: `We got your order ${order.number}. We'll let you know when it's ready.`,
      link: `/order-success/${order.number}`,
    });
  }

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

// PATCH /api/orders/:id/status  (admin)  { status, reason? }
ordersRouter.patch("/:id/status", requireAdmin, async (req, res) => {
  const status = String(req.body.status);
  if (status === "CANCELLED" && !String(req.body.reason ?? "").trim()) {
    return res.status(400).json({ error: "A reason is required to cancel an order." });
  }
  const reason = status === "CANCELLED" ? String(req.body.reason).trim() : null;

  const order = await prisma.order.update({
    where: { id: Number(req.params.id) },
    data: { status, ...(status === "CANCELLED" ? { cancelReason: reason } : {}) },
    include: { items: true },
  });

  const meta = ORDER_NOTIFICATIONS[status];
  if (meta && order.customerId) {
    await notify(order.customerId, {
      type: "ORDER",
      title: meta.title,
      message:
        status === "CANCELLED" && reason
          ? `${meta.message(order.number)} Reason: ${reason}`
          : meta.message(order.number),
      link: `/order-success/${order.number}`,
    });
  }
  res.json(outOrder(order));
});
