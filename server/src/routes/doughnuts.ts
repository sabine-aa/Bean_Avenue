import { Router } from "express";
import { requireAdmin } from "../auth";
import { prisma } from "../db";
import { actorCtx, audit } from "../lib/activity";
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
  res.json(
    items.map((i) => {
      const a = map.get(i.id);
      return { ...outMenuItem(i), tracked: !!a, remaining: a ? a.remaining : null, soldOut: a ? a.remaining <= 0 : false, madeToday: a ? a.made : null };
    }),
  );
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

const LEFTOVER_ACTIONS = ["WASTED", "STAFF", "DISCOUNTED", "CARRIED"];
const round2 = (n: number) => Math.round(n * 100) / 100;

// GET /api/doughnuts/production?date=YYYY-MM-DD  (admin) — Hanson daily stock +
// end-of-day figures (made/sold/leftover/wasted/revenue, closed state).
doughnutsRouter.get("/production", requireAdmin, async (req, res) => {
  const date = String((req.query as Record<string, string>).date || "").trim() || hansonToday();
  const items = await prisma.menuItem.findMany({
    where: { category: DOUGHNUT_CATEGORY, isHidden: false },
    orderBy: [{ sortOrder: "asc" }],
    select: { id: true, name: true, subcategory: true, price: true, availableToday: true },
  });
  const prod = await prisma.hansonProduction.findMany({ where: { date } });
  const pmap = new Map(prod.map((p) => [p.menuItemId, p]));

  // Suggested quantities from the prior 14 days' sales (avg sold, nudged by
  // sell-through: often-sold-out → make more; often-leftover → make fewer).
  const target = new Date(date + "T12:00:00Z");
  const from14 = new Date(target.getTime() - 14 * 86400000).toISOString().slice(0, 10);
  const yesterday = new Date(target.getTime() - 86400000).toISOString().slice(0, 10);
  const hist = await prisma.hansonProduction.findMany({ where: { date: { gte: from14, lte: yesterday } } });
  const hmap = new Map<number, { sold: number; made: number; days: number }>();
  for (const p of hist) {
    const a = hmap.get(p.menuItemId) ?? { sold: 0, made: 0, days: 0 };
    a.sold += p.sold;
    a.made += p.made;
    a.days++;
    hmap.set(p.menuItemId, a);
  }
  const suggest = (id: number): number => {
    const a = hmap.get(id);
    if (!a || a.days === 0) return 0;
    const avgSold = a.sold / a.days;
    const st = a.made > 0 ? a.sold / a.made : 0;
    const factor = st >= 0.9 ? 1.2 : st <= 0.4 ? 0.85 : 1;
    return Math.max(0, Math.round(avgSold * factor));
  };

  const rows = items.map((i) => {
    const p = pmap.get(i.id);
    const made = p?.made ?? 0,
      sold = p?.sold ?? 0;
    const leftover = Math.max(0, made - sold);
    return {
      menuItemId: i.id,
      name: i.name,
      subcategory: i.subcategory || "Other",
      price: i.price,
      availableToday: i.availableToday,
      made,
      sold,
      remaining: leftover,
      leftover,
      wasted: p?.wasted ?? 0,
      leftoverAction: p?.leftoverAction ?? null,
      closed: p?.closed ?? false,
      revenue: round2(sold * i.price),
      tracked: !!p,
      suggested: suggest(i.id),
    };
  });
  const tracked = rows.filter((r) => r.tracked);
  const summary = {
    made: rows.reduce((s, r) => s + r.made, 0),
    sold: rows.reduce((s, r) => s + r.sold, 0),
    remaining: rows.reduce((s, r) => s + r.remaining, 0),
    leftover: rows.reduce((s, r) => s + r.leftover, 0),
    revenue: round2(rows.reduce((s, r) => s + r.sold * r.price, 0)),
    leftoverValue: round2(rows.reduce((s, r) => s + r.leftover * r.price, 0)),
    wasteValue: round2(rows.filter((r) => r.leftoverAction === "WASTED").reduce((s, r) => s + r.wasted * r.price, 0)),
  };
  const dayClosed = tracked.length > 0 && tracked.every((r) => r.closed);
  res.json({ date, today: hansonToday(), rows, summary, dayClosed });
});

