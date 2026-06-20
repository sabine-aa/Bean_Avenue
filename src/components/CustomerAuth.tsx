import { FormEvent, useEffect, useRef, useState } from "react";
import { useCustomerAuth, type OtpTarget } from "../context/CustomerAuthContext";
import { useToast } from "../context/ToastContext";
import { COUNTRY_CODES } from "../lib/countries";
import { AppleIcon, GoogleIcon, MailIcon, PhoneIcon } from "./icons";

type Step = "choose" | "phone" | "email" | "code";

export function CustomerAuth() {
  const { requestOtp, verifyOtp } = useCustomerAuth();
  const toast = useToast();

  const [step, setStep] = useState<Step>("choose");
  const [countryCode, setCountryCode] = useState("+961");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [devCode, setDevCode] = useState<string | undefined>();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Resend countdown
  useEffect(() => {
    if (resendIn <= 0) return;
    timer.current = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [resendIn]);

  const channel = step === "email" || (step === "code" && email) ? "email" : "phone";
  const target: OtpTarget =
    channel === "email" ? { channel: "email", email } : { channel: "phone", countryCode, phone };

  const sentTo =
    channel === "email" ? email : `${countryCode} ${phone}`;

  async function send(e?: FormEvent) {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const res = await requestOtp(target);
      setDevCode(res.devCode);
      setResendIn(res.resendInSeconds ?? 30);
      setStep("code");
      setCode("");
      toast("Verification code sent.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't send a code.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (resendIn > 0 || busy) return;
    await send();
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await verifyOtp(target, code.trim());
      toast("Welcome to Bean Avenue! 🫘");
      // account is now set in context; parent re-renders to the dashboard.
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't verify that code.", "error");
    } finally {
      setBusy(false);
    }
  }

  const inputCls = "mt-1 w-full rounded-xl border border-oat px-4 py-2.5";

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">
      {step === "choose" && (
        <div className="space-y-3">
          <h2 className="font-display text-xl font-bold text-espresso">Sign in or create your account</h2>
          <p className="text-sm text-charcoal/60">
            We'll verify your phone or email with a one-time code — no passwords.
          </p>
          <button
            onClick={() => setStep("phone")}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-espresso px-5 py-3 font-semibold text-cream transition hover:bg-mocha"
          >
            <PhoneIcon className="h-5 w-5" /> Continue with phone number
          </button>
          <button
            onClick={() => setStep("email")}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-oat bg-white px-5 py-3 font-semibold text-espresso transition hover:bg-oat"
          >
            <MailIcon className="h-5 w-5" /> Continue with email
          </button>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              disabled
              title="Coming soon"
              className="flex cursor-not-allowed items-center justify-center gap-2 rounded-full border border-oat bg-white px-5 py-3 font-semibold text-charcoal/40"
            >
              <GoogleIcon className="h-5 w-5 opacity-50" /> Google
            </button>
            <button
              disabled
              title="Coming soon"
              className="flex cursor-not-allowed items-center justify-center gap-2 rounded-full border border-oat bg-white px-5 py-3 font-semibold text-charcoal/40"
            >
              <AppleIcon className="h-5 w-5" /> Apple
            </button>
          </div>
          <p className="text-center text-xs text-charcoal/40">Google &amp; Apple sign-in coming soon.</p>
        </div>
      )}

      {step === "phone" && (
        <form onSubmit={send} className="space-y-4">
          <BackButton onClick={() => setStep("choose")} />
          <h2 className="font-display text-xl font-bold text-espresso">Continue with phone</h2>
          <div className="flex gap-2">
            <label className="text-sm font-semibold text-espresso">
              Country
              <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className="mt-1 rounded-xl border border-oat px-3 py-2.5">
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex-1 text-sm font-semibold text-espresso">
              Phone number
              <input
                required
                autoFocus
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="03 111 222"
                className={inputCls}
              />
            </label>
          </div>
          <button type="submit" disabled={busy} className="btn-3d w-full rounded-full bg-terracotta px-6 py-3 font-semibold text-cream disabled:opacity-60">
            {busy ? "Sending…" : "Send code"}
          </button>
        </form>
      )}

      {step === "email" && (
        <form onSubmit={send} className="space-y-4">
          <BackButton onClick={() => setStep("choose")} />
          <h2 className="font-display text-xl font-bold text-espresso">Continue with email</h2>
          <label className="block text-sm font-semibold text-espresso">
            Email address
            <input
              required
              autoFocus
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={inputCls}
            />
          </label>
          <button type="submit" disabled={busy} className="btn-3d w-full rounded-full bg-terracotta px-6 py-3 font-semibold text-cream disabled:opacity-60">
            {busy ? "Sending…" : "Send code"}
          </button>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={verify} className="space-y-4">
          <BackButton onClick={() => setStep(channel === "email" ? "email" : "phone")} />
          <h2 className="font-display text-xl font-bold text-espresso">Enter your code</h2>
          <p className="text-sm text-charcoal/60">
            We sent a 6-digit code to <span className="font-semibold text-espresso">{sentTo}</span>.
          </p>
          {devCode && (
            <p className="rounded-lg bg-oat/60 px-3 py-2 text-xs text-charcoal/70">
              Dev mode — your code is <span className="font-mono font-bold">{devCode}</span> (a real
              SMS/email provider replaces this in production).
            </p>
          )}
          <input
            required
            autoFocus
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="······"
            className="w-full rounded-xl border border-oat px-4 py-3 text-center text-2xl tracking-[0.5em]"
          />
          <button type="submit" disabled={busy || code.length < 6} className="btn-3d w-full rounded-full bg-terracotta px-6 py-3 font-semibold text-cream disabled:opacity-60">
            {busy ? "Verifying…" : "Verify & continue"}
          </button>
          <button
            type="button"
            onClick={resend}
            disabled={resendIn > 0 || busy}
            className="w-full text-sm font-semibold text-terracotta disabled:text-charcoal/40"
          >
            {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
          </button>
        </form>
      )}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-sm font-semibold text-charcoal/50 hover:text-espresso">
      ← Back
    </button>
  );
}
