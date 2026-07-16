import { Router } from "express";
import { requireAdmin, requireCustomer } from "../auth";
import { prisma } from "../db";
import { audit } from "../lib/activity";
import { accountResponse } from "../lib/account";
import { activeWindow, computeBirthdayReward, genBirthdayCode, getBirthdaySettings } from "../lib/birthday";
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

// GET /api/loyalty/me — the logged-in customer's full account. Also lazily fires
// the one-per-year "happy birthday" notification when the window is open.
loyaltyRouter.get("/me", requireCustomer, async (req, res) => {
  const customer = await prisma.customer.findUnique({ where: { id: req.customerId! } });
  if (!customer) return res.status(404).json({ error: "Account not found." });

  const reward = await computeBirthdayReward(customer);
  if (reward.available && customer.birthday) {
    const s = await getBirthdaySettings();
    const win = activeWindow(customer.birthday, s);
    if (win && customer.birthdayNotifiedYear !== win.year) {
      await prisma.customer.update({ where: { id: customer.id }, data: { birthdayNotifiedYear: win.year } });
      await notify(customer.id, {
        type: "REWARD",
        title: "Happy Birthday! 🎂",
        message: "Happy Birthday! A free cupcake is waiting for you at Bean Avenue.",
        link: "/account?tab=rewards",
      });
    }
  }

  res.json(await accountResponse(req.customerId!));
});

// PATCH /api/loyalty/me  { name?, birthday? } — edit basic details.
// Birthday can be set ONCE; after that it's locked (changes go through support).
// Phone/email changes go through the verified link flow (see /api/auth/link/*).
loyaltyRouter.patch("/me", requireCustomer, async (req, res) => {
  const data: { name?: string; birthday?: Date; birthdaySetAt?: Date } = {};
  if ("name" in req.body) {
    const name = String(req.body.name ?? "").trim();
    if (!name) return res.status(400).json({ error: "Name can't be empty." });
    data.name = name;
  }
  if ("birthday" in req.body) {
    const raw = String(req.body.birthday ?? "").trim();
    const existing = await prisma.customer.findUnique({ where: { id: req.customerId! } });
    const alreadySet = !!existing?.birthday;
    if (raw) {
      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) return res.status(400).json({ error: "Enter a valid date of birth." });
      if (date.getTime() > Date.now()) return res.status(400).json({ error: "Your birthday can't be in the future." });
      // Only allow setting it the first time; ignore attempts to change a saved birthday.
      if (!alreadySet) {
        data.birthday = date;
        data.birthdaySetAt = new Date();
      } else if (existing!.birthday!.toISOString().slice(0, 10) !== raw.slice(0, 10)) {
        return res.status(400).json({
          error: "Your birthday is locked. Contact Bean Avenue support to change it.",
        });
      }
    } else if (alreadySet) {
      return res.status(400).json({ error: "Your birthday is locked. Contact Bean Avenue support to change it." });
    }
  }
  await prisma.customer.update({ where: { id: req.customerId! }, data });
  res.json(await accountResponse(req.customerId!));
});

// POST /api/loyalty/birthday/claim — mint the one-time birthday cupcake voucher.
loyaltyRouter.post("/birthday/claim", requireCustomer, async (req, res) => {
  const customer = await prisma.customer.findUnique({ where: { id: req.customerId! } });
  if (!customer) return res.status(404).json({ error: "Account not found." });

  const reward = await computeBirthdayReward(customer);
  if (!reward.available) {
    return res.status(400).json({ error: reward.reason || "Your birthday reward isn't available right now." });
  }

  const s = await getBirthdaySettings();
  const win = activeWindow(customer.birthday!, s)!;

  // Block a second account (same verified phone/email) claiming the same year.
  const dupe = await prisma.birthdayVoucher.findFirst({
    where: {
      year: win.year,
      customerId: { not: customer.id },
      OR: [...(customer.phone ? [{ phone: customer.phone }] : []), ...(customer.email ? [{ email: customer.email }] : [])],
    },
  });
  if (dupe) {
    return res.status(409).json({ error: "A birthday reward has already been issued for this phone/email this year." });
  }

  // Optionally deduct beans if the manager configured a cost (default 0 = complimentary).
  const deduct = Math.min(s.deductBeans, customer.beanBalance);

  try {
    await prisma.$transaction(async (tx) => {
      if (deduct > 0) {
        const balanceAfter = customer.beanBalance - deduct;
        await tx.customer.update({ where: { id: customer.id }, data: { beanBalance: balanceAfter } });
        await tx.loyaltyTransaction.create({
          data: {
            customerId: customer.id,
            type: "REDEEM",
            amount: -deduct,
            balanceAfter,
            source: "Birthday reward",
            note: `Birthday ${s.rewardName}`,
          },
        });
      }
      await tx.birthdayVoucher.create({
        data: {
          code: genBirthdayCode(),
          customerId: customer.id,
          customerName: customer.name || "Customer",
          phone: customer.phone,
          email: customer.email,
          rewardName: s.rewardName,
          year: win.year,
          expiresAt: win.end,
          deductedBeans: deduct,
        },
      });
    });
  } catch (e) {
    // Unique (customerId, year) — claimed in a parallel request.
    if ((e as { code?: string }).code === "P2002") {
      return res.status(409).json({ error: "You've already claimed this year's birthday reward." });
    }
    throw e;
  }

  await notify(customer.id, {
    type: "VOUCHER",
    title: "Birthday reward ready 🎂",
    message: `Your ${s.rewardName} voucher is ready — show it at the counter to claim your free cupcake.`,
    link: "/account?tab=rewards",
  });

  res.json(await accountResponse(customer.id, { message: "Birthday cupcake voucher created! 🎂" }));
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

  await audit(
    { actorId: null, actorName: customer.name || customer.phone || "Customer", actorRole: "Customer", source: "Website" },
    {
      section: "Loyalty",
      action: "reward_redeemed",
      description: `${customer.name || customer.phone} redeemed ${reward.name} for ${reward.cost} beans (${code})`,
      entity: "Redemption",
      entityId: code,
      entityName: reward.name,
      newValue: { cost: reward.cost, balanceAfter },
    },
  );
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
