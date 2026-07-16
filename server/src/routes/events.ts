import { Router } from "express";
import { isAdminRequest, requireAdmin } from "../auth";
import { prisma } from "../db";

export const eventsRouter = Router();

function cleanBody(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  if ("title" in body) data.title = String(body.title ?? "").trim();
  if ("category" in body) data.category = String(body.category ?? "").trim();
  if ("description" in body) data.description = String(body.description ?? "");
  if ("location" in body) data.location = String(body.location ?? "").trim();
  if ("included" in body) data.included = String(body.included ?? "");
  if ("startTime" in body) data.startTime = new Date(String(body.startTime));
  if ("durationMins" in body) {
    const n = body.durationMins === "" || body.durationMins == null ? null : Math.max(0, Math.round(Number(body.durationMins)));
    data.durationMins = Number.isNaN(n as number) ? null : n;
  }
  if ("price" in body) data.price = Math.max(0, Number(body.price) || 0);
  if ("spots" in body) {
    const n = body.spots === "" || body.spots == null ? null : Math.max(0, Math.round(Number(body.spots)));
    data.spots = Number.isNaN(n as number) ? null : n;
  }
  if ("maxSpots" in body) {
    const n = body.maxSpots === "" || body.maxSpots == null ? null : Math.max(0, Math.round(Number(body.maxSpots)));
    data.maxSpots = Number.isNaN(n as number) ? null : n;
  }
  if ("image" in body) data.image = String(body.image ?? "").trim() || null;
  if ("isPublished" in body) data.isPublished = Boolean(body.isPublished);
  if ("isHidden" in body) data.isHidden = Boolean(body.isHidden);
  if ("isCompleted" in body) data.isCompleted = Boolean(body.isCompleted);
  if ("isCancelled" in body) data.isCancelled = Boolean(body.isCancelled);
  if ("sortOrder" in body) data.sortOrder = Math.round(Number(body.sortOrder) || 0);
  return data;
}

// GET /api/events  (public) — only published, non-hidden events
eventsRouter.get("/", async (_req, res) => {
  const events = await prisma.event.findMany({
    where: { isPublished: true, isHidden: false },
    orderBy: [{ sortOrder: "asc" }, { startTime: "asc" }],
  });
  res.json(events);
});

// GET /api/events/all  (admin) — every event incl. drafts, hidden & past
eventsRouter.get("/all", requireAdmin, async (_req, res) => {
  const events = await prisma.event.findMany({
    orderBy: [{ sortOrder: "asc" }, { startTime: "asc" }],
  });
  res.json(events);
});

// PATCH /api/events/reorder  (admin) — must be declared before "/:id"
eventsRouter.patch("/reorder", requireAdmin, async (req, res) => {
  const ids: number[] = req.body.ids ?? [];
  await prisma.$transaction(ids.map((id, index) => prisma.event.update({ where: { id }, data: { sortOrder: index } })));
  res.json({ ok: true });
});

// GET /api/events/:id  (public) — a single published event for the details page.
// Admins may also preview drafts/hidden events (when a valid admin token is sent).
eventsRouter.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) return res.status(404).json({ error: "Event not found." });
  if ((!event.isPublished || event.isHidden) && !isAdminRequest(req)) {
    return res.status(404).json({ error: "Event not found." });
  }
  res.json(event);
});

// POST /api/events  (admin)
eventsRouter.post("/", requireAdmin, async (req, res) => {
  const data = cleanBody(req.body);
  if (!data.title) return res.status(400).json({ error: "An event title is required." });
  if (!data.startTime || Number.isNaN((data.startTime as Date).getTime())) {
    return res.status(400).json({ error: "A valid date & time is required." });
  }
  const max = await prisma.event.aggregate({ _max: { sortOrder: true } });
  data.sortOrder = (max._max.sortOrder ?? 0) + 1;
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
