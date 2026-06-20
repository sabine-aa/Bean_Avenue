import { Router } from "express";
import { requireAdmin } from "../auth";
import { prisma } from "../db";
import { DOUGHNUT_CATEGORY } from "../lib/constants";
import { outMenuItem } from "../lib/serialize";

export const doughnutsRouter = Router();

const PROMO_DEFAULTS = {
  visible: true,
  title: "Today's Hanson Doughnuts",
  description: "Discover today's freshly available doughnut selection at Bean Avenue.",
  buttonText: "View Today's Doughnuts",
  image: "/hanson-doughnuts-logo.png",
};

async function getPromo() {
  const keys = ["doughnuts.visible", "doughnuts.title", "doughnuts.description", "doughnuts.buttonText", "doughnuts.image"];
  const rows = await prisma.setting.findMany({ where: { key: { in: keys } } });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    visible: map["doughnuts.visible"] ? map["doughnuts.visible"] === "true" : PROMO_DEFAULTS.visible,
    title: map["doughnuts.title"] ?? PROMO_DEFAULTS.title,
    description: map["doughnuts.description"] ?? PROMO_DEFAULTS.description,
    buttonText: map["doughnuts.buttonText"] ?? PROMO_DEFAULTS.buttonText,
    image: map["doughnuts.image"] ?? PROMO_DEFAULTS.image,
  };
}

// GET /api/doughnuts  (public) — only today's available, visible doughnuts
doughnutsRouter.get("/", async (_req, res) => {
  const items = await prisma.menuItem.findMany({
    where: { category: DOUGHNUT_CATEGORY, isHidden: false, availableToday: true },
    orderBy: { sortOrder: "asc" },
  });
  res.json(items.map(outMenuItem));
});

// GET /api/doughnuts/promo  (public) — homepage promo section settings
doughnutsRouter.get("/promo", async (_req, res) => {
  res.json(await getPromo());
});

// ---- Admin ----

// GET /api/doughnuts/admin — the full catalogue (incl hidden/unavailable)
doughnutsRouter.get("/admin", requireAdmin, async (_req, res) => {
  const items = await prisma.menuItem.findMany({
    where: { category: DOUGHNUT_CATEGORY },
    orderBy: { sortOrder: "asc" },
  });
  res.json(items.map(outMenuItem));
});

// POST /api/doughnuts/promo  (admin) — update homepage promo settings
doughnutsRouter.post("/promo", requireAdmin, async (req, res) => {
  const fields: Record<string, string> = {};
  if ("visible" in req.body) fields["doughnuts.visible"] = req.body.visible ? "true" : "false";
  if ("title" in req.body) fields["doughnuts.title"] = String(req.body.title ?? "").trim() || PROMO_DEFAULTS.title;
  if ("description" in req.body) fields["doughnuts.description"] = String(req.body.description ?? "");
  if ("buttonText" in req.body) fields["doughnuts.buttonText"] = String(req.body.buttonText ?? "").trim() || PROMO_DEFAULTS.buttonText;
  if ("image" in req.body) fields["doughnuts.image"] = String(req.body.image ?? "").trim() || PROMO_DEFAULTS.image;
  for (const [key, value] of Object.entries(fields)) {
    await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }
  res.json(await getPromo());
});
