import { Router } from "express";
import { requireAdmin } from "../auth";
import { prisma } from "../db";
import { actorCtx, audit } from "../lib/activity";

export const rewardsRouter = Router();

rewardsRouter.use(requireAdmin);

const VALID_TYPES = ["FREE_ITEM", "DISCOUNT"];

function cleanBody(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  if ("name" in body) data.name = String(body.name ?? "").trim();
  if ("description" in body) data.description = String(body.description ?? "");
  if ("category" in body) data.category = String(body.category ?? "").trim() || null;
  if ("cost" in body) data.cost = Math.max(0, Math.round(Number(body.cost) || 0));
  if ("type" in body) data.type = VALID_TYPES.includes(String(body.type)) ? body.type : "FREE_ITEM";
  if ("icon" in body) data.icon = String(body.icon ?? "🎁") || "🎁";
  if ("image" in body) data.image = String(body.image ?? "").trim() || null;
  if ("redeemMethod" in body) data.redeemMethod = String(body.redeemMethod ?? "").trim() || "Show voucher at counter";
  if ("isActive" in body) data.isActive = Boolean(body.isActive);
  if ("isAvailable" in body) data.isAvailable = Boolean(body.isAvailable);
  if ("sortOrder" in body) data.sortOrder = Math.round(Number(body.sortOrder) || 0);
  return data;
}

// GET /api/rewards — all rewards (including inactive), grouped-friendly order
rewardsRouter.get("/", async (_req, res) => {
  const rewards = await prisma.reward.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { cost: "asc" }],
    include: { _count: { select: { redemptions: true } } },
  });
  res.json(rewards);
});

// POST /api/rewards — create
rewardsRouter.post("/", async (req, res) => {
  const data = cleanBody(req.body);
  if (!data.name) return res.status(400).json({ error: "A reward name is required." });
  if (!data.cost) return res.status(400).json({ error: "Set how many beans this reward costs." });
  const reward = await prisma.reward.create({ data: data as never });
  await audit(actorCtx(req), { section: "Loyalty", action: "reward_created", description: `Created reward "${reward.name}" (${reward.cost} beans)`, entity: "Reward", entityId: reward.id, entityName: reward.name, newValue: { cost: reward.cost } });
  res.status(201).json(reward);
});

// PATCH /api/rewards/:id — update
rewardsRouter.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const data = cleanBody(req.body);
  const before = await prisma.reward.findUnique({ where: { id } });
  const reward = await prisma.reward.update({ where: { id }, data });
  const costChanged = before && "cost" in data && before.cost !== reward.cost;
  await audit(actorCtx(req), {
    section: "Loyalty", action: "reward_edited",
    description: costChanged ? `Reward "${reward.name}" cost ${before!.cost} → ${reward.cost} beans` : `Edited reward "${reward.name}" (${Object.keys(data).join(", ")})`,
    entity: "Reward", entityId: id, entityName: reward.name,
    oldValue: costChanged ? { cost: before!.cost } : undefined, newValue: costChanged ? { cost: reward.cost } : undefined,
  });
  res.json(reward);
});

// DELETE /api/rewards/:id — remove (past redemptions keep their snapshot)
rewardsRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const doomed = await prisma.reward.findUnique({ where: { id } });
  await prisma.redemption.updateMany({ where: { rewardId: id }, data: { rewardId: null } });
  await prisma.reward.delete({ where: { id } });
  if (doomed) await audit(actorCtx(req), { section: "Loyalty", action: "reward_deleted", description: `Deleted reward "${doomed.name}"`, entity: "Reward", entityId: id, entityName: doomed.name });
  res.json({ ok: true });
});
