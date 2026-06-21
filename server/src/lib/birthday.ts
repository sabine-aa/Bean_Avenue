import type { BirthdayVoucher, Customer } from "@prisma/client";
import { prisma } from "../db";
import { genNumber } from "./helpers";

// ---- Settings (stored in the key/value Setting table) ----

export interface BirthdaySettings {
  enabled: boolean;
  daysBefore: number; // window opens this many days before the birthday
  daysAfter: number; // window closes this many days after
  rewardName: string;
  eligibleCategory: string; // "" = any category
  eligibleItemIds: number[]; // specific cupcake ids; [] = any in the category/menu
  deductBeans: number; // 0 = complimentary (default)
}

export const BIRTHDAY_DEFAULTS: BirthdaySettings = {
  enabled: true,
  daysBefore: 3,
  daysAfter: 3,
  rewardName: "Birthday Cupcake",
  eligibleCategory: "",
  eligibleItemIds: [],
  deductBeans: 0,
};

const KEYS = {
  enabled: "birthday.enabled",
  daysBefore: "birthday.daysBefore",
  daysAfter: "birthday.daysAfter",
  rewardName: "birthday.rewardName",
  eligibleCategory: "birthday.eligibleCategory",
  eligibleItemIds: "birthday.eligibleItemIds",
  deductBeans: "birthday.deductBeans",
} as const;

export async function getBirthdaySettings(): Promise<BirthdaySettings> {
  const rows = await prisma.setting.findMany({ where: { key: { in: Object.values(KEYS) } } });
  const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const num = (k: string, d: number) => (m[k] != null && m[k] !== "" ? Number(m[k]) : d);
  let ids: number[] = BIRTHDAY_DEFAULTS.eligibleItemIds;
  try {
    if (m[KEYS.eligibleItemIds]) ids = JSON.parse(m[KEYS.eligibleItemIds]).map(Number).filter(Boolean);
  } catch {
    /* keep default */
  }
  return {
    enabled: m[KEYS.enabled] != null ? m[KEYS.enabled] === "true" : BIRTHDAY_DEFAULTS.enabled,
    daysBefore: Math.max(0, num(KEYS.daysBefore, BIRTHDAY_DEFAULTS.daysBefore)),
    daysAfter: Math.max(0, num(KEYS.daysAfter, BIRTHDAY_DEFAULTS.daysAfter)),
    rewardName: m[KEYS.rewardName] || BIRTHDAY_DEFAULTS.rewardName,
    eligibleCategory: m[KEYS.eligibleCategory] ?? BIRTHDAY_DEFAULTS.eligibleCategory,
    eligibleItemIds: ids,
    deductBeans: Math.max(0, num(KEYS.deductBeans, BIRTHDAY_DEFAULTS.deductBeans)),
  };
}

export async function saveBirthdaySettings(patch: Partial<BirthdaySettings>) {
  const set = (key: string, value: string) =>
    prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  const ops: Promise<unknown>[] = [];
  if ("enabled" in patch) ops.push(set(KEYS.enabled, patch.enabled ? "true" : "false"));
  if ("daysBefore" in patch) ops.push(set(KEYS.daysBefore, String(Math.max(0, Math.round(patch.daysBefore!)))));
  if ("daysAfter" in patch) ops.push(set(KEYS.daysAfter, String(Math.max(0, Math.round(patch.daysAfter!)))));
  if ("rewardName" in patch) ops.push(set(KEYS.rewardName, (patch.rewardName || "").trim() || BIRTHDAY_DEFAULTS.rewardName));
  if ("eligibleCategory" in patch) ops.push(set(KEYS.eligibleCategory, (patch.eligibleCategory || "").trim()));
  if ("eligibleItemIds" in patch) ops.push(set(KEYS.eligibleItemIds, JSON.stringify((patch.eligibleItemIds || []).map(Number).filter(Boolean))));
  if ("deductBeans" in patch) ops.push(set(KEYS.deductBeans, String(Math.max(0, Math.round(patch.deductBeans!)))));
  await Promise.all(ops);
  return getBirthdaySettings();
}

// ---- Date window helpers ----

const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

export interface BirthdayWindow {
  year: number; // anchor year of the birthday this window is built around
  start: Date;
  end: Date;
}

