import { Router } from "express";
import { requireAdmin } from "../auth";
import { prisma } from "../db";

export const bannersRouter = Router();

function cleanBody(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  if ("title" in body) data.title = String(body.title ?? "").trim();
  if ("text" in body) data.text = String(body.text ?? "");
  if ("image" in body) data.image = String(body.image ?? "").trim() || null;
  if ("buttonText" in body) data.buttonText = String(body.buttonText ?? "").trim() || null;
  if ("buttonLink" in body) data.buttonLink = String(body.buttonLink ?? "").trim() || null;
  if ("startDate" in body) data.startDate = body.startDate ? new Date(String(body.startDate)) : null;
  if ("endDate" in body) data.endDate = body.endDate ? new Date(String(body.endDate)) : null;
  if ("isVisible" in body) data.isVisible = Boolean(body.isVisible);
  return data;
}

// GET /api/banners/active  (public) — the banner to show right now, or null
bannersRouter.get("/active", async (_req, res) => {
  const now = new Date();
  const banner = await prisma.banner.findFirst({
    where: {
      isVisible: true,
      AND: [{ OR: [{ startDate: null }, { startDate: { lte: now } }] }, { OR: [{ endDate: null }, { endDate: { gte: now } }] }],
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(banner ?? null);
});

// GET /api/banners  (admin) — all banners
bannersRouter.get("/", requireAdmin, async (_req, res) => {
  const banners = await prisma.banner.findMany({ orderBy: { createdAt: "desc" } });
  res.json(banners);
});

// POST /api/banners  (admin)
bannersRouter.post("/", requireAdmin, async (req, res) => {
  const data = cleanBody(req.body);
  if (!data.title) return res.status(400).json({ error: "A banner title is required." });
  const banner = await prisma.banner.create({ data: data as never });
  res.status(201).json(banner);
});

// PATCH /api/banners/:id  (admin)
bannersRouter.patch("/:id", requireAdmin, async (req, res) => {
  const banner = await prisma.banner.update({ where: { id: Number(req.params.id) }, data: cleanBody(req.body) });
  res.json(banner);
});

// DELETE /api/banners/:id  (admin)
bannersRouter.delete("/:id", requireAdmin, async (req, res) => {
  await prisma.banner.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});
