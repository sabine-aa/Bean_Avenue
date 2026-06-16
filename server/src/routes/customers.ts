import { Router } from "express";
import { requireAdmin } from "../auth";
import { prisma } from "../db";
import { tierFor } from "../lib/helpers";
import { outBooking } from "../lib/serialize";

export const customersRouter = Router();

customersRouter.use(requireAdmin);

// GET /api/customers?search=
customersRouter.get("/", async (req, res) => {
  const search = String(req.query.search ?? "");
  const customers = await prisma.customer.findMany({
    where: search
      ? { OR: [{ name: { contains: search } }, { phone: { contains: search } }] }
      : undefined,
    orderBy: { lifetimeBeans: "desc" },
    include: { _count: { select: { orders: true, bookings: true } } },
  });
  res.json(customers);
});

// GET /api/customers/:id
customersRouter.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      orders: { orderBy: { createdAt: "desc" }, take: 20 },
      bookings: { include: { room: true }, orderBy: { startTime: "desc" }, take: 20 },
      transactions: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!customer) return res.status(404).json({ error: "Customer not found." });

  const orderValue = customer.orders.reduce((s, o) => s + o.total, 0);
  const bookingValue = customer.bookings.reduce((s, b) => s + b.total, 0);
  res.json({
    ...customer,
    bookings: customer.bookings.map(outBooking),
    lifetimeValue: Math.round((orderValue + bookingValue) * 100) / 100,
  });
});

// POST /api/customers/:id/adjust-beans  { amount, note }
// A reason (note) is required so every manual change is explained in the ledger.
customersRouter.post("/:id/adjust-beans", async (req, res) => {
  const id = Number(req.params.id);
  const amount = Math.round(Number(req.body.amount) || 0);
  const note = String(req.body.note ?? "").trim();
  if (!amount) return res.status(400).json({ error: "Enter a non-zero amount." });
  if (!note) return res.status(400).json({ error: "A reason is required for manual adjustments." });

  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) return res.status(404).json({ error: "Customer not found." });
  if (customer.beanBalance + amount < 0) {
    return res.status(400).json({ error: "That would put the balance below zero." });
  }

  const lifetimeBeans = amount > 0 ? customer.lifetimeBeans + amount : customer.lifetimeBeans;
  const balanceAfter = customer.beanBalance + amount;
  const updated = await prisma.customer.update({
    where: { id },
    data: { beanBalance: balanceAfter, lifetimeBeans, tier: tierFor(lifetimeBeans) },
  });
  await prisma.loyaltyTransaction.create({
    data: { customerId: id, type: "ADJUST", amount, balanceAfter, source: "Manual adjustment", note },
  });
  res.json(updated);
});

// PATCH /api/customers/:id  (e.g. toggle VIP)
customersRouter.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const data: Record<string, unknown> = {};
  if ("isVip" in req.body) data.isVip = req.body.isVip;
  if ("name" in req.body) data.name = req.body.name;
  const customer = await prisma.customer.update({ where: { id }, data });
  res.json(customer);
});
