import { Router } from "express";
import { requireAdmin } from "../auth";
import { prisma } from "../db";
import { DOUGHNUT_CATEGORY } from "../lib/constants";
import { hansonMap, hansonToday } from "../lib/hanson";
import { outMenuItem } from "../lib/serialize";

export const doughnutsRouter = Router();

const PROMO_DEFAULTS = {
  visible: true,
  title: "Today's Hanson Doughnuts",
  description: "Discover today's freshly available doughnut selection at Bean Avenue.",
  buttonText: "View Today's Doughnuts",
  image: "/hanson-doughnuts-logo.jpg",
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

// GET /api/doughnuts  (public) — today's visible doughnuts, annotated with live
// stock. Tracked (produced today) → remaining + soldOut; untracked → available.
doughnutsRouter.get("/", async (_req, res) => {
  const items = await prisma.menuItem.findMany({
    where: { category: DOUGHNUT_CATEGORY, isHidden: false, availableToday: true },
    orderBy: [{ sortOrder: "asc" }],
  });
  const map = await hansonMap(hansonToday());
  res.json(items.map((i) => {
    const a = map.get(i.id);
    return { ...outMenuItem(i), tracked: !!a, remaining: a ? a.remaining : null, soldOut: a ? a.remaining <= 0 : false, madeToday: a ? a.made : null };
  }));
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

// GET /api/doughnuts/production?date=YYYY-MM-DD  (admin) — Hanson daily stock.
doughnutsRouter.get("/production", requireAdmin, async (req, res) => {
  const date = String((req.query as Record<string, string>).date || "").trim() || hansonToday();
  const items = await prisma.menuItem.findMany({
    where: { category: DOUGHNUT_CATEGORY, isHidden: false },
    orderBy: [{ sortOrder: "asc" }],
    select: { id: true, name: true, subcategory: true, price: true, availableToday: true },
  });
  const map = await hansonMap(date);
  const rows = items.map((i) => {
    const a = map.get(i.id);
    return { menuItemId: i.id, name: i.name, subcategory: i.subcategory || "Other", price: i.price, availableToday: i.availableToday, made: a?.made ?? 0, sold: a?.sold ?? 0, remaining: a ? a.remaining : 0, tracked: !!a };
  });
  const summary = {
    made: rows.reduce((s, r) => s + r.made, 0),
    sold: rows.reduce((s, r) => s + r.sold, 0),
    remaining: rows.reduce((s, r) => s + r.remaining, 0),
    revenue: Math.round(rows.reduce((s, r) => s + r.sold * r.price, 0) * 100) / 100,
  };
  res.json({ date, today: hansonToday(), rows, summary });
});

// POST /api/doughnuts/production  (admin) — set today's "made" per doughnut.
//   { date?, entries: [{ menuItemId, made }], createdBy? }
doughnutsRouter.post("/production", requireAdmin, async (req, res) => {
  const date = String(req.body?.date || "").trim() || hansonToday();
  const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
  const createdBy = String(req.body?.createdBy ?? "Admin").trim() || "Admin";
  for (const e of entries) {
    const menuItemId = Number(e.menuItemId);
    if (!menuItemId) continue;
    const made = Math.max(0, Math.round(Number(e.made) || 0));
    await prisma.hansonProduction.upsert({
      where: { menuItemId_date: { menuItemId, date } },
      create: { menuItemId, date, made, sold: 0, createdBy },
      update: { made },
    });
  }
  res.json({ ok: true, date });
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