// POST /api/doughnuts/production/close  (admin) — close the day: record each
// doughnut's leftover + how it was handled.  { date, entries:[{menuItemId, leftoverAction}] }
doughnutsRouter.post("/production/close", requireAdmin, async (req, res) => {
  const date = String(req.body?.date || "").trim() || hansonToday();
  const entries: { menuItemId: number; leftoverAction?: string }[] = Array.isArray(req.body?.entries) ? req.body.entries : [];
  const actionOf = new Map(entries.map((e) => [Number(e.menuItemId), String(e.leftoverAction ?? "WASTED").toUpperCase()]));
  const prod = await prisma.hansonProduction.findMany({ where: { date } });
  for (const p of prod) {
    const leftover = Math.max(0, p.made - p.sold);
    let action = actionOf.get(p.menuItemId) ?? "WASTED";
    if (!LEFTOVER_ACTIONS.includes(action)) action = "WASTED";
    await prisma.hansonProduction.update({ where: { id: p.id }, data: { wasted: leftover, leftoverAction: action, closed: true } });
  }
  const totalWaste = prod.reduce((n, p) => n + Math.max(0, p.made - p.sold), 0);
  await audit(actorCtx(req), {
    section: "Hanson",
    action: "day_closed",
    description: `End of day ${date} closed — ${prod.length} doughnut lines, ${totalWaste} leftover recorded`,
    entity: "HansonProduction",
    entityName: date,
    newValue: { lines: prod.length, leftover: totalWaste },
  });
  res.json({ ok: true, date, closed: prod.length });
});

// POST /api/doughnuts/production/reopen  (admin) — undo an end-of-day close.
doughnutsRouter.post("/production/reopen", requireAdmin, async (req, res) => {
  const date = String(req.body?.date || "").trim() || hansonToday();
  await prisma.hansonProduction.updateMany({ where: { date }, data: { closed: false, wasted: 0, leftoverAction: null } });
  res.json({ ok: true, date });
});

// GET /api/doughnuts/reports?from=&to=  (admin) — Hanson performance over a range.
doughnutsRouter.get("/reports", requireAdmin, async (req, res) => {
  const q = req.query as Record<string, string>;
  const to = (q.to || "").trim() || hansonToday();
  const from = (q.from || "").trim() || hansonToday(new Date(Date.now() - 6 * 86400000));
  const prod = await prisma.hansonProduction.findMany({ where: { date: { gte: from, lte: to } } });
  const items = await prisma.menuItem.findMany({
    where: { category: DOUGHNUT_CATEGORY },
    select: { id: true, name: true, subcategory: true, price: true, costPrice: true },
  });
  const imap = new Map(items.map((i) => [i.id, i]));

  // Per-doughnut aggregate over the range.
  const agg = new Map<number, { made: number; sold: number; wasteQty: number }>();
  for (const p of prod) {
    const a = agg.get(p.menuItemId) ?? { made: 0, sold: 0, wasteQty: 0 };
    a.made += p.made;
    a.sold += p.sold;
    if (p.leftoverAction === "WASTED") a.wasteQty += p.wasted;
    agg.set(p.menuItemId, a);
  }

  const byDoughnut = [...agg.entries()]
    .map(([id, a]) => {
      const it = imap.get(id);
      const price = it?.price ?? 0,
        cost = it?.costPrice ?? 0;
      const leftover = Math.max(0, a.made - a.sold);
      const revenue = round2(a.sold * price);
      const cogs = round2(a.made * cost); // cost of everything made (sold + leftover)
      return {
        menuItemId: id,
        name: it?.name ?? "—",
        subcategory: it?.subcategory || "Other",
        price,
        cost,
        made: a.made,
        sold: a.sold,
        leftover,
        wasteQty: a.wasteQty,
        revenue,
        cogs,
        profit: round2(revenue - cogs),
        wasteValue: round2(a.wasteQty * price),
        wasteCost: round2(a.wasteQty * cost),
        sellThrough: a.made > 0 ? Math.round((a.sold / a.made) * 100) : null,
      };
    })
    .sort((x, y) => y.sold - x.sold);

  const byCategory = [
    ...byDoughnut
      .reduce((m, r) => {
        const c = m.get(r.subcategory) ?? { subcategory: r.subcategory, made: 0, sold: 0, revenue: 0, profit: 0, wasteQty: 0, wasteValue: 0 };
        c.made += r.made;
        c.sold += r.sold;
        c.revenue = round2(c.revenue + r.revenue);
        c.profit = round2(c.profit + r.profit);
        c.wasteQty += r.wasteQty;
        c.wasteValue = round2(c.wasteValue + r.wasteValue);
        return m.set(r.subcategory, c);
      }, new Map<string, { subcategory: string; made: number; sold: number; revenue: number; profit: number; wasteQty: number; wasteValue: number }>())
      .values(),
  ];

  const totMade = byDoughnut.reduce((s, r) => s + r.made, 0);
  const totSold = byDoughnut.reduce((s, r) => s + r.sold, 0);
  const hasCost = byDoughnut.some((r) => r.cost > 0);
  const totals = {
    made: totMade,
    sold: totSold,
    leftover: byDoughnut.reduce((s, r) => s + r.leftover, 0),
    revenue: round2(byDoughnut.reduce((s, r) => s + r.revenue, 0)),
    cogs: round2(byDoughnut.reduce((s, r) => s + r.cogs, 0)),
    profit: round2(byDoughnut.reduce((s, r) => s + r.profit, 0)),
    wasteQty: byDoughnut.reduce((s, r) => s + r.wasteQty, 0),
    wasteValue: round2(byDoughnut.reduce((s, r) => s + r.wasteValue, 0)),
    wasteCost: round2(byDoughnut.reduce((s, r) => s + r.wasteCost, 0)),
    sellThrough: totMade > 0 ? Math.round((totSold / totMade) * 100) : null,
    days: new Set(prod.map((p) => p.date)).size,
    hasCost,
  };
  const rated = byDoughnut.filter((r) => r.made > 0);
  const bestSellers = [...rated].sort((a, b) => b.sold - a.sold).slice(0, 6);
  const slowSellers = [...rated].sort((a, b) => (a.sellThrough ?? 0) - (b.sellThrough ?? 0)).slice(0, 6);

  res.json({ from, to, totals, byDoughnut, byCategory, bestSellers, slowSellers });
});

