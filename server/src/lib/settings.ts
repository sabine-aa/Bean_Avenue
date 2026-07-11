import { prisma } from "../db";

// All delivery/payment/pickup/tax configuration lives in the existing Setting
// key/value table. The defaults below are the source of truth for which keys
// exist and what they mean; anything the manager saves overlays these.
export const SETTING_DEFAULTS: Record<string, string> = {
  "delivery.enabled": "true",
  "delivery.paused": "false", // temporary pause when the shop is too busy
  "delivery.freeThreshold": "20", // free delivery on orders >= this ($); 0 = off
  "delivery.hoursEnabled": "false",
  "delivery.hoursStart": "09:00",
  "delivery.hoursEnd": "22:00",
  "delivery.defaultEstimate": "30–45 min",
  "pickup.enabled": "true",
  "pickup.prepTime": "15 min",
  "pickup.scheduleEnabled": "true",
  "pickup.location": "Bean Avenue — Main Street",
  "payment.online.enabled": "true",
  "payment.cashOnDelivery.enabled": "true",
  "payment.cashAtPickup.enabled": "true",
  // In-store register (POS) card payments. Off by default — the shop is
  // cash-only until the bank account + terminal are live; flip on then.
  "pos.card.enabled": "false",
  "pos.card.requireApprovalCode": "false", // require the terminal's approval code on each card sale
  "pos.card.provider": "manual", // "manual" = standalone bank terminal; an integrated acquirer plugs in here later
  "staff.discount.percent": "0", // % off a staff purchase, applied from the register
  "tax.rate": "0", // percentage applied to (subtotal - discounts + delivery fee)
  "tax.label": "Tax",
  "currency": "USD",
};

export type SettingsMap = Record<string, string>;

/** Load every managed setting, overlaying saved values onto the defaults. */
export async function getSettingsMap(): Promise<SettingsMap> {
  const rows = await prisma.setting.findMany();
  const map: SettingsMap = { ...SETTING_DEFAULTS };
  for (const r of rows) {
    if (r.key in SETTING_DEFAULTS) map[r.key] = r.value;
  }
  return map;
}

/** Save a partial set of settings (only keys we manage are accepted). */
export async function saveSettings(partial: Record<string, unknown>): Promise<void> {
  const entries = Object.entries(partial).filter(([k]) => k in SETTING_DEFAULTS);
  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        create: { key, value: String(value) },
        update: { value: String(value) },
      })
    )
  );
}

const bool = (v: string | undefined) => v === "true";
const num = (v: string | undefined) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** "HH:MM" -> minutes since midnight, or null if malformed. */
function hhmmToMins(v: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Are we currently inside the configured delivery operating hours? */
export function withinDeliveryHours(map: SettingsMap, now = new Date()): boolean {
  if (!bool(map["delivery.hoursEnabled"])) return true;
  const start = hhmmToMins(map["delivery.hoursStart"]);
  const end = hhmmToMins(map["delivery.hoursEnd"]);
  if (start === null || end === null) return true;
  const mins = now.getHours() * 60 + now.getMinutes();
  // Support overnight windows (e.g. 18:00 -> 02:00).
  return start <= end ? mins >= start && mins <= end : mins >= start || mins <= end;
}

/**
 * The public storefront configuration the checkout page needs. `deliveryHoursOpen`
 * and `deliveryAvailable` are computed server-side so the client can't fake them.
 */
export async function storefrontConfig(now = new Date()) {
  const map = await getSettingsMap();
  const hoursOpen = withinDeliveryHours(map, now);
  const deliveryEnabled = bool(map["delivery.enabled"]);
  const deliveryPaused = bool(map["delivery.paused"]);
  return {
    currency: map["currency"],
    tax: { rate: num(map["tax.rate"]), label: map["tax.label"] },
    delivery: {
      enabled: deliveryEnabled,
      paused: deliveryPaused,
      hoursOpen,
      // "available" = manager allows it AND not paused AND within hours.
      available: deliveryEnabled && !deliveryPaused && hoursOpen,
      freeThreshold: num(map["delivery.freeThreshold"]),
      defaultEstimate: map["delivery.defaultEstimate"],
      hours: {
        enabled: bool(map["delivery.hoursEnabled"]),
        start: map["delivery.hoursStart"],
        end: map["delivery.hoursEnd"],
      },
    },
    pickup: {
      enabled: bool(map["pickup.enabled"]),
      prepTime: map["pickup.prepTime"],
      scheduleEnabled: bool(map["pickup.scheduleEnabled"]),
      location: map["pickup.location"],
    },
    payment: {
      online: bool(map["payment.online.enabled"]),
      cashOnDelivery: bool(map["payment.cashOnDelivery.enabled"]),
      cashAtPickup: bool(map["payment.cashAtPickup.enabled"]),
    },
  };
}

export type StorefrontConfig = Awaited<ReturnType<typeof storefrontConfig>>;

/** Register (POS) configuration — which tenders the cashier may take in-store. */
export async function posConfig() {
  const map = await getSettingsMap();
  return {
    card: {
      enabled: bool(map["pos.card.enabled"]),
      requireApprovalCode: bool(map["pos.card.requireApprovalCode"]),
      provider: map["pos.card.provider"] || "manual",
    },
    staffDiscount: num(map["staff.discount.percent"]),
  };
}

export type PosConfig = Awaited<ReturnType<typeof posConfig>>;
