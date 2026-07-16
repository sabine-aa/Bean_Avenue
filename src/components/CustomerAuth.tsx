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
  const [mode, setMode] = useState<"signup" | "login">("signup");
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
          <h2 className="font-display text-espresso text-xl font-bold">{mode === "login" ? "Welcome back" : "Create your account"}</h2>
          <p className="text-charcoal/60 text-sm">
            {mode === "login" ? (
              <>Enter your email and we'll send you a one-time code. No passwords.</>
            ) : (
              <>
                Enter your details — we'll send a one-time code to your <span className="text-espresso font-semibold">email</span> to verify it. No passwords.
              </>
            )}
          </p>
          {mode === "signup" && (
            <>
              <div className="flex gap-2">
                <label className="text-espresso min-w-0 flex-1 text-sm font-semibold">
                  First name
                  <input required autoFocus value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Sara" className={inputCls} />
                </label>
                <label className="text-espresso min-w-0 flex-1 text-sm font-semibold">
                  Last name
                  <input required value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Khoury" className={inputCls} />
                </label>
              </div>
              <div className="flex gap-2">
                <label className="text-espresso w-32 shrink-0 text-sm font-semibold sm:w-36">
                  Country
                  <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className="border-oat mt-1 w-full rounded-xl border px-2 py-2.5">
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-espresso min-w-0 flex-1 text-sm font-semibold">
                  Phone number
                  <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03 111 222" className={inputCls} />
                </label>
              </div>
            </>
          )}
          <label className="text-espresso block text-sm font-semibold">
            Email address
            <input
              required
              autoFocus={mode === "login"}
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
            className="btn-3d bg-espresso text-cream hover:bg-mocha flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 font-semibold transition disabled:opacity-60"
          >
            <MailIcon className="h-5 w-5" /> {busy ? "Sending…" : "Send code to email"}
          </button>
          <p className="text-charcoal/60 text-center text-sm">
            {mode === "signup" ? (
              <>
                Already have an account?{" "}
                <button type="button" onClick={() => setMode("login")} className="text-terracotta font-semibold hover:underline">
                  Log in
                </button>
              </>
            ) : (
              <>
                New to Bean Avenue?{" "}
                <button type="button" onClick={() => setMode("signup")} className="text-terracotta font-semibold hover:underline">
                  Create an account
                </button>
              </>
            )}
          </p>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={verify} className="space-y-4">
          <BackButton onClick={() => setStep("form")} />
          <h2 className="font-display text-espresso text-xl font-bold">Enter your code</h2>
          <p className="text-charcoal/60 text-sm">
            We emailed a 6-digit code to <span className="text-espresso font-semibold">{email}</span>.
          </p>
          {devCode && (
            <p className="bg-oat/60 text-charcoal/70 rounded-lg px-3 py-2 text-xs">
              Test mode — your code is <span className="font-mono font-bold">{devCode}</span> (real email delivery takes over once it's connected).
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
            className="border-oat w-full rounded-xl border px-4 py-3 text-center text-2xl tracking-[0.5em]"
          />
          <button
            type="submit"
            disabled={busy || code.length < 6}
            className="btn-3d bg-terracotta text-cream w-full rounded-full px-6 py-3 font-semibold disabled:opacity-60"
          >
            {busy ? "Verifying…" : "Verify & continue"}
          </button>
          <button
            type="button"
            onClick={resend}
            disabled={resendIn > 0 || busy}
            className="text-terracotta disabled:text-charcoal/40 w-full text-sm font-semibold"
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
    <button type="button" onClick={onClick} className="text-charcoal/50 hover:text-espresso text-sm font-semibold">
      ← Back
    </button>
  );
}
