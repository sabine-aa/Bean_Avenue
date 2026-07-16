import { Router } from "express";
import { isAdminRequest, optionalCustomer, requireAdmin, requireCustomer } from "../auth";
import { prisma } from "../db";
import { actorFrom, audit, logActivity } from "../lib/activity";
import { quoteDelivery } from "../lib/delivery";
import { genNumber, getOrCreateCustomer, promoDiscount, round2 } from "../lib/helpers";
import { consumeForOrder, reverseForOrder } from "../lib/consumption";
import { checkHansonAvailability } from "../lib/hanson";
import { validateStock } from "../lib/inventory";
import { awardOrderBeans, reverseOrderBeans } from "../lib/loyalty";
import { notify } from "../lib/notify";
import { applyOrderStatus, DONE_STATUSES } from "../lib/orderStatus";
import { paymentProvider } from "../lib/payments";
import { outOrder, parseArr, toJson } from "../lib/serialize";
import { storefrontConfig } from "../lib/settings";

export const ordersRouter = Router();

export interface IncomingItem {
  menuItemId: number;
  quantity: number;
  selectedOptions: { group: string; choice: string }[];
  addons?: { addonId: number; quantity: number }[];
  specialInstructions?: string;
}

interface OptionChoice {
  label: string;
  priceDelta: number;
}
interface OptionGroup {
  name: string;
  choices: OptionChoice[];
}

interface BuiltLine {
  menuItemId: number;
  name: string;
  unitPrice: number;
  quantity: number;
  selectedOptions: string;
  addons: string;
  specialInstructions: string | null;
  lineTotal: number;
}

/** Resolve cart lines against the live menu (never trust client prices). */
export async function buildLines(
  items: IncomingItem[],
): Promise<{ built: BuiltLine[]; meta: { category: string; unitPrice: number }[]; addonsTotal: number } | { error: string }> {
  const built: BuiltLine[] = [];
  const meta: { category: string; unitPrice: number }[] = [];
  let addonsTotal = 0;

  for (const line of items) {
    const menuItem = await prisma.menuItem.findUnique({ where: { id: Number(line.menuItemId) } });
    if (!menuItem) return { error: "An item in your cart is no longer available." };

    const groups = parseArr(menuItem.options) as OptionGroup[];
    const selected = (line.selectedOptions ?? []).map((sel) => {
      const group = groups.find((g) => g.name === sel.group);
      const choice = group?.choices.find((c) => c.label === sel.choice);
      return { group: sel.group, choice: sel.choice, priceDelta: choice?.priceDelta ?? 0 };
    });

    const resolvedAddons: { addonId: number; name: string; price: number; quantity: number }[] = [];
    for (const sel of line.addons ?? []) {
      const addon = await prisma.addon.findUnique({ where: { id: Number(sel.addonId) } });
      if (!addon || !addon.isAvailable) continue;
      const qty = Math.min(Math.max(1, Math.round(Number(sel.quantity) || 1)), addon.maxQuantity);
      resolvedAddons.push({ addonId: addon.id, name: addon.name, price: addon.price, quantity: qty });
    }
    const lineAddonTotal = resolvedAddons.reduce((s, a) => s + a.price * a.quantity, 0);
    const quantity = Number(line.quantity) || 1;
    const unitPrice = round2(menuItem.price + selected.reduce((s, o) => s + o.priceDelta, 0) + lineAddonTotal);
    const specialInstructions = line.specialInstructions ? String(line.specialInstructions).trim().slice(0, 300) || null : null;

    addonsTotal += lineAddonTotal * quantity;
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
    meta.push({ category: menuItem.category, unitPrice });
  }
  return { built, meta, addonsTotal: round2(addonsTotal) };
}

/**
 * Value of an applied reward voucher (loyalty discount), validated against the
 * logged-in customer. DISCOUNT rewards take $ off; otherwise it's a free item
 * (cheapest eligible line). Returns 0 when nothing valid is applied.
 */
async function loyaltyDiscountFor(
  code: string | undefined,
  customerId: number | undefined,
  meta: { category: string; unitPrice: number }[],
  subtotal: number,
): Promise<number> {
  if (!code || !customerId) return 0;
  const redemption = await prisma.redemption.findUnique({ where: { code: code.trim() }, include: { reward: true } });
  if (!redemption || redemption.customerId !== customerId || redemption.status !== "ACTIVE") return 0;

  const reward = redemption.reward;
  if (reward && reward.type === "DISCOUNT" && reward.value > 0) {
    return round2(Math.min(reward.value, subtotal));
  }
  // Free item: discount the cheapest eligible line (matching category if set).
  const eligible = meta.filter((m) => !reward?.category || m.category === reward.category);
  const pool = eligible.length ? eligible : meta;
  if (!pool.length) return 0;
  const cheapest = pool.reduce((min, m) => Math.min(min, m.unitPrice), Infinity);
  return round2(Math.min(cheapest, subtotal));
}