/** The birthday window currently containing `now`, or null if we're outside it. */
export function activeWindow(birthday: Date, s: BirthdaySettings, now = new Date()): BirthdayWindow | null {
  for (const anchor of [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]) {
    const bday = new Date(anchor, birthday.getMonth(), birthday.getDate());
    const start = startOfDay(new Date(bday.getTime() - s.daysBefore * DAY));
    const end = endOfDay(new Date(bday.getTime() + s.daysAfter * DAY));
    if (now >= start && now <= end) return { year: anchor, start, end };
  }
  return null;
}

/** A voucher is effectively expired once its window has passed, even if not yet marked. */
export function effectiveStatus(v: Pick<BirthdayVoucher, "status" | "expiresAt">, now = new Date()): string {
  if (v.status === "AVAILABLE" && v.expiresAt.getTime() < now.getTime()) return "EXPIRED";
  return v.status;
}

export const genBirthdayCode = () => genNumber("BDAY");

// ---- Customer-facing status ----

export interface BirthdayRewardStatus {
  enabled: boolean;
  hasBirthday: boolean;
  birthdayLocked: boolean;
  verified: boolean;
  available: boolean; // claimable right now
  windowStart: string | null;
  windowEnd: string | null;
  rewardName: string;
  eligibleNote: string;
  voucher: (BirthdayVoucher & { effectiveStatus: string }) | null;
  reason: string;
}

async function eligibleNote(s: BirthdaySettings): Promise<string> {
  if (s.eligibleItemIds.length) {
    const items = await prisma.menuItem.findMany({ where: { id: { in: s.eligibleItemIds } }, select: { name: true } });
    if (items.length) return `Choose from: ${items.map((i) => i.name).join(", ")}`;
  }
  if (s.eligibleCategory) return `Any item from ${s.eligibleCategory}`;
  return "Any cupcake on the menu";
}

/** Compute the birthday reward state for a customer (no side effects). */
export async function computeBirthdayReward(customer: Customer): Promise<BirthdayRewardStatus> {
  const s = await getBirthdaySettings();
  const verified = customer.phoneVerified || customer.emailVerified;
  const hasBirthday = !!customer.birthday;
  const note = await eligibleNote(s);

  const base: BirthdayRewardStatus = {
    enabled: s.enabled,
    hasBirthday,
    birthdayLocked: hasBirthday,
    verified,
    available: false,
    windowStart: null,
    windowEnd: null,
    rewardName: s.rewardName,
    eligibleNote: note,
    voucher: null,
    reason: "",
  };

  if (!s.enabled) return { ...base, reason: "The birthday reward isn't running right now." };
  if (!hasBirthday) return { ...base, reason: "Add your birthday to unlock your birthday reward." };
  if (!verified) return { ...base, reason: "Verify your account to receive birthday rewards." };

  const now = new Date();
  const win = activeWindow(customer.birthday!, s, now);

  // The most recent voucher (for display in My Rewards), plus this window's voucher.
  const latest = await prisma.birthdayVoucher.findFirst({
    where: { customerId: customer.id },
    orderBy: { issuedAt: "desc" },
  });
  const withStatus = latest ? { ...latest, effectiveStatus: effectiveStatus(latest, now) } : null;

  if (!win) {
    return { ...base, voucher: withStatus, reason: "Your birthday reward will appear around your birthday." };
  }

  base.windowStart = win.start.toISOString();
  base.windowEnd = win.end.toISOString();

  const thisYearVoucher = await prisma.birthdayVoucher.findUnique({
    where: { customerId_year: { customerId: customer.id, year: win.year } },
  });
  if (thisYearVoucher) {
    return {
      ...base,
      voucher: { ...thisYearVoucher, effectiveStatus: effectiveStatus(thisYearVoucher, now) },
      reason: "You've already claimed this year's birthday reward.",
    };
  }

  // Must have set the birthday before this window opened (anti-abuse).
  if (customer.birthdaySetAt && customer.birthdaySetAt.getTime() >= win.start.getTime()) {
    return {
      ...base,
      voucher: withStatus,
      reason: "Birthdays added during the reward window become eligible next year.",
    };
  }

  return { ...base, available: true, voucher: withStatus, reason: "" };
}
