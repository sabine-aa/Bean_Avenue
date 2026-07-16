import { Router } from "express";
import { optionalCustomer, requireAdmin } from "../auth";
import { prisma } from "../db";
import { actorFrom, logActivity } from "../lib/activity";
import { quoteDelivery } from "../lib/delivery";
import { round2 } from "../lib/helpers";
import { outOrder } from "../lib/serialize";
import { getSettingsMap, saveSettings, storefrontConfig } from "../lib/settings";

export const deliveryRouter = Router();

// ---- Public ----

// GET /api/delivery/config — storefront config the checkout page needs
deliveryRouter.get("/config", async (_req, res) => {
  res.json(await storefrontConfig());
});

// POST /api/delivery/quote  { area, lat?, lng?, subtotal } — check availability + fee
deliveryRouter.post("/quote", async (req, res) => {
  const subtotal = round2(Number(req.body.subtotal) || 0);
  const quote = await quoteDelivery({ area: req.body.area, lat: Number(req.body.lat), lng: Number(req.body.lng) }, subtotal);
  res.json(quote);
});

// ---- Admin: zones ----

deliveryRouter.get("/zones", requireAdmin, async (_req, res) => {
  const zones = await prisma.deliveryZone.findMany({ orderBy: { sortOrder: "asc" } });
  res.json(zones);
});

function cleanZone(body: Record<string, unknown>) {
  const numOrNull = (v: unknown) => {
    const n = Number(v);
    return v === "" || v == null || !Number.isFinite(n) ? null : n;
  };
  return {
    name: String(body.name ?? "")
      .trim()
      .slice(0, 120),
    fee: Math.max(0, round2(Number(body.fee) || 0)),
    minOrder: Math.max(0, round2(Number(body.minOrder) || 0)),
    estimatedTime: String(body.estimatedTime ?? "")
      .trim()
      .slice(0, 60),
    maxDistanceKm: numOrNull(body.maxDistanceKm),
    centerLat: numOrNull(body.centerLat),
    centerLng: numOrNull(body.centerLng),
    isAvailable: body.isAvailable !== false,
    sortOrder: Number(body.sortOrder) || 0,
  };
}

deliveryRouter.post("/zones", requireAdmin, async (req, res) => {
  const data = cleanZone(req.body);
  if (!data.name) return res.status(400).json({ error: "Zone name is required." });
  const zone = await prisma.deliveryZone.create({ data });
  await logActivity(actorFrom(req), "ZONE_SAVE", `Created zone "${zone.name}"`, "zone", zone.id);
  res.status(201).json(zone);
});

deliveryRouter.patch("/zones/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const data = cleanZone(req.body);
  if (!data.name) return res.status(400).json({ error: "Zone name is required." });
  const zone = await prisma.deliveryZone.update({ where: { id }, data });
  await logActivity(actorFrom(req), "ZONE_SAVE", `Updated zone "${zone.name}"`, "zone", zone.id);
  res.json(zone);
});

deliveryRouter.delete("/zones/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await prisma.order.updateMany({ where: { zoneId: id }, data: { zoneId: null } });
  await prisma.deliveryZone.delete({ where: { id } });
  await logActivity(actorFrom(req), "ZONE_SAVE", `Deleted zone #${id}`, "zone", id);
  res.json({ ok: true });
});

// ---- Admin: settings (enable/pause/hours/free-threshold/payment methods/tax/pickup) ----

deliveryRouter.get("/settings", requireAdmin, async (_req, res) => {
  res.json(await getSettingsMap());
});

deliveryRouter.patch("/settings", requireAdmin, async (req, res) => {
  await saveSettings(req.body as Record<string, unknown>);
  await logActivity(actorFrom(req), "SETTINGS_SAVE", "Updated delivery/payment settings", "settings");
  res.json(await getSettingsMap());
});

// ---- Admin: delivery orders + revenue ----

// GET /api/delivery/orders?scope=active|completed|cancelled
deliveryRouter.get("/orders", requireAdmin, async (req, res) => {
  const scope = String(req.query.scope ?? "active");
  const active = ["RECEIVED", "ACCEPTED", "PREPARING", "READY_FOR_DELIVERY", "OUT_FOR_DELIVERY"];
  let where: Record<string, unknown> = { fulfillment: "DELIVERY" };
  if (scope === "active") where = { ...where, status: { in: active } };
  else if (scope === "completed") where = { ...where, status: "DELIVERED" };
  else if (scope === "cancelled") where = { ...where, status: "CANCELLED" };
  const orders = await prisma.order.findMany({ where, include: { items: true }, orderBy: { createdAt: "desc" } });
  res.json(orders.map(outOrder));
});

// GET /api/delivery/revenue — collected delivery fees + delivery order totals
deliveryRouter.get("/revenue", requireAdmin, async (_req, res) => {
  const delivered = await prisma.order.findMany({ where: { fulfillment: "DELIVERY", status: { not: "CANCELLED" } } });
  const fees = round2(delivered.reduce((s, o) => s + o.deliveryFee, 0));
  const sales = round2(delivered.reduce((s, o) => s + o.total, 0));
  const completed = delivered.filter((o) => o.status === "DELIVERED").length;
  res.json({ deliveryFeesCollected: fees, deliverySales: sales, deliveryOrders: delivered.length, completedDeliveries: completed });
});
