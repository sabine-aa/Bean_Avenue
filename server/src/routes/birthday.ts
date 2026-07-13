import { Router } from "express";
import { requireAdmin } from "../auth";
import { prisma } from "../db";
import { actorCtx, audit } from "../lib/activity";
import {
  activeWindow,
  effectiveStatus,
  genBirthdayCode,
  getBirthdaySettings,
  saveBirthdaySettings,
} from "../lib/birthday";
import { notify } from "../lib/notify";

export const birthdayRouter = Router();
birthdayRouter.use(requireAdmin);

const withEffective = <T extends { status: string; expiresAt: Date }>(v: T) => ({
  ...v,
  effectiveStatus: effectiveStatus(v),
});

// GET /api/birthday/settings
birthdayRouter.get("/settings", async (_req, res) => {
  res.json(await getBirthdaySettings());
});

// POST /api/birthday/settings — update program configuration
birthdayRouter.post("/settings", async (req, res) => {
  res.json(await saveBirthdaySettings(req.body ?? {}));
});

// GET /api/birthday/vouchers?status= — issued vouchers, newest first
birthdayRouter.get("/vouchers", async (req, res) => {
  const status = String(req.query.status ?? "");
  const rows = await prisma.birthdayVoucher.findMany({
    where: status ? { status } : undefined,
    orderBy: { issuedAt: "desc" },
    take: 300,
    include: { customer: { select: { id: true, name: true, phone: true, email: true } } },
  });
  res.json(rows.map(withEffective));
});

// PATCH /api/birthday/vouchers/:id  { status, usedBy? } — staff marks used / cancel / revert
birthdayRouter.patch("/vouchers/:id", async (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body.status ?? "");
  if (!["AVAILABLE", "USED", "EXPIRED", "CANCELLED"].includes(status)) {
    return res.status(400).json({ error: "Invalid status." });
  }
  const data: Record<string, unknown> = { status };
  if (status === "USED") {
    data.usedAt = new Date();
    data.usedBy = String(req.body.usedBy ?? "").trim() || "Staff";
  } else if (status === "AVAILABLE") {
    data.usedAt = null;
    data.usedBy = null;
  }
  const beforeV = await prisma.birthdayVoucher.findUnique({ where: { id } });
  const voucher = await prisma.birthdayVoucher.update({ where: { id }, data });
  if (beforeV && beforeV.status !== voucher.status) {
    const act = status === "USED" ? "birthday_reward_used" : status === "CANCELLED" ? "birthday_reward_cancelled" : status === "AVAILABLE" ? "birthday_reward_reverted" : "birthday_reward_updated";
    await audit(actorCtx(req), { section: "Loyalty", action: act, description: `Birthday ${voucher.rewardName} (${voucher.code}) for ${voucher.customerName}: ${beforeV.status} → ${voucher.status}`, entity: "BirthdayVoucher", entityId: id, entityName: voucher.code, oldValue: { status: beforeV.status }, newValue: { status: voucher.status } });
  }
  if (status === "USED") {
    await notify(voucher.customerId, {
      type: "VOUCHER",
      title: "Birthday cupcake enjoyed 🎂",
      message: `Your ${voucher.rewardName} voucher (${voucher.code}) was used. Happy birthday from Bean Avenue!`,
      link: "/account?tab=rewards",
    });
  } else if (status === "CANCELLED") {
    await notify(voucher.customerId, {
      type: "VOUCHER",
      title: "Birthday voucher cancelled",
      message: `Your ${voucher.rewardName} voucher (${voucher.code}) was cancelled. Contact us if you have questions.`,
      link: "/account?tab=rewards",
    });
  }
  res.json(withEffective(voucher));
});

// GET /api/birthday/upcoming — customers with a birthday, sorted by how soon it is
birthdayRouter.get("/upcoming", async (_req, res) => {
  const customers = await prisma.customer.findMany({
    where: { birthday: { not: null } },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      birthday: true,
      birthdayVouchers: { select: { year: true, status: true } },
    },
  });
  const now = new Date();
  const thisYear = now.getFullYear();
  const startToday = new Date(thisYear, now.getMonth(), now.getDate());

  const rows = customers.map((c) => {
    const b = c.birthday!;
    let next = new Date(thisYear, b.getMonth(), b.getDate());
    if (next < startToday) next = new Date(thisYear + 1, b.getMonth(), b.getDate());
    const daysUntil = Math.round((next.getTime() - startToday.getTime()) / 86_400_000);
    const windowYear = next.getFullYear();
    const claimed = c.birthdayVouchers.some((v) => v.year === windowYear);
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      birthday: c.birthday,
      daysUntil,
      claimedThisYear: claimed,
    };
  });
  rows.sort((a, b) => a.daysUntil - b.daysUntil);
  res.json(rows.slice(0, 60));
});

// POST /api/birthday/issue  { customerId } — manager manually issues a voucher
birthdayRouter.post("/issue", async (req, res) => {
  const customerId = Number(req.body.customerId);
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) return res.status(404).json({ error: "Customer not found." });
  if (!customer.birthday) return res.status(400).json({ error: "This customer hasn't added a birthday." });

  const s = await getBirthdaySettings();
  const now = new Date();
  // Use the active window if there is one; otherwise anchor to this year's birthday.
  const win = activeWindow(customer.birthday, s, now);
  const year = win ? win.year : now.getFullYear();
  const expiresAt = win
    ? win.end
    : new Date(now.getTime() + (s.daysAfter + 1) * 86_400_000);

  const existing = await prisma.birthdayVoucher.findUnique({
    where: { customerId_year: { customerId, year } },
  });
  if (existing) return res.status(409).json({ error: "This customer already has a voucher for this year." });

  const voucher = await prisma.birthdayVoucher.create({
    data: {
      code: genBirthdayCode(),
      customerId,
      customerName: customer.name || "Customer",
      phone: customer.phone,
      email: customer.email,
      rewardName: s.rewardName,
      year,
      expiresAt,
      issuedByAdmin: true,
    },
  });
  await notify(customerId, {
    type: "VOUCHER",
    title: "Birthday reward ready 🎂",
    message: `Your ${s.rewardName} voucher is ready — show it at the counter to claim your free cupcake.`,
    link: "/account?tab=rewards",
  });
  await audit(actorCtx(req), { section: "Loyalty", action: "birthday_reward_issued", description: `Issued ${voucher.rewardName} birthday voucher (${voucher.code}) to ${voucher.customerName}`, entity: "BirthdayVoucher", entityId: voucher.id, entityName: voucher.code, newValue: { year, customer: voucher.customerName } });
  res.status(201).json(withEffective(voucher));
});
