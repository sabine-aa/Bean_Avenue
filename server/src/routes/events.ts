import { Router } from "express";
import { requireAdmin } from "../auth";
import { prisma } from "../db";

export const eventsRouter = Router();

function cleanBody(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  if ("title" in body) data.title = String(body.title ?? "").trim();
  if ("description" in body) data.description = String(body.description ?? "");
  if ("startTime" in body) data.startTime = new Date(String(body.startTime));
  if ("price" in body) data.price = Math.max(0, Number(body.price) || 0);
  if ("spots" in body) {
    const n = body.spots === "" || body.spots == null ? null : Math.max(0, Math.round(Number(body.spots)));
    data.spots = Number.isNaN(n as number) ? null : n;
  }
  if ("image" in body) data.image = String(body.image ?? "").trim() || null;
  if ("isHidden" in body) data.isHidden = Boolean(body.isHidden);
  if ("sortOrder" in body) data.sortOrder = Math.round(Number(body.sortOrder) || 0);
  return data;
}

// GET /api/events  (public) — visible, upcoming events
eventsRouter.get("/", async (_req, res) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const events = await prisma.event.findMany({
    where: { isHidden: false, startTime: { gte: startOfToday } },
    orderBy: [{ startTime: "asc" }, { sortOrder: "asc" }],
  });
  res.json(events);
});

// GET /api/events/all  (admin) — every event incl hidden & past
eventsRouter.get("/all", requireAdmin, async (_req, res) => {
  const events = await prisma.event.findMany({ orderBy: { startTime: "asc" } });
  res.json(events);
});

// POST /api/events  (admin)
eventsRouter.post("/", requireAdmin, async (req, res) => {
  const data = cleanBody(req.body);
  if (!data.title) return res.status(400).json({ error: "An event title is required." });
  if (!data.startTime || Number.isNaN((data.startTime as Date).getTime())) {
    return res.status(400).json({ error: "A valid date & time is required." });
  }
  const event = await prisma.event.create({ data: data as never });
  res.status(201).json(event);
});

// PATCH /api/events/:id  (admin)
eventsRouter.patch("/:id", requireAdmin, async (req, res) => {
  const event = await prisma.event.update({ where: { id: Number(req.params.id) }, data: cleanBody(req.body) });
  res.json(event);
});

// DELETE /api/events/:id  (admin)
eventsRouter.delete("/:id", requireAdmin, async (req, res) => {
  await prisma.event.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});
