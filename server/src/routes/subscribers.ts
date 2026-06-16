import { Router } from "express";
import { requireAdmin } from "../auth";
import { prisma } from "../db";

export const subscribersRouter = Router();

// POST /api/subscribers  (public) — sign up for offers & updates
subscribersRouter.post("/", async (req, res) => {
  const phone = String(req.body.phone ?? "").trim();
  const name = req.body.name ? String(req.body.name).trim() : null;
  if (!phone) return res.status(400).json({ error: "A phone number is required." });

  // Upsert so re-signing up doesn't create duplicates.
  await prisma.subscriber.upsert({
    where: { phone },
    create: { phone, name },
    update: name ? { name } : {},
  });
  res.status(201).json({ ok: true });
});

// GET /api/subscribers  (admin)
subscribersRouter.get("/", requireAdmin, async (_req, res) => {
  const subscribers = await prisma.subscriber.findMany({ orderBy: { createdAt: "desc" } });
  res.json(subscribers);
});

// DELETE /api/subscribers/:id  (admin)
subscribersRouter.delete("/:id", requireAdmin, async (req, res) => {
  await prisma.subscriber.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});
