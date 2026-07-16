import { Router } from "express";
import { requireAdmin } from "../auth";
import { prisma } from "../db";
import { actorCtx, audit } from "../lib/activity";

export const addonsRouter = Router();

// GET /api/addons/for/:menuItemId  (public) — add-on groups applicable to a drink
addonsRouter.get("/for/:menuItemId", async (req, res) => {
  const id = Number(req.params.menuItemId);
  const item = await prisma.menuItem.findUnique({ where: { id } });
  if (!item) return res.json([]);

  const groups = await prisma.addonGroup.findMany({
    where: {
      isAvailable: true,
      assignments: { some: { OR: [{ menuItemId: id }, { category: item.category }] } },
    },
    include: {
      addons: { where: { isAvailable: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
    },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  // Drop groups that ended up with no available add-ons.
  res.json(groups.filter((g) => g.addons.length > 0));
});

// GET /api/addons/coverage  (public) — which items/categories have any add-on
// group, so the register knows when tapping a product should open the customizer.
addonsRouter.get("/coverage", async (_req, res) => {
  const assignments = await prisma.addonAssignment.findMany({
    where: { group: { isAvailable: true, addons: { some: { isAvailable: true } } } },
    select: { menuItemId: true, category: true },
  });
  res.json({
    itemIds: [...new Set(assignments.map((a) => a.menuItemId).filter((x): x is number => x != null))],
    categories: [...new Set(assignments.map((a) => a.category).filter((x): x is string => x != null))],
  });
});

// ---- Admin ----
addonsRouter.use(requireAdmin);

// GET /api/addons/groups — all groups with their add-ons & assignments
addonsRouter.get("/groups", async (_req, res) => {
  const groups = await prisma.addonGroup.findMany({
    include: {
      addons: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      assignments: true,
    },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  res.json(groups);
});

function cleanGroup(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  if ("name" in body) data.name = String(body.name ?? "").trim();
  if ("selection" in body) data.selection = body.selection === "SINGLE" ? "SINGLE" : "MULTIPLE";
  if ("minSelect" in body) data.minSelect = Math.max(0, Math.round(Number(body.minSelect) || 0));
  if ("maxSelect" in body) data.maxSelect = Math.max(0, Math.round(Number(body.maxSelect) || 0));
  if ("isAvailable" in body) data.isAvailable = Boolean(body.isAvailable);
  if ("sortOrder" in body) data.sortOrder = Math.round(Number(body.sortOrder) || 0);
  // A SINGLE group can never allow more than one selection.
  if (data.selection === "SINGLE") data.maxSelect = 1;
  return data;
}

// POST /api/addons/groups  { name, selection, minSelect?, maxSelect? }
addonsRouter.post("/groups", async (req, res) => {
  const data = cleanGroup(req.body);
  if (!data.name) return res.status(400).json({ error: "A group name is required." });
  const group = await prisma.addonGroup.create({ data: data as never });
  await audit(actorCtx(req), {
    section: "Menu",
    action: "addon_group_created",
    description: `Created add-on group "${group.name}"`,
    entity: "AddonGroup",
    entityId: group.id,
    entityName: group.name,
  });
  res.status(201).json(group);
});

// PATCH /api/addons/groups/:id
addonsRouter.patch("/groups/:id", async (req, res) => {
  const id = Number(req.params.id);
  const data = cleanGroup(req.body);
  const before = await prisma.addonGroup.findUnique({ where: { id } });
  const group = await prisma.addonGroup.update({ where: { id }, data });
  const actor = actorCtx(req);
  if (before && "isAvailable" in data && before.isAvailable !== group.isAvailable)
    await audit(actor, {
      section: "Menu",
      action: group.isAvailable ? "addon_group_enabled" : "addon_group_disabled",
      description: `Add-on group "${group.name}" ${group.isAvailable ? "enabled" : "disabled"}`,
      entity: "AddonGroup",
      entityId: id,
      entityName: group.name,
    });
  else
    await audit(actor, {
      section: "Menu",
      action: "addon_group_edited",
      description: `Edited add-on group "${group.name}"`,
      entity: "AddonGroup",
      entityId: id,
      entityName: group.name,
    });
  res.json(group);
});

// DELETE /api/addons/groups/:id  (cascades add-ons & assignments)
addonsRouter.delete("/groups/:id", async (req, res) => {
  const id = Number(req.params.id);
  const doomed = await prisma.addonGroup.findUnique({ where: { id } });
  await prisma.addonGroup.delete({ where: { id } });
  if (doomed)
    await audit(actorCtx(req), {
      section: "Menu",
      action: "addon_group_deleted",
      description: `Deleted add-on group "${doomed.name}"`,
      entity: "AddonGroup",
      entityId: id,
      entityName: doomed.name,
    });
  res.json({ ok: true });
});

// POST /api/addons/groups/:id/addons  { name, price, maxQuantity }
addonsRouter.post("/groups/:id/addons", async (req, res) => {
  const name = String(req.body.name ?? "").trim();
  if (!name) return res.status(400).json({ error: "An add-on name is required." });
  const addon = await prisma.addon.create({
    data: {
      groupId: Number(req.params.id),
      name,
      price: Math.max(0, Number(req.body.price) || 0),
      maxQuantity: Math.max(1, Math.round(Number(req.body.maxQuantity) || 1)),
    },
  });
  await audit(actorCtx(req), {
    section: "Menu",
    action: "addon_created",
    description: `Created add-on "${addon.name}" ($${addon.price.toFixed(2)})`,
    entity: "Addon",
    entityId: addon.id,
    entityName: addon.name,
    newValue: { price: addon.price },
  });
  res.status(201).json(addon);
});

// PATCH /api/addons/:id
addonsRouter.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const data: Record<string, unknown> = {};
  if ("name" in req.body) data.name = String(req.body.name ?? "").trim();
  if ("price" in req.body) data.price = Math.max(0, Number(req.body.price) || 0);
  if ("maxQuantity" in req.body) data.maxQuantity = Math.max(1, Math.round(Number(req.body.maxQuantity) || 1));
  if ("isAvailable" in req.body) data.isAvailable = Boolean(req.body.isAvailable);
  if ("sortOrder" in req.body) data.sortOrder = Math.round(Number(req.body.sortOrder) || 0);
  const before = await prisma.addon.findUnique({ where: { id } });
  const addon = await prisma.addon.update({ where: { id }, data });
  const actor = actorCtx(req);
  if (before && "price" in data && before.price !== addon.price)
    await audit(actor, {
      section: "Menu",
      action: "addon_price_changed",
      description: `Add-on "${addon.name}" $${before.price.toFixed(2)} → $${addon.price.toFixed(2)}`,
      entity: "Addon",
      entityId: id,
      entityName: addon.name,
      oldValue: { price: before.price },
      newValue: { price: addon.price },
    });
  if (before && "isAvailable" in data && before.isAvailable !== addon.isAvailable)
    await audit(actor, {
      section: "Menu",
      action: addon.isAvailable ? "addon_enabled" : "addon_disabled",
      description: `Add-on "${addon.name}" ${addon.isAvailable ? "enabled" : "disabled"}`,
      entity: "Addon",
      entityId: id,
      entityName: addon.name,
    });
  const priceOrAvail =
    ("price" in data && before && before.price !== addon.price) || ("isAvailable" in data && before && before.isAvailable !== addon.isAvailable);
  if (!priceOrAvail && ("name" in data || "maxQuantity" in data))
    await audit(actor, {
      section: "Menu",
      action: "addon_edited",
      description: `Edited add-on "${addon.name}"`,
      entity: "Addon",
      entityId: id,
      entityName: addon.name,
    });
  res.json(addon);
});

// DELETE /api/addons/:id
addonsRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const doomed = await prisma.addon.findUnique({ where: { id } });
  await prisma.addon.delete({ where: { id } });
  if (doomed)
    await audit(actorCtx(req), {
      section: "Menu",
      action: "addon_deleted",
      description: `Deleted add-on "${doomed.name}"`,
      entity: "Addon",
      entityId: id,
      entityName: doomed.name,
    });
  res.json({ ok: true });
});

// POST /api/addons/assignments  { groupId, menuItemId? , category? }
addonsRouter.post("/assignments", async (req, res) => {
  const groupId = Number(req.body.groupId);
  const menuItemId = req.body.menuItemId ? Number(req.body.menuItemId) : null;
  const category = req.body.category ? String(req.body.category) : null;
  if (!groupId || (!menuItemId && !category)) {
    return res.status(400).json({ error: "Pick a group and a drink or category." });
  }
  const assignment = await prisma.addonAssignment.create({ data: { groupId, menuItemId, category } });
  const group = await prisma.addonGroup.findUnique({ where: { id: groupId } });
  const target = category ? `category "${category}"` : `product #${menuItemId}`;
  const targetName = menuItemId ? (await prisma.menuItem.findUnique({ where: { id: menuItemId }, select: { name: true } }))?.name : null;
  await audit(actorCtx(req), {
    section: "Menu",
    action: category ? "addon_category_rule_added" : "addon_product_rule_added",
    description: `Add-on group "${group?.name ?? groupId}" enabled for ${targetName ? `"${targetName}"` : target}`,
    entity: "AddonAssignment",
    entityId: assignment.id,
    entityName: group?.name ?? null,
    newValue: { group: group?.name, menuItem: targetName, category },
  });
  res.status(201).json(assignment);
});

// DELETE /api/addons/assignments/:id
addonsRouter.delete("/assignments/:id", async (req, res) => {
  const id = Number(req.params.id);
  const doomed = await prisma.addonAssignment.findUnique({ where: { id }, include: { group: true } });
  await prisma.addonAssignment.delete({ where: { id } });
  if (doomed)
    await audit(actorCtx(req), {
      section: "Menu",
      action: doomed.category ? "addon_category_rule_removed" : "addon_product_rule_removed",
      description: `Add-on group "${doomed.group?.name ?? doomed.groupId}" removed from ${doomed.category ? `category "${doomed.category}"` : `product #${doomed.menuItemId}`}`,
      entity: "AddonAssignment",
      entityId: id,
      entityName: doomed.group?.name ?? null,
    });
  res.json({ ok: true });
});
