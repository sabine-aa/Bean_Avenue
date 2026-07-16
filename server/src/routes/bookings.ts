import { Router } from "express";
import { requireAdmin } from "../auth";
import { prisma } from "../db";
import { actorCtx, audit } from "../lib/activity";
import { dayBounds, earnBeans, genNumber, getOrCreateCustomer, round2 } from "../lib/helpers";
import { notify } from "../lib/notify";
import { outBooking } from "../lib/serialize";

export const bookingsRouter = Router();

const ACTIVE_STATUSES = ["PENDING", "CONFIRMED", "IN_USE", "COMPLETED"];

/** True if [start,end) overlaps any active booking for the room (optionally excluding one id). */
async function hasConflict(roomId: number, start: Date, end: Date, excludeId?: number) {
  const overlapping = await prisma.booking.findFirst({
    where: {
      roomId,
      status: { in: ACTIVE_STATUSES },
      id: excludeId ? { not: excludeId } : undefined,
      startTime: { lt: end },
      endTime: { gt: start },
    },
  });
  return Boolean(overlapping);
}

// GET /api/bookings/availability?roomId=&date=  (public)
bookingsRouter.get("/availability", async (req, res) => {
  const roomId = Number(req.query.roomId);
  const date = String(req.query.date);
  if (!roomId || !date) return res.json({ busy: [] });
  const { start, end } = dayBounds(date);
  const bookings = await prisma.booking.findMany({
    where: { roomId, status: { in: ACTIVE_STATUSES }, startTime: { gte: start, lte: end } },
    select: { startTime: true, endTime: true },
  });
  res.json({ busy: bookings.map((b) => ({ start: b.startTime, end: b.endTime })) });
});

// GET /api/bookings/track/:number  (public)
bookingsRouter.get("/track/:number", async (req, res) => {
  const booking = await prisma.booking.findUnique({
    where: { number: req.params.number },
    include: { room: true },
  });
  if (!booking) return res.status(404).json({ error: "Booking not found." });
  res.json(outBooking(booking));
});

// POST /api/bookings  (public) — create a booking
bookingsRouter.post("/", async (req, res) => {
  const { roomId, date, startHour, durationHours, customerName, phone, peopleCount, notes } = req.body;
  const room = await prisma.room.findUnique({ where: { id: Number(roomId) } });
  if (!room || !room.isAvailable) return res.status(400).json({ error: "That room isn't available." });

  if (peopleCount < room.capacityMin || peopleCount > room.capacityMax) {
    return res.status(400).json({
      error: `${room.name} fits ${room.capacityMin}–${room.capacityMax} people.`,
    });
  }

  const [y, m, d] = String(date).split("-").map(Number);
  const start = new Date(y, m - 1, d, Number(startHour));
  const end = new Date(y, m - 1, d, Number(startHour) + Number(durationHours));

  if (await hasConflict(room.id, start, end)) {
    return res.status(409).json({ error: "Sorry — that time was just booked. Please pick another slot." });
  }

  const total = round2(room.pricePerHour * Number(durationHours));
  const beansEarned = Math.floor(total);
  const customer = phone ? await getOrCreateCustomer(phone, customerName) : null;

  const booking = await prisma.booking.create({
    data: {
      number: genNumber("BK"),
      roomId: room.id,
      customerId: customer?.id,
      customerName,
      phone,
      startTime: start,
      endTime: end,
      durationHours: Number(durationHours),
      peopleCount: Number(peopleCount),
      notes: notes ?? null,
      total,
      status: "CONFIRMED",
      beansEarned,
    },
    include: { room: true },
  });

  if (customer) {
    await earnBeans(customer.id, beansEarned, "Booking", booking.number);
    await notify(customer.id, {
      type: "BOOKING",
      title: "Booking confirmed",
      message: `Your ${room.name} booking ${booking.number} is confirmed.`,
      link: `/booking-success/${booking.number}`,
    });
  }

  const bookActor = actorCtx(req);
  await audit(bookActor.source === "System" ? { actorId: null, actorName: customerName || "Customer", actorRole: "Customer", source: "Website" } : bookActor, {
    section: "Rooms",
    action: "booking_created",
    description: `Booking ${booking.number} — ${room.name} for ${customerName} (${Number(durationHours)}h, $${total.toFixed(2)})`,
    entity: "Booking",
    entityId: booking.id,
    entityName: booking.number,
    orderNumber: booking.number,
    newValue: { room: room.name, total, start },
  });
  res.status(201).json(outBooking(booking));
});

