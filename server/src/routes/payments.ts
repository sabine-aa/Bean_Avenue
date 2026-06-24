import type { Order } from "@prisma/client";
import { Router } from "express";
import { optionalCustomer, requireAdmin } from "../auth";
import { prisma } from "../db";
import { actorFrom, logActivity } from "../lib/activity";
import { round2 } from "../lib/helpers";
import { awardOrderBeans, reverseOrderBeans } from "../lib/loyalty";
import { notify } from "../lib/notify";
import { paymentProvider, type PaymentResult } from "../lib/payments";
import { outOrder } from "../lib/serialize";
import { storefrontConfig } from "../lib/settings";

export const paymentsRouter = Router();

/** Mark an online order PAID + confirmed once the gateway confirms the payment. */
async function settlePaidOrder(order: Order, result: PaymentResult, paymentId: number) {
  await prisma.payment.update({
    where: { id: paymentId },
    data: { status: "PAID", cardBrand: result.cardBrand, cardLast4: result.cardLast4, failureReason: null },
  });
  const wasUnconfirmed = order.status === "AWAITING_PAYMENT";
  await prisma.order.update({
    where: { id: order.id },
    data: { paymentStatus: "PAID", paidAt: new Date(), ...(wasUnconfirmed ? { status: "RECEIVED" } : {}) },
  });
  // Beans are earned only after a successful payment (idempotent).
  await awardOrderBeans(order.id);

  if (order.customerId) {
    await notify(order.customerId, {
      type: "PAYMENT",
      title: "Payment successful",
      message: `Your payment for order ${order.number} went through. Total paid: $${order.total.toFixed(2)}.`,
      link: `/order-success/${order.number}`,
    });
    await notify(order.customerId, {
      type: "ORDER",
      title: "Order confirmed",
      message: `Order ${order.number} is confirmed. We'll keep you posted.`,
      link: `/order-success/${order.number}`,
    });
  }
}

async function recordFailure(order: Order, result: PaymentResult, paymentId: number) {
  await prisma.payment.update({
    where: { id: paymentId },
    data: { status: "FAILED", failureReason: result.failureReason ?? "Payment failed.", cardBrand: result.cardBrand, cardLast4: result.cardLast4 },
  });
  // Keep the order in AWAITING_PAYMENT so the customer can retry (no duplicate order).
  await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: "PENDING" } });
  if (order.customerId) {
    await notify(order.customerId, {
      type: "PAYMENT",
      title: "Payment failed",
      message: `We couldn't process your payment for order ${order.number}. Your cart is saved — please try again.`,
      link: `/checkout?retry=${order.number}`,
    });
  }
}

// POST /api/payments/pay  { orderNumber, cardNumber }  — pay for an online order
paymentsRouter.post("/pay", optionalCustomer, async (req, res) => {
  const orderNumber = String(req.body.orderNumber ?? "");
  const order = await prisma.order.findUnique({ where: { number: orderNumber } });
  if (!order) return res.status(404).json({ error: "Order not found." });
  // If the order belongs to an account, the caller must be that account.
  if (order.customerId && order.customerId !== req.customerId) {
    return res.status(403).json({ error: "You can't pay for this order." });
  }
  if (order.paymentMethod !== "ONLINE") return res.status(400).json({ error: "This order isn't an online-payment order." });
  if (order.paymentStatus === "PAID") return res.status(400).json({ error: "This order is already paid." });
  if (order.status === "CANCELLED") return res.status(400).json({ error: "This order was cancelled." });

  const config = await storefrontConfig();
  const result = await paymentProvider.createPayment({
    amount: order.total,
    currency: config.currency,
    orderId: order.id,
    customerId: order.customerId ?? undefined,
    cardNumber: String(req.body.cardNumber ?? ""),
  });

  // Record the attempt. We store ONLY safe fields — never the card number.
  const payment = await prisma.payment.create({
    data: {
      orderId: order.id,
      provider: result.provider,
      transactionId: result.transactionId,
      method: "CARD",
      amount: order.total,
      currency: config.currency,
      status: result.outcome === "PAID" ? "PAID" : "PENDING",
      cardBrand: result.cardBrand,
      cardLast4: result.cardLast4,
      customerId: order.customerId ?? undefined,
    },
  });

  if (result.outcome === "PAID") {
    await settlePaidOrder(order, result, payment.id);
    const fresh = await prisma.order.findUnique({ where: { id: order.id }, include: { items: true } });
    return res.json({ status: "PAID", transactionId: result.transactionId, order: outOrder(fresh!) });
  }
  if (result.outcome === "REQUIRES_3DS") {
    return res.json({ status: "REQUIRES_3DS", transactionId: result.transactionId });
  }
  await recordFailure(order, result, payment.id);
  return res.status(402).json({ status: "FAILED", error: result.failureReason ?? "Your payment was declined." });
});