// POST /api/orders  (public; uses the logged-in customer when a token is present)
ordersRouter.post("/", optionalCustomer, async (req, res) => {
  const body = req.body as {
    customerName: string;
    phone: string;
    email?: string;
    fulfillment?: string;
    pickupTime?: string;
    promoCode?: string;
    loyaltyRedemptionCode?: string;
    paymentMethod?: string;
    items: IncomingItem[];
    delivery?: {
      name?: string;
      phone?: string;
      label?: string;
      addressLine?: string;
      building?: string;
      floor?: string;
      apartment?: string;
      area?: string;
      landmark?: string;
      instructions?: string;
      lat?: number;
      lng?: number;
    };
  };

  const { customerName, phone, email, items } = body;
  if (!items?.length) return res.status(400).json({ error: "Your cart is empty." });
  if (!String(customerName ?? "").trim()) return res.status(400).json({ error: "Please enter your name." });
  if (!String(phone ?? "").trim()) return res.status(400).json({ error: "Please enter a phone number." });

  const fulfillment = body.fulfillment === "DELIVERY" ? "DELIVERY" : "PICKUP";
  const config = await storefrontConfig();

  // Don't let the storefront oversell a stock-tracked item or a sold-out doughnut.
  const stockError = await validateStock(items.map((i) => ({ menuItemId: i.menuItemId, quantity: Number(i.quantity) || 1 })));
  if (stockError) return res.status(409).json({ error: stockError });
  const hansonError = await checkHansonAvailability(items.map((i) => ({ menuItemId: i.menuItemId, quantity: Number(i.quantity) || 1 })));
  if (hansonError) return res.status(409).json({ error: hansonError });

  // Build line items + money.
  const result = await buildLines(items);
  if ("error" in result) return res.status(400).json({ error: result.error });
  const { built, meta, addonsTotal } = result;

  const subtotal = round2(built.reduce((s, l) => s + l.lineTotal, 0));
  const discount = promoDiscount(body.promoCode, subtotal);
  const loyaltyDiscount = await loyaltyDiscountFor(body.loyaltyRedemptionCode, req.customerId, meta, round2(subtotal - discount));

  // ---- Delivery: validate availability + minimum BEFORE creating anything. ----
  let deliveryFee = 0;
  let deliverySnapshot: Record<string, unknown> = {};
  if (fulfillment === "DELIVERY") {
    const d = body.delivery ?? {};
    if (!String(d.area ?? "").trim()) return res.status(400).json({ error: "Please enter your delivery area." });
    if (!String(d.addressLine ?? "").trim() && !String(d.building ?? "").trim()) {
      return res.status(400).json({ error: "Please enter your delivery address." });
    }
    const quote = await quoteDelivery({ area: d.area, lat: d.lat, lng: d.lng }, subtotal, config);
    if (!quote.available) return res.status(422).json({ error: quote.reason, deliveryUnavailable: true });
    if (quote.belowMinimum) {
      return res.status(422).json({
        error: `This area has a minimum order of $${quote.minOrder.toFixed(2)} for delivery. Add a little more to your cart, or choose pickup.`,
        belowMinimum: true,
        minOrder: quote.minOrder,
      });
    }
    deliveryFee = quote.fee;
    deliverySnapshot = {
      zoneId: quote.zone!.id,
      zoneName: quote.zone!.name,
      estimatedDelivery: quote.zone!.estimatedTime,
      deliveryName: String(d.name ?? customerName)
        .trim()
        .slice(0, 120),
      deliveryPhone: String(d.phone ?? phone)
        .trim()
        .slice(0, 30),
      addressLabel: d.label ? String(d.label).slice(0, 20) : null,
      addressLine:
        String(d.addressLine ?? "")
          .trim()
          .slice(0, 200) || null,
      building:
        String(d.building ?? "")
          .trim()
          .slice(0, 120) || null,
      floor:
        String(d.floor ?? "")
          .trim()
          .slice(0, 60) || null,
      apartment:
        String(d.apartment ?? "")
          .trim()
          .slice(0, 60) || null,
      area:
        String(d.area ?? "")
          .trim()
          .slice(0, 120) || null,
      landmark:
        String(d.landmark ?? "")
          .trim()
          .slice(0, 200) || null,
      deliveryInstructions:
        String(d.instructions ?? "")
          .trim()
          .slice(0, 400) || null,
      lat: Number.isFinite(Number(d.lat)) ? Number(d.lat) : null,
      lng: Number.isFinite(Number(d.lng)) ? Number(d.lng) : null,
    };
  }

  // ---- Payment method validity against what the manager enabled. ----
  let paymentMethod = String(body.paymentMethod ?? "").toUpperCase();
  const validMethods: string[] = [];
  if (config.payment.online) validMethods.push("ONLINE");
  if (config.payment.whish) validMethods.push("WHISH");
  if (fulfillment === "DELIVERY" && config.payment.cashOnDelivery) validMethods.push("CASH_ON_DELIVERY");
  if (fulfillment === "PICKUP" && config.payment.cashAtPickup) validMethods.push("CASH_AT_PICKUP");
  if (!validMethods.length) return res.status(400).json({ error: "No payment methods are available right now. Please contact us." });
  if (!validMethods.includes(paymentMethod)) paymentMethod = validMethods[0];

  // ---- Tax + total. ----
  const taxable = Math.max(0, round2(subtotal - discount - loyaltyDiscount + deliveryFee));
  const tax = round2(taxable * (config.tax.rate / 100));
  const total = round2(subtotal - discount - loyaltyDiscount + deliveryFee + tax);
  const beansEarned = Math.floor(Math.max(0, subtotal - discount - loyaltyDiscount));

  // Prefer the logged-in (verified) customer; fall back to phone for guests.
  let customer = req.customerId ? await prisma.customer.findUnique({ where: { id: req.customerId } }) : null;
  if (!customer && phone) customer = await getOrCreateCustomer(phone, customerName);

  // Both ONLINE (card) and WHISH need the customer to pay before we confirm.
  const isOnline = paymentMethod === "ONLINE" || paymentMethod === "WHISH";
  const order = await prisma.order.create({
    data: {
      number: genNumber("ORD"),
      customerId: customer?.id,
      customerName: String(customerName).trim(),
      phone: String(phone).trim(),
      email: email || null,
      fulfillment,
      pickupTime: fulfillment === "PICKUP" ? body.pickupTime || "ASAP" : null,
      subtotal,
      addonsTotal,
      discount,
      loyaltyDiscount,
      deliveryFee,
      tax,
      total,
      promoCode: body.promoCode || null,
      loyaltyRedemptionCode: loyaltyDiscount > 0 ? body.loyaltyRedemptionCode!.trim() : null,
      paymentMethod,
      // Online orders are NOT confirmed until the gateway confirms payment.
      status: isOnline ? "AWAITING_PAYMENT" : "RECEIVED",
      paymentStatus: isOnline ? "PENDING" : "CASH_DUE",
      beansEarned,
      ...deliverySnapshot,
      items: { create: built },
    },
    include: { items: true },
  });

  // Deduct stock for the order — recipe ingredients + finished goods (restored if cancelled).
  await consumeForOrder(items, { orderId: order.id });

  // Reserve the reward voucher to this order (returned if the order is undone).
  if (loyaltyDiscount > 0 && body.loyaltyRedemptionCode) {
    await prisma.redemption.updateMany({
      where: { code: body.loyaltyRedemptionCode.trim(), status: "ACTIVE" },
      data: { status: "CLAIMED", claimedAt: new Date() },
    });
  }

  // Cash orders are confirmed immediately; online wait for payment success.
  if (!isOnline && customer) {
    await notify(customer.id, {
      type: "ORDER",
      title: "Order received",
      message: `We got your order ${order.number}. We'll let you know as it progresses.`,
      link: `/order-success/${order.number}`,
    });
  }

  res.status(201).json(outOrder(order));
});