// GET /api/bookings  (admin) — filtered list
bookingsRouter.get("/", requireAdmin, async (req, res) => {
  const { status, roomId, date, search } = req.query as Record<string, string>;
  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (roomId) where.roomId = Number(roomId);
  if (date) {
    const { start, end } = dayBounds(date);
    where.startTime = { gte: start, lte: end };
  }
  if (search) {
    where.OR = [{ customerName: { contains: search } }, { phone: { contains: search } }, { number: { contains: search } }];
  }
  const bookings = await prisma.booking.findMany({
    where,
    include: { room: true },
    orderBy: { startTime: "asc" },
  });
  res.json(bookings.map(outBooking));
});

// PATCH /api/bookings/:id/status  (admin)
bookingsRouter.patch("/:id/status", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;
  const beforeBooking = await prisma.booking.findUnique({ where: { id } });
  const booking = await prisma.booking.update({ where: { id }, data: { status }, include: { room: true } });
  if (beforeBooking && beforeBooking.status !== booking.status)
    await audit(actorCtx(req), {
      section: "Rooms",
      action: status === "CANCELLED" ? "booking_cancelled" : "booking_status_changed",
      description: `Booking ${booking.number} (${booking.room.name}) ${beforeBooking.status} → ${booking.status}`,
      entity: "Booking",
      entityId: id,
      entityName: booking.number,
      orderNumber: booking.number,
      oldValue: { status: beforeBooking.status },
      newValue: { status: booking.status },
    });
  if (status === "NO_SHOW" && booking.customerId) {
    await prisma.customer.update({
      where: { id: booking.customerId },
      data: { noShowCount: { increment: 1 } },
    });
  }
  if (booking.customerId && (status === "CANCELLED" || status === "CONFIRMED")) {
    await notify(booking.customerId, {
      type: "BOOKING",
      title: status === "CANCELLED" ? "Booking cancelled" : "Booking updated",
      message:
        status === "CANCELLED"
          ? `Your ${booking.room.name} booking ${booking.number} was cancelled.`
          : `Your ${booking.room.name} booking ${booking.number} was updated.`,
      link: `/booking-success/${booking.number}`,
    });
  }
  res.json(outBooking(booking));
});

// PATCH /api/bookings/:id/reschedule  (admin)
bookingsRouter.patch("/:id/reschedule", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { date, startHour, durationHours } = req.body;
  const booking = await prisma.booking.findUnique({ where: { id }, include: { room: true } });
  if (!booking) return res.status(404).json({ error: "Booking not found." });

  const [y, m, d] = String(date).split("-").map(Number);
  const start = new Date(y, m - 1, d, Number(startHour));
  const end = new Date(y, m - 1, d, Number(startHour) + Number(durationHours));

  if (await hasConflict(booking.roomId, start, end, id)) {
    return res.status(409).json({ error: "That new time conflicts with another booking." });
  }

  const total = round2(booking.room.pricePerHour * Number(durationHours));
  const updated = await prisma.booking.update({
    where: { id },
    data: { startTime: start, endTime: end, durationHours: Number(durationHours), total },
    include: { room: true },
  });
  await notify(updated.customerId, {
    type: "BOOKING",
    title: "Booking rescheduled",
    message: `Your ${updated.room.name} booking ${updated.number} was moved to a new time.`,
    link: `/booking-success/${updated.number}`,
  });
  res.json(outBooking(updated));
});
