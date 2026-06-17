import { Router } from "express";
import { requireCustomer } from "../auth";
import { prisma } from "../db";

export const notificationsRouter = Router();

notificationsRouter.use(requireCustomer);

// GET /api/notifications — recent notifications + unread count
notificationsRouter.get("/", async (req, res) => {
  const customerId = req.customerId!;
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.notification.count({ where: { customerId, isRead: false } }),
  ]);
  res.json({ items, unread });
});

// POST /api/notifications/:id/read — mark one as read
notificationsRouter.post("/:id/read", async (req, res) => {
  const customerId = req.customerId!;
  await prisma.notification.updateMany({
    where: { id: Number(req.params.id), customerId },
    data: { isRead: true },
  });
  res.json({ ok: true });
});

// POST /api/notifications/read-all — mark all as read
notificationsRouter.post("/read-all", async (req, res) => {
  await prisma.notification.updateMany({
    where: { customerId: req.customerId!, isRead: false },
    data: { isRead: true },
  });
  res.json({ ok: true });
});