// GET /api/orders/track/:number  (public, but delivery PII only for the owner/admin)
ordersRouter.get("/track/:number", optionalCustomer, async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { number: req.params.number },
    include: { items: true },
  });
  if (!order) return res.status(404).json({ error: "Order not found." });

  // Sensitive delivery contact/address fields are only returned to the order's
  // owner (or an admin); a bare order number link reveals only status + items.
  const isOwner = !!order.customerId && order.customerId === req.customerId;
  const out = outOrder(order) as Record<string, unknown>;
  if (!isOwner && !isAdminRequest(req)) {
    for (const k of ["deliveryPhone", "addressLine", "building", "floor", "apartment", "landmark", "deliveryInstructions", "lat", "lng", "email", "phone"]) {
      delete out[k];
    }
  }
  res.json(out);
});

// POST /api/orders/:number/cancel  (customer) — rules depend on status
ordersRouter.post("/:number/cancel", requireCustomer, async (req, res) => {
  const order = await prisma.order.findUnique({ where: { number: req.params.number } });
  if (!order || order.customerId !== req.customerId) return res.status(404).json({ error: "Order not found." });
  if (order.status === "CANCELLED") return res.status(400).json({ error: "This order is already cancelled." });
  if (DONE_STATUSES.includes(order.status)) return res.status(400).json({ error: "This order is already complete." });

  // Customers may self-cancel only before staff start working on it.
  if (!["AWAITING_PAYMENT", "RECEIVED"].includes(order.status)) {
    return res.status(409).json({
      error: "This order is already being prepared. Please contact Bean Avenue staff to cancel it.",
      needsStaff: true,
    });
  }

  const reason =
    String(req.body.reason ?? "Cancelled by customer")
      .trim()
      .slice(0, 200) || "Cancelled by customer";

  // Refund a paid online order automatically.
  let refunded = false;
  if (order.paymentStatus === "PAID") {
    const payment = await prisma.payment.findFirst({ where: { orderId: order.id, status: "PAID" } });
    if (payment) {
      const r = await paymentProvider.refund(payment.transactionId, payment.amount, payment.refundedAmount, payment.amount);
      await prisma.payment.update({ where: { id: payment.id }, data: { status: r.status, refundedAmount: r.refundedAmount } });
      refunded = true;
    }
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "CANCELLED",
      cancelReason: reason,
      cancelledBy: "customer",
      ...(refunded ? { paymentStatus: "REFUNDED" } : {}),
    },
  });
  await reverseOrderBeans(order.id);
  await reverseForOrder(order.id);
  await audit(
    { actorId: null, actorName: order.customerName || "Customer", actorRole: "Customer", source: "Website" },
    {
      section: "Orders",
      action: "order_cancelled",
      description: `${order.number} cancelled by customer${refunded ? " (refunded)" : ""} — ${reason}`,
      entity: "Order",
      entityId: order.id,
      entityName: order.number,
      orderNumber: order.number,
      newValue: { reason, refunded },
    },
  );

  await notify(order.customerId, {
    type: "ORDER",
    title: "Order cancelled",
    message: refunded ? `Order ${order.number} was cancelled and your payment has been refunded.` : `Order ${order.number} was cancelled.`,
    link: `/order-success/${order.number}`,
  });

  const updated = await prisma.order.findUnique({ where: { id: order.id }, include: { items: true } });
  res.json(outOrder(updated!));
});

