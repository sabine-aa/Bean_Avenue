import { FormEvent, useEffect, useRef, useState } from "react";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { useToast } from "../context/ToastContext";
import { COUNTRY_CODES } from "../lib/countries";
import { MailIcon } from "./icons";

// Login for launch: customer enters their phone number + email, we verify with a
// one-time code sent to their email, and the phone is saved as their contact.
export function CustomerAuth() {
  const { requestOtp, verifyOtp } = useCustomerAuth();
  const toast = useToast();

  const [step, setStep] = useState<"form" | "code">("form");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
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

  // Verify by email; carry the phone + name so the server can save them.
  const target = {
    channel: "email" as const,
    email,
    phone,
    countryCode,
    name: `${firstName.trim()} ${lastName.trim()}`.trim(),
  };

  async function send(e?: FormEvent) {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const res = await requestOtp({ channel: "email", email });
      setDevCode(res.devCode);
      setResendIn(res.resendInSeconds ?? 30);
      setStep("code");
      setCode("");
      toast("Code sent to your email.");
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
      {step === "form" && (
        <form onSubmit={send} className="space-y-4">
          <h2 className="font-display text-xl font-bold text-espresso">Sign in or create your account</h2>
          <p className="text-sm text-charcoal/60">
            Enter your phone and email — we'll send a one-time code to your{" "}
            <span className="font-semibold text-espresso">email</span> to verify it. No passwords.
          </p>
          <div className="flex gap-2">
            <label className="min-w-0 flex-1 text-sm font-semibold text-espresso">
              First name
              <input
                required
                autoFocus
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Sara"
                className={inputCls}
              />
            </label>
            <label className="min-w-0 flex-1 text-sm font-semibold text-espresso">
              Last name
              <input
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Khoury"
                className={inputCls}
              />
            </label>
          </div>
          <div className="flex gap-2">
            <label className="w-32 shrink-0 text-sm font-semibold text-espresso sm:w-36">
              Country
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="mt-1 w-full rounded-xl border border-oat px-2 py-2.5"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 flex-1 text-sm font-semibold text-espresso">
              Phone number
              <input
                required
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="03 111 222"
                className={inputCls}
              />
            </label>
          </div>
          <label className="block text-sm font-semibold text-espresso">
            Email address
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={inputCls}
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="btn-3d flex w-full items-center justify-center gap-2 rounded-full bg-espresso px-6 py-3 font-semibold text-cream transition hover:bg-mocha disabled:opacity-60"
          >
            <MailIcon className="h-5 w-5" /> {busy ? "Sending…" : "Send code to email"}
          </button>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={verify} className="space-y-4">
          <BackButton onClick={() => setStep("form")} />
          <h2 className="font-display text-xl font-bold text-espresso">Enter your code</h2>
          <p className="text-sm text-charcoal/60">
            We emailed a 6-digit code to <span className="font-semibold text-espresso">{email}</span>.
          </p>
          {devCode && (
            <p className="rounded-lg bg-oat/60 px-3 py-2 text-xs text-charcoal/70">
              Test mode — your code is <span className="font-mono font-bold">{devCode}</span> (real email delivery
              takes over once it's connected).
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
          <button
            type="submit"
            disabled={busy || code.length < 6}
            className="btn-3d w-full rounded-full bg-terracotta px-6 py-3 font-semibold text-cream disabled:opacity-60"
          >
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
