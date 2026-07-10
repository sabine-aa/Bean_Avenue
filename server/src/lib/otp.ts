import { randomInt } from "node:crypto";
import nodemailer, { type Transporter } from "nodemailer";

// Codes are printed to the server console in dev so you can test without an SMS/email
// provider. In production, set NODE_ENV=production and wire a real provider below —
// then dev codes are never returned to the client.
const isDev = process.env.NODE_ENV !== "production";

export const devCodesEnabled = () => isDev;

export function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** Diagnostic: attempt an SMTP send on a specific port from THIS host and return
 *  the real result/error (so we can tell a port block from an auth block, etc.). */
export async function debugSmtp(port: number, to: string): Promise<{ ok: boolean; error?: string }> {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return { ok: false, error: "SMTP not configured" };
  const t = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: 15_000,
  });
  try {
    await t.sendMail({
      from: `Bean Avenue <${process.env.SMTP_FROM || SMTP_USER}>`,
      to,
      subject: `Bean Avenue — port ${port} test`,
      text: `Port ${port} delivered from the server.`,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Whether a real delivery provider is configured for this channel. */
export function providerConfigured(channel: "PHONE" | "EMAIL"): boolean {
  if (channel === "EMAIL") return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_OTP_TEMPLATE);
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
 * Send an OTP. PHONE codes are delivered over WhatsApp (Meta WhatsApp Cloud API)
 * when it's configured; otherwise — and for EMAIL — the code is logged to the
 * server console and, in dev, also shown to the user so you can test without a
 * provider connected.
 */
// Returns true when the code was actually delivered to the customer (email/WhatsApp),
// false when it only fell back to the server console (no provider configured).
export async function sendOtp(channel: "PHONE" | "EMAIL", identifier: string, code: string): Promise<boolean> {
  if (channel === "EMAIL" && (await sendEmailOtp(identifier, code))) return true;
  if (channel === "PHONE" && (await sendWhatsAppOtp(identifier, code))) return true;
  // eslint-disable-next-line no-console
  console.log(`\n==== Bean Avenue OTP ====\n  ${channel}: ${identifier}\n  Code: ${code}\n=========================\n`);
  return false;
}

// Email delivery via SMTP (works with Gmail app passwords, Brevo, SendGrid, etc.).
// Returns false (caller falls back to the console/test code) when not configured.
//   Env: SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASS, SMTP_FROM (optional)
let mailer: Transporter | null = null;
function getMailer(): Transporter | null {
  if (mailer) return mailer;
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  const port = Number(process.env.SMTP_PORT) || 587;
  mailer = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    // Fail fast instead of hanging the request if the SMTP host is slow/unreachable.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return mailer;
}

async function sendEmailOtp(to: string, code: string): Promise<boolean> {
  const t = getMailer();
  if (!t) return false;
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  try {
    await t.sendMail({
      from: `Bean Avenue <${from}>`,
      to,
      subject: `Your Bean Avenue code: ${code}`,
      text: `Your Bean Avenue verification code is ${code}. It expires in 5 minutes. If you didn't request this, you can ignore this email.`,
      html: `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:420px">
        <h2 style="color:#2f3b2f;margin:0 0 8px">Bean Avenue</h2>
        <p style="color:#555;margin:0 0 16px">Here's your verification code:</p>
        <p style="font-size:32px;font-weight:800;letter-spacing:8px;color:#2f3b2f;margin:0 0 16px">${code}</p>
        <p style="color:#888;font-size:13px">It expires in 5 minutes. If you didn't request this, you can ignore this email.</p>
      </div>`,
    });
    return true;
  } catch (err) {
    console.error("Email OTP send error:", err);
    return false;
  }
}

/**
 * Deliver a login code over WhatsApp using the Meta WhatsApp Cloud API.
 * Returns false (so the caller falls back to the console/test code) when it isn't
 * configured or the send fails. Requires an approved "authentication" template.
 *
 * Env vars:
 *   WHATSAPP_TOKEN            – permanent access token of the WhatsApp system user
 *   WHATSAPP_PHONE_NUMBER_ID  – the Cloud API phone-number ID (not the phone itself)
 *   WHATSAPP_OTP_TEMPLATE     – name of the approved authentication template
 *   WHATSAPP_TEMPLATE_LANG    – template language code (default "en")
 */
async function sendWhatsAppOtp(toE164: string, code: string): Promise<boolean> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const template = process.env.WHATSAPP_OTP_TEMPLATE;
  const lang = process.env.WHATSAPP_TEMPLATE_LANG || "en";
  if (!token || !phoneNumberId || !template) return false;

  const to = toE164.replace(/[^\d]/g, ""); // Cloud API wants digits only, no "+"
  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: template,
      language: { code: lang },
      // Authentication templates take the code in the body AND in the one-tap
      // "Copy code" button that Meta adds automatically.
      components: [
        { type: "body", parameters: [{ type: "text", text: code }] },
        { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
      ],
    },
  };

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error("WhatsApp OTP send failed:", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (err) {
    console.error("WhatsApp OTP send error:", err);
    return false;
  }
}