// GET /api/orders  (admin) — filtered list
ordersRouter.get("/", requireAdmin, async (req, res) => {
  const { status, search, fulfillment, channel } = req.query as Record<string, string>;
  const where: Record<string, unknown> = {};
  // In-store POS sales have their own screen — keep them out of the online-orders list by default.
  where.channel = channel || "ONLINE";
  if (status) where.status = status;
  if (fulfillment) where.fulfillment = fulfillment;
  if (search) {
    where.OR = [{ customerName: { contains: search } }, { phone: { contains: search } }, { number: { contains: search } }, { area: { contains: search } }];
  }
  const orders = await prisma.order.findMany({
    where,
    include: { items: true, payments: { orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(orders.map(outOrder));
});

// PATCH /api/orders/:id/status  (admin)  { status, reason? }
ordersRouter.patch("/:id/status", requireAdmin, async (req, res) => {
  const result = await applyOrderStatus(Number(req.params.id), String(req.body.status), { reason: req.body.reason, actor: actorFrom(req) });
  if (!result.ok) return res.status(result.code).json({ error: result.error });
  res.json(result.order);
});

// PATCH /api/orders/:id/assign  (admin) — assign a delivery to a staff member/driver
ordersRouter.patch("/:id/assign", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const driverName =
    String(req.body.driverName ?? "")
      .trim()
      .slice(0, 120) || null;
  const order = await prisma.order.update({ where: { id }, data: { driverName }, include: { items: true } });
  const actor = actorFrom(req);
  await logActivity(actor, "ASSIGN_DRIVER", `Order ${order.number} assigned to ${driverName ?? "—"}`, "order", order.number);
  if (driverName && order.customerId) {
    await notify(order.customerId, {
      type: "DELIVERY",
      title: "Driver assigned",
      message: `${driverName} will deliver your order ${order.number}.`,
      link: `/order-success/${order.number}`,
    });
  }
  res.json(outOrder(order));
});