// GET /api/doughnuts/costs  (admin) — per-doughnut cost to make (for profit).
doughnutsRouter.get("/costs", requireAdmin, async (_req, res) => {
  const items = await prisma.menuItem.findMany({
    where: { category: DOUGHNUT_CATEGORY, isHidden: false },
    orderBy: [{ sortOrder: "asc" }],
    select: { id: true, name: true, subcategory: true, price: true, costPrice: true },
  });
  res.json(items.map((i) => ({ menuItemId: i.id, name: i.name, subcategory: i.subcategory || "Other", price: i.price, costPrice: i.costPrice })));
});

// POST /api/doughnuts/costs  (admin) — set per-doughnut cost.  { entries:[{menuItemId, costPrice}] }
doughnutsRouter.post("/costs", requireAdmin, async (req, res) => {
  const entries: { menuItemId: number; costPrice: number }[] = Array.isArray(req.body?.entries) ? req.body.entries : [];
  for (const e of entries) {
    const id = Number(e.menuItemId);
    if (!id) continue;
    await prisma.menuItem.update({ where: { id }, data: { costPrice: Math.max(0, round2(Number(e.costPrice) || 0)) } });
  }
  res.json({ ok: true });
});

// POST /api/doughnuts/production  (admin) — set today's "made" per doughnut.
//   { date?, entries: [{ menuItemId, made }], createdBy? }
doughnutsRouter.post("/production", requireAdmin, async (req, res) => {
  const date = String(req.body?.date || "").trim() || hansonToday();
  const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
  const createdBy = String(req.body?.createdBy ?? "Admin").trim() || "Admin";
  const changed: { id: number; made: number }[] = [];
  for (const e of entries) {
    const menuItemId = Number(e.menuItemId);
    if (!menuItemId) continue;
    const made = Math.max(0, Math.round(Number(e.made) || 0));
    await prisma.hansonProduction.upsert({
      where: { menuItemId_date: { menuItemId, date } },
      create: { menuItemId, date, made, sold: 0, createdBy },
      update: { made },
    });
    changed.push({ id: menuItemId, made });
  }
  if (changed.length) {
    const names = new Map(
      (await prisma.menuItem.findMany({ where: { id: { in: changed.map((c) => c.id) } }, select: { id: true, name: true } })).map((m) => [m.id, m.name]),
    );
    const summary = changed.map((c) => `${names.get(c.id) ?? `#${c.id}`} ${c.made}`).join(", ");
    await audit(actorCtx(req), {
      section: "Hanson",
      action: "production_entered",
      description: `Daily production for ${date}: ${summary}`,
      entity: "HansonProduction",
      entityName: date,
      newValue: changed,
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