// POST /api/payments/confirm  { transactionId, otp }  — complete a 3D Secure challenge
paymentsRouter.post("/confirm", optionalCustomer, async (req, res) => {
  const transactionId = String(req.body.transactionId ?? "");
  const payment = await prisma.payment.findUnique({ where: { transactionId } });
  if (!payment || !payment.orderId) return res.status(404).json({ error: "Payment not found." });
  const order = await prisma.order.findUnique({ where: { id: payment.orderId } });
  if (!order) return res.status(404).json({ error: "Order not found." });
  if (order.customerId && order.customerId !== req.customerId) return res.status(403).json({ error: "Not allowed." });

  const result = await paymentProvider.confirm3DS(transactionId, String(req.body.otp ?? ""));
  if (result.outcome === "PAID") {
    await settlePaidOrder(order, result, payment.id);
    const fresh = await prisma.order.findUnique({ where: { id: order.id }, include: { items: true } });
    return res.json({ status: "PAID", transactionId, order: outOrder(fresh!) });
  }
  await recordFailure(order, result, payment.id);
  return res.status(402).json({ status: "FAILED", error: result.failureReason ?? "Verification failed." });
});

// ---- Admin payment management ----

// GET /api/payments  (admin) — transactions, search by customer/order/txn, filter by status
paymentsRouter.get("/", requireAdmin, async (req, res) => {
  const { status, search } = req.query as Record<string, string>;
  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { transactionId: { contains: search } },
      { order: { is: { number: { contains: search } } } },
      { order: { is: { customerName: { contains: search } } } },
      { order: { is: { phone: { contains: search } } } },
    ];
  }
  const payments = await prisma.payment.findMany({
    where,
    include: { order: { select: { number: true, customerName: true, phone: true, fulfillment: true, total: true } } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  res.json(payments);
});

// GET /api/payments/cash-due  (admin) — cash orders awaiting collection
paymentsRouter.get("/cash-due", requireAdmin, async (_req, res) => {
  const orders = await prisma.order.findMany({
    where: { paymentMethod: { in: ["CASH_ON_DELIVERY", "CASH_AT_PICKUP"] }, paymentStatus: "CASH_DUE", status: { not: "CANCELLED" } },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(orders.map(outOrder));
});

// GET /api/payments/summary  (admin) — totals for reconciliation
paymentsRouter.get("/summary", requireAdmin, async (_req, res) => {
  const orders = await prisma.order.findMany({ where: { status: { not: "CANCELLED" } } });
  const payments = await prisma.payment.findMany();
  const onlinePaid = round2(payments.filter((p) => p.status === "PAID" || p.status === "PARTIALLY_REFUNDED").reduce((s, p) => s + p.amount, 0));
  const refunded = round2(payments.reduce((s, p) => s + p.refundedAmount, 0));
  const cashDue = round2(orders.filter((o) => o.paymentStatus === "CASH_DUE").reduce((s, o) => s + o.total, 0));
  const cashCollected = round2(orders.filter((o) => o.paymentStatus === "CASH_COLLECTED").reduce((s, o) => s + o.total, 0));
  const deliveryFees = round2(orders.filter((o) => o.fulfillment === "DELIVERY").reduce((s, o) => s + o.deliveryFee, 0));
  res.json({
    onlinePaid,
    refunded,
    netOnline: round2(onlinePaid - refunded),
    cashDue,
    cashCollected,
    deliveryFees,
    failedCount: payments.filter((p) => p.status === "FAILED").length,
  });
});

// GET /api/payments/log  (admin) — the payment/refund/admin audit trail
paymentsRouter.get("/log", requireAdmin, async (_req, res) => {
  const log = await prisma.adminActivityLog.findMany({ orderBy: { createdAt: "desc" }, take: 300 });
  res.json(log);
});

// GET /api/payments/export  (admin) — CSV of all transactions
paymentsRouter.get("/export", requireAdmin, async (_req, res) => {
  const payments = await prisma.payment.findMany({
    include: { order: { select: { number: true, customerName: true } } },
    orderBy: { createdAt: "desc" },
  });
  const head = ["TransactionID", "Order", "Customer", "Method", "Amount", "Currency", "Status", "Refunded", "Card", "Date"];
  const rows = payments.map((p) => [
    p.transactionId,
    p.order?.number ?? "",
    (p.order?.customerName ?? "").replace(/,/g, " "),
    p.method,
    p.amount.toFixed(2),
    p.currency,
    p.status,
    p.refundedAmount.toFixed(2),
    p.cardLast4 ? `${p.cardBrand ?? "Card"} ****${p.cardLast4}` : "",
    p.createdAt.toISOString(),
  ]);
  const csv = [head, ...rows].map((r) => r.join(",")).join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="bean-avenue-payments.csv"');
  res.send(csv);
});

// POST /api/payments/:id/refund  (admin)  { amount? }  — full or partial refund
paymentsRouter.post("/:id/refund", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) return res.status(404).json({ error: "Payment not found." });
  if (payment.status !== "PAID" && payment.status !== "PARTIALLY_REFUNDED") {
    return res.status(400).json({ error: "Only a successful payment can be refunded." });
  }
  const remaining = round2(payment.amount - payment.refundedAmount);
  if (remaining <= 0) return res.status(400).json({ error: "This payment is already fully refunded." });

  const requested = req.body.amount != null ? round2(Number(req.body.amount)) : remaining;
  if (!(requested > 0) || requested > remaining) {
    return res.status(400).json({ error: `Refund must be between $0.01 and $${remaining.toFixed(2)}.` });
  }

  const r = await paymentProvider.refund(payment.transactionId, requested, payment.refundedAmount, payment.amount);
  await prisma.payment.update({ where: { id }, data: { status: r.status, refundedAmount: r.refundedAmount } });

  const actor = actorFrom(req);
  const fullyRefunded = r.status === "REFUNDED";
  if (payment.orderId) {
    await prisma.order.update({
      where: { id: payment.orderId },
      data: { paymentStatus: fullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED" },
    });
    // A full refund removes the loyalty beans the order earned (idempotent).
    if (fullyRefunded) await reverseOrderBeans(payment.orderId);
    const order = await prisma.order.findUnique({ where: { id: payment.orderId } });
    if (order?.customerId) {
      await notify(order.customerId, {
        type: "PAYMENT",
        title: fullyRefunded ? "Refund completed" : "Partial refund completed",
        message: `$${requested.toFixed(2)} was refunded for order ${order.number}.`,
        link: `/order-success/${order.number}`,
      });
    }
    await logActivity(actor, "REFUND", `Refunded $${requested.toFixed(2)} on ${payment.transactionId} (order ${order?.number ?? "?"})`, "payment", payment.transactionId);
  }
  const updated = await prisma.payment.findUnique({ where: { id } });
  res.json(updated);
});

// POST /api/payments/order/:number/collect-cash  (admin) — record cash collected
paymentsRouter.post("/order/:number/collect-cash", requireAdmin, async (req, res) => {
  const order = await prisma.order.findUnique({ where: { number: req.params.number } });
  if (!order) return res.status(404).json({ error: "Order not found." });
  if (order.paymentMethod === "ONLINE") return res.status(400).json({ error: "This is an online-payment order." });
  if (order.paymentStatus === "CASH_COLLECTED") return res.status(400).json({ error: "Cash already recorded as collected." });

  await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: "CASH_COLLECTED" } });
  await prisma.payment.create({
    data: {
      orderId: order.id,
      provider: "cash",
      transactionId: `CASH-${order.number}`,
      method: "CASH",
      amount: order.total,
      currency: "USD",
      status: "PAID",
      customerId: order.customerId ?? undefined,
    },
  });
  // Cash collected counts as a successful order → beans earned (idempotent).
  await awardOrderBeans(order.id);

  const actor = actorFrom(req);
  await logActivity(actor, "RECORD_CASH", `Cash $${order.total.toFixed(2)} collected for order ${order.number}`, "order", order.number);
  const updated = await prisma.order.findUnique({ where: { id: order.id }, include: { items: true } });
  res.json(outOrder(updated!));
});
