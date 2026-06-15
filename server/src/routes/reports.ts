import { Router } from "express";
import { requireAdmin } from "../auth";
import { prisma } from "../db";
import { dayBounds } from "../lib/helpers";
import { outBooking, outOrder, outRoom } from "../lib/serialize";

export const reportsRouter = Router();

reportsRouter.use(requireAdmin);

const INACTIVE_ORDER = ["CANCELLED"];
const INACTIVE_BOOKING = ["CANCELLED", "NO_SHOW"];

// GET /api/reports/dashboard
reportsRouter.get("/dashboard", async (_req, res) => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const [openOrders, todaysBookings, ordersToday, newCustomersToday, rooms] = await Promise.all([
    prisma.order.findMany({
      where: { status: { in: ["NEW", "PREPARING", "READY"] } },
      include: { items: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.booking.findMany({
      where: { startTime: { gte: start, lte: end } },
      include: { room: true },
      orderBy: { startTime: "asc" },
    }),
    prisma.order.findMany({ where: { createdAt: { gte: start, lte: end } } }),
    prisma.customer.count({ where: { createdAt: { gte: start, lte: end } } }),
    prisma.room.findMany({ orderBy: { id: "asc" } }),
  ]);

  const revenueOrders = ordersToday
    .filter((o) => !INACTIVE_ORDER.includes(o.status))
    .reduce((s, o) => s + o.total, 0);
  const revenueBookings = todaysBookings
    .filter((b) => !INACTIVE_BOOKING.includes(b.status))
    .reduce((s, b) => s + b.total, 0);

  res.json({
    openOrders: openOrders.map(outOrder),
    todaysBookings: todaysBookings.map(outBooking),
    ordersToday: ordersToday.length,
    revenueToday: Math.round((revenueOrders + revenueBookings) * 100) / 100,
    newCustomersToday,
    rooms: rooms.map(outRoom),
  });
});

// GET /api/reports/summary?from=&to=
reportsRouter.get("/summary", async (req, res) => {
  const from = String(req.query.from);
  const to = String(req.query.to);
  const { start } = dayBounds(from);
  const { end } = dayBounds(to);

  const [orders, bookings, rooms, earnTx, redeemTx] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: start, lte: end }, status: { notIn: INACTIVE_ORDER } },
      include: { items: true },
    }),
    prisma.booking.findMany({
      where: { startTime: { gte: start, lte: end }, status: { notIn: INACTIVE_BOOKING } },
    }),
    prisma.room.findMany(),
    prisma.loyaltyTransaction.findMany({
      where: { type: "EARN", createdAt: { gte: start, lte: end } },
    }),
    prisma.loyaltyTransaction.findMany({
      where: { type: "REDEEM", createdAt: { gte: start, lte: end } },
    }),
  ]);

  const foodRevenue = orders.reduce((s, o) => s + o.total, 0);
  const roomRevenue = bookings.reduce((s, b) => s + b.total, 0);

  // Top items by revenue
  const itemMap = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const o of orders) {
    for (const it of o.items) {
      const cur = itemMap.get(it.name) ?? { name: it.name, quantity: 0, revenue: 0 };
      cur.quantity += it.quantity;
      cur.revenue += it.lineTotal;
      itemMap.set(it.name, cur);
    }
  }
  const topItems = [...itemMap.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map((t) => ({ ...t, revenue: Math.round(t.revenue * 100) / 100 }));

  // Room utilization
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
  const utilization = rooms.map((r) => {
    const hoursBooked = bookings
      .filter((b) => b.roomId === r.id)
      .reduce((s, b) => s + b.durationHours, 0);
    const hoursAvailable = (r.closeHour - r.openHour) * days;
    return {
      room: r.name,
      hoursBooked,
      hoursAvailable,
      utilization: hoursAvailable > 0 ? Math.round((hoursBooked / hoursAvailable) * 100) : 0,
    };
  });

  // By day-of-week and by hour (orders + bookings)
  const byDay = Array(7).fill(0);
  const byHour = Array(24).fill(0);
  for (const o of orders) {
    byDay[o.createdAt.getDay()]++;
    byHour[o.createdAt.getHours()]++;
  }
  for (const b of bookings) {
    byDay[b.startTime.getDay()]++;
    byHour[b.startTime.getHours()]++;
  }

  // Customers: new vs returning within range
  const activeCustomerIds = new Set<number>();
  orders.forEach((o) => o.customerId && activeCustomerIds.add(o.customerId));
  bookings.forEach((b) => b.customerId && activeCustomerIds.add(b.customerId));
  const activeCustomers = activeCustomerIds.size
    ? await prisma.customer.findMany({ where: { id: { in: [...activeCustomerIds] } } })
    : [];
  const newCustomers = activeCustomers.filter((c) => c.createdAt >= start).length;
  const returning = activeCustomers.length - newCustomers;

  res.json({
    range: { from, to },
    revenue: {
      food: Math.round(foodRevenue * 100) / 100,
      rooms: Math.round(roomRevenue * 100) / 100,
      total: Math.round((foodRevenue + roomRevenue) * 100) / 100,
    },
    orderCount: orders.length,
    bookingCount: bookings.length,
    topItems,
    utilization,
    byDay,
    byHour,
    customers: { new: newCustomers, returning },
    beans: {
      issued: earnTx.reduce((s, t) => s + t.amount, 0),
      redeemed: redeemTx.reduce((s, t) => s + Math.abs(t.amount), 0),
    },
  });
});

// GET /api/reports/export?from=&to=  → CSV download
reportsRouter.get("/export", async (req, res) => {
  const from = String(req.query.from);
  const to = String(req.query.to);
  const { start } = dayBounds(from);
  const { end } = dayBounds(to);

  const [orders, bookings] = await Promise.all([
    prisma.order.findMany({ where: { createdAt: { gte: start, lte: end } } }),
    prisma.booking.findMany({ where: { startTime: { gte: start, lte: end } }, include: { room: true } }),
  ]);

  const rows: string[] = ["Type,Number,Customer,Phone,Date,Detail,Total,Status"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  for (const o of orders) {
    rows.push(
      ["Order", o.number, o.customerName, o.phone, o.createdAt.toISOString(), "Food order", o.total, o.status]
        .map(esc)
        .join(",")
    );
  }
  for (const b of bookings) {
    rows.push(
      ["Booking", b.number, b.customerName, b.phone, b.startTime.toISOString(), b.room.name, b.total, b.status]
        .map(esc)
        .join(",")
    );
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="bean-avenue-${from}-to-${to}.csv"`);
  res.send(rows.join("\n"));
});
