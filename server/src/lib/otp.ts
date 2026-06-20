import { randomInt } from "node:crypto";

// Codes are printed to the server console in dev so you can test without an SMS/email
// provider. In production, set NODE_ENV=production and wire a real provider below —
// then dev codes are never returned to the client.
const isDev = process.env.NODE_ENV !== "production";

export const devCodesEnabled = () => isDev;

export function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** Normalize a phone to E.164-ish "+<digits>". Returns null if it doesn't look valid. */
export function normalizePhone(countryCode: string | undefined, raw: string): string | null {
  let cc = String(countryCode || "+961").replace(/[^\d+]/g, "");
  if (!cc.startsWith("+")) cc = "+" + cc;
  let digits = String(raw || "").replace(/\D/g, "").replace(/^0+/, ""); // drop local leading zeros
  if (digits.length < 6 || digits.length > 14) return null;
  return cc + digits;
}

export function normalizeEmail(raw: string): string | null {
  const email = String(raw || "").trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null;
}

/**
 * "Send" an OTP. In dev this just logs it. To go live, integrate an SMS provider
 * (e.g. Twilio) for PHONE and an email service (e.g. SMTP/SendGrid) for EMAIL here,
 * reading credentials from environment variables.
 */
export async function sendOtp(channel: "PHONE" | "EMAIL", identifier: string, code: string) {
  // eslint-disable-next-line no-console
  console.log(`\n==== Bean Avenue OTP ====\n  ${channel}: ${identifier}\n  Code: ${code}\n=========================\n`);
}
