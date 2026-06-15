import { Router } from "express";
import { prisma } from "../db";
import { nextTierInfo, REWARDS, TIERS, tierFor } from "../lib/helpers";

export const loyaltyRouter = Router();

async function accountResponse(phone: string, extra: Record<string, unknown> = {}) {
  const customer = await prisma.customer.findUnique({
    where: { phone },
    include: { transactions: { orderBy: { createdAt: "desc" }, take: 50 } },
  });
  if (!customer) return null;
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    beanBalance: customer.beanBalance,
    lifetimeBeans: customer.lifetimeBeans,
    tier: customer.tier,
    nextTier: nextTierInfo(customer.lifetimeBeans),
    transactions: customer.transactions,
    ...extra,
  };
}

// GET /api/loyalty/rewards  (public)
loyaltyRouter.get("/rewards", (_req, res) => {
  res.json({ rewards: REWARDS, tiers: TIERS });
});

// GET /api/loyalty/account/:phone  (public)
loyaltyRouter.get("/account/:phone", async (req, res) => {
  const account = await accountResponse(req.params.phone);
  if (!account) return res.status(404).json({ error: "We couldn't find a member with that phone number." });
  res.json(account);
});

// POST /api/loyalty/join  (public)
loyaltyRouter.post("/join", async (req, res) => {
  const { name, phone } = req.body;
  if (!phone) return res.status(400).json({ error: "A phone number is required." });
  const existing = await prisma.customer.findUnique({ where: { phone } });
  if (existing) {
    return res.json(await accountResponse(phone, { alreadyMember: true }));
  }
  await prisma.customer.create({ data: { name: name || "Member", phone, tier: tierFor(0) } });
  res.status(201).json(await accountResponse(phone, { alreadyMember: false }));
});

// POST /api/loyalty/redeem  (public)
loyaltyRouter.post("/redeem", async (req, res) => {
  const { phone, rewardId } = req.body;
  const reward = REWARDS.find((r) => r.id === rewardId);
  if (!reward) return res.status(400).json({ error: "Unknown reward." });
  const customer = await prisma.customer.findUnique({ where: { phone } });
  if (!customer) return res.status(404).json({ error: "Member not found." });
  if (customer.beanBalance < reward.cost) {
    return res.status(400).json({ error: "Not enough beans for that reward yet." });
  }
  await prisma.customer.update({
    where: { id: customer.id },
    data: { beanBalance: customer.beanBalance - reward.cost },
  });
  await prisma.loyaltyTransaction.create({
    data: {
      customerId: customer.id,
      type: "REDEEM",
      amount: -reward.cost,
      source: "Reward",
      note: `Redeemed: ${reward.name}`,
    },
  });
  res.json(await accountResponse(phone, { message: `Redeemed: ${reward.name} 🎉` }));
});
