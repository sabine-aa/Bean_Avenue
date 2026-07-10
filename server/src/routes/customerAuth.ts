import bcrypt from "bcryptjs";
import { Router } from "express";
import { requireCustomer } from "../auth";
import { prisma } from "../db";
import { accountResponse, customerToken } from "../lib/account";
import { devCodesEnabled, generateCode, normalizeEmail, normalizePhone, providerConfigured, sendOtp } from "../lib/otp";

export const customerAuthRouter = Router();

const CODE_TTL_MS = 5 * 60 * 1000; // codes expire after 5 minutes
const RESEND_INTERVAL_S = 30; // min seconds between sends
const MAX_PER_HOUR = 6; // max code requests per identifier per hour
const MAX_ATTEMPTS = 5; // max wrong tries per code

type Channel = "PHONE" | "EMAIL";

// Resolve {channel, identifier} from a request body, or null if invalid.
function resolveIdentifier(body: Record<string, unknown>): { channel: Channel; identifier: string } | null {
  const channel = String(body.channel ?? "").toUpperCase();
  if (channel === "PHONE") {
    const id = normalizePhone(body.countryCode as string, String(body.phone ?? ""));
    return id ? { channel: "PHONE", identifier: id } : null;
  }
  if (channel === "EMAIL") {
    const id = normalizeEmail(String(body.email ?? ""));
    return id ? { channel: "EMAIL", identifier: id } : null;
  }
  return null;
}

// Create + "send" a code, enforcing resend interval and hourly cap.
async function createAndSend(channel: Channel, identifier: string, purpose: "LOGIN" | "LINK") {
  const hourAgo = new Date(Date.now() - 3_600_000);
  const recent = await prisma.otpCode.findMany({
    where: { identifier, createdAt: { gte: hourAgo } },
    orderBy: { createdAt: "desc" },
  });
  if (recent.length >= MAX_PER_HOUR) {
    return { status: 429, error: "Too many code requests. Please try again later." };
  }
  if (recent[0]) {
    const sinceMs = Date.now() - recent[0].createdAt.getTime();
    if (sinceMs < RESEND_INTERVAL_S * 1000) {
      const wait = Math.ceil((RESEND_INTERVAL_S * 1000 - sinceMs) / 1000);
      return { status: 429, error: `Please wait ${wait}s before requesting another code.` };
    }
  }
  // Invalidate older unconsumed codes so only the newest works.
  await prisma.otpCode.updateMany({ where: { identifier, consumed: false }, data: { consumed: true } });

  const code = generateCode();
  await prisma.otpCode.create({
    data: {
      channel,
      identifier,
      codeHash: await bcrypt.hash(code, 8),
      purpose,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });
  const configured = providerConfigured(channel);
  if (configured) {
    // A real provider is set up — send in the BACKGROUND so a slow SMTP host
    // never makes the customer wait/hang on "Sending…". The code is already saved.
    void sendOtp(channel, identifier, code).catch((e) => console.error("OTP send error:", e));
  } else {
    // No provider yet — log to the console and reveal the code on-screen (dev/test).
    await sendOtp(channel, identifier, code);
  }
  return {
    status: 200,
    ok: true,
    resendInSeconds: RESEND_INTERVAL_S,
    expiresInSeconds: CODE_TTL_MS / 1000,
    devCode: !configured && devCodesEnabled() ? code : undefined,
  };
}

// Verify a submitted code. Returns { ok } or { status, error } with a clear message.
async function checkCode(channel: Channel, identifier: string, code: string) {
  const otp = await prisma.otpCode.findFirst({
    where: { identifier, channel, consumed: false },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) return { status: 400, error: "Enter the latest code, or request a new one." };
  if (otp.expiresAt.getTime() < Date.now()) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { consumed: true } });
    return { status: 400, error: "That code has expired — request a new one." };
  }
  if (otp.attempts >= MAX_ATTEMPTS) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { consumed: true } });
    return { status: 429, error: "Too many incorrect attempts. Request a new code." };
  }
  const ok = await bcrypt.compare(String(code ?? ""), otp.codeHash);
  if (!ok) {
    const attempts = otp.attempts + 1;
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { attempts, consumed: attempts >= MAX_ATTEMPTS },
    });
    const left = MAX_ATTEMPTS - attempts;
    return {
      status: 400,
      error: left > 0 ? `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} left.` : "Too many incorrect attempts. Request a new code.",
    };
  }
  await prisma.otpCode.update({ where: { id: otp.id }, data: { consumed: true } });
  return { ok: true as const };
}

