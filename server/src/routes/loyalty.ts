import { Router } from "express";
import { requireAdmin, requireCustomer } from "../auth";
import { prisma } from "../db";
import { accountResponse } from "../lib/account";
import { genNumber, TIERS } from "../lib/helpers";
import { notify } from "../lib/notify";

export const loyaltyRouter = Router();

// ---- Public ----

// GET /api/loyalty/rewards — visible rewards (grouped by category) + tiers
loyaltyRouter.get("/rewards", async (_req, res) => {
  const rewards = await prisma.reward.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { cost: "asc" }],
  });
  res.json({ rewards, tiers: TIERS });
});

// ---- Customer (token required) ----

// GET /api/loyalty/me — the logged-in customer's full account
loyaltyRouter.get("/me", requireCustomer, async (req, res) => {
  const account = await accountResponse(req.customerId!);
  if (!account) return res.status(404).json({ error: "Account not found." });
  res.json(account);
});

// PATCH /api/loyalty/me  { name?, birthday? } — edit basic details.
// Phone/email changes go through the verified link flow (see /api/auth/link/*).
loyaltyRouter.patch("/me", requireCustomer, async (req, res) => {
  const data: { name?: string; birthday?: Date | null } = {};
  if ("name" in req.body) {
    const name = String(req.body.name ?? "").trim();
    if (!name) return res.status(400).json({ error: "Name can't be empty." });
    data.name = name;
  }
  if ("birthday" in req.body) {
    const raw = String(req.body.birthday ?? "").trim();
    data.birthday = raw ? new Date(raw) : null;
  }
  await prisma.customer.update({ where: { id: req.customerId! }, data });
  res.json(await accountResponse(req.customerId!));
});

// POST /api/loyalty/redeem  { rewardId } — spend beans, create a counter voucher
loyaltyRouter.post("/redeem", requireCustomer, async (req, res) => {
  const rewardId = Number(req.body.rewardId);
  const reward = await prisma.reward.findUnique({ where: { id: rewardId } });
  if (!reward || !reward.isActive || !reward.isAvailable) {
    return res.status(400).json({ error: "That reward isn't available right now." });
  }

  const customer = await prisma.customer.findUnique({ where: { id: req.customerId! } });
  if (!customer) return res.status(404).json({ error: "Account not found." });
  if (customer.beanBalance < reward.cost) {
    return res.status(400).json({ error: "You don't have enough beans for that reward yet." });
  }

  const balanceAfter = customer.beanBalance - reward.cost;
  const code = genNumber("RDM");

  // Deduct beans, log the transaction, and mint the voucher together.
  await prisma.$transaction([
    prisma.customer.update({ where: { id: customer.id }, data: { beanBalance: balanceAfter } }),
    prisma.loyaltyTransaction.create({
      data: {
        customerId: customer.id,
        type: "REDEEM",
        amount: -reward.cost,
        balanceAfter,
        source: "Reward",
        refId: code,
        note: `Redeemed: ${reward.name}`,
      },
    }),
    prisma.redemption.create({
      data: {
        code,
        customerId: customer.id,
        rewardId: reward.id,
        rewardName: reward.name,
        cost: reward.cost,
      },
    }),
  ]);

  await notify(customer.id, {
    type: "REWARD",
    title: "Reward redeemed",
    message: `You redeemed ${reward.name} for ${reward.cost} beans.`,
    link: "/account?tab=rewards",
  });
  await notify(customer.id, {
    type: "VOUCHER",
    title: "Voucher ready",
    message: `Voucher ${code} created — show it at the counter to claim your ${reward.name}.`,
    link: "/account?tab=rewards",
  });

  res.json(await accountResponse(customer.id, { message: `Redeemed: ${reward.name} 🎉`, voucherCode: code }));
});

// ---- Admin (token required) ----

// GET /api/loyalty/ledger — every points transaction across all customers
loyaltyRouter.get("/ledger", requireAdmin, async (req, res) => {
  const type = String(req.query.type ?? "");
  const transactions = await prisma.loyaltyTransaction.findMany({
    where: type ? { type } : undefined,
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { customer: { select: { id: true, name: true, phone: true } } },
  });
  res.json(transactions);
});

// GET /api/loyalty/redemptions — vouchers, newest first (admin)
loyaltyRouter.get("/redemptions", requireAdmin, async (req, res) => {
  const status = String(req.query.status ?? "");
  const redemptions = await prisma.redemption.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { customer: { select: { id: true, name: true, phone: true } } },
  });
  res.json(redemptions);
});

// PATCH /api/loyalty/redemptions/:id  { status } — mark a voucher claimed/expired (admin)
loyaltyRouter.patch("/redemptions/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body.status ?? "");
  if (!["ACTIVE", "CLAIMED", "EXPIRED"].includes(status)) {
    return res.status(400).json({ error: "Invalid status." });
  }
  const redemption = await prisma.redemption.update({
    where: { id },
    data: { status, claimedAt: status === "CLAIMED" ? new Date() : null },
  });
  if (status === "CLAIMED") {
    await notify(redemption.customerId, {
      type: "VOUCHER",
      title: "Voucher used",
      message: `Your ${redemption.rewardName} voucher (${redemption.code}) was claimed. Enjoy!`,
      link: "/account?tab=rewards",
    });
  }
  res.json(redemption);
});