// ---- Login / signup via OTP ----

// POST /api/auth/otp/request  { channel: "phone"|"email", phone?, countryCode?, email? }
customerAuthRouter.post("/otp/request", async (req, res) => {
  const target = resolveIdentifier(req.body);
  if (!target) return res.status(400).json({ error: "Enter a valid phone number or email address." });
  const result = await createAndSend(target.channel, target.identifier, "LOGIN");
  // Never reveal whether an account exists.
  res.status(result.status).json(result);
});

// POST /api/auth/otp/verify  { channel, phone?/email?, countryCode?, code }
customerAuthRouter.post("/otp/verify", async (req, res) => {
  const target = resolveIdentifier(req.body);
  if (!target) return res.status(400).json({ error: "Enter a valid phone number or email address." });

  const check = await checkCode(target.channel, target.identifier, String(req.body.code ?? ""));
  if (!("ok" in check)) return res.status(check.status).json({ error: check.error });

  // Find or create the customer keyed by the verified identifier.
  let customer =
    target.channel === "PHONE"
      ? await prisma.customer.findUnique({ where: { phone: target.identifier } })
      : await prisma.customer.findUnique({ where: { email: target.identifier } });

  if (customer) {
    customer = await prisma.customer.update({
      where: { id: customer.id },
      data: target.channel === "PHONE" ? { phoneVerified: true } : { emailVerified: true },
    });
  } else {
    customer = await prisma.customer.create({
      data:
        target.channel === "PHONE"
          ? { name: "", phone: target.identifier, phoneVerified: true }
          : { name: "", email: target.identifier, emailVerified: true },
    });
  }

  // Verified by email but the customer also provided a phone number — save it as
  // contact info (best effort; skip if it already belongs to another account).
  if (target.channel === "EMAIL") {
    const phone = normalizePhone(req.body.countryCode as string, String(req.body.phone ?? ""));
    if (phone && phone !== customer.phone) {
      const owner = await prisma.customer.findUnique({ where: { phone } });
      if (!owner || owner.id === customer.id) {
        customer = await prisma.customer.update({ where: { id: customer.id }, data: { phone } });
      }
    }
  }

  // Save the first/last name captured on the sign-up form.
  const providedName = String(req.body.name ?? "").trim().slice(0, 80);
  if (providedName && providedName !== customer.name) {
    customer = await prisma.customer.update({ where: { id: customer.id }, data: { name: providedName } });
  }

  const account = await accountResponse(customer.id, { needsProfile: !customer.name?.trim() });
  res.json({ token: customerToken(customer.id), account });
});

// ---- Linking a second method to the logged-in account ----

// POST /api/auth/link/request  (customer) — send a code to a new phone/email
customerAuthRouter.post("/link/request", requireCustomer, async (req, res) => {
  const target = resolveIdentifier(req.body);
  if (!target) return res.status(400).json({ error: "Enter a valid phone number or email address." });
  const result = await createAndSend(target.channel, target.identifier, "LINK");
  res.status(result.status).json(result);
});

// POST /api/auth/link/verify  (customer) — verify + attach the method to this account
customerAuthRouter.post("/link/verify", requireCustomer, async (req, res) => {
  const target = resolveIdentifier(req.body);
  if (!target) return res.status(400).json({ error: "Enter a valid phone number or email address." });

  const check = await checkCode(target.channel, target.identifier, String(req.body.code ?? ""));
  if (!("ok" in check)) return res.status(check.status).json({ error: check.error });

  // If another account already owns this identifier, don't silently merge balances.
  const owner =
    target.channel === "PHONE"
      ? await prisma.customer.findUnique({ where: { phone: target.identifier } })
      : await prisma.customer.findUnique({ where: { email: target.identifier } });
  if (owner && owner.id !== req.customerId) {
    return res.status(409).json({
      error: "That phone/email is already linked to another Bean Avenue account. Contact us to merge them.",
    });
  }

  await prisma.customer.update({
    where: { id: req.customerId! },
    data:
      target.channel === "PHONE"
        ? { phone: target.identifier, phoneVerified: true }
        : { email: target.identifier, emailVerified: true },
  });
  res.json(await accountResponse(req.customerId!));
});
