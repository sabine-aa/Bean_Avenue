import { useState } from "react";
import { useCustomerAuth, type OtpTarget } from "../context/CustomerAuthContext";
import { useToast } from "../context/ToastContext";
import { COUNTRY_CODES } from "../lib/countries";
import { CheckIcon } from "./icons";

// A row in My Account for a login method (phone or email) showing its
// verified status, with an inline add/change + OTP verify flow.
export function LinkMethod({ channel }: { channel: "phone" | "email" }) {
  const { account, linkRequest, linkVerify } = useCustomerAuth();
  const toast = useToast();

  const value = channel === "phone" ? account?.phone : account?.email;
  const verified = channel === "phone" ? account?.phoneVerified : account?.emailVerified;
  const label = channel === "phone" ? "Phone" : "Email";

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"enter" | "code">("enter");
  const [countryCode, setCountryCode] = useState("+961");
  const [input, setInput] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [devCode, setDevCode] = useState<string>();

  const target: OtpTarget =
    channel === "phone" ? { channel: "phone", countryCode, phone: input } : { channel: "email", email: input };

  function reset() {
    setOpen(false);
    setStep("enter");
    setInput("");
    setCode("");
    setDevCode(undefined);
  }

  async function send() {
    if (busy || !input.trim()) return;
    setBusy(true);
    try {
      const res = await linkRequest(target);
      setDevCode(res.devCode);
      setStep("code");
      toast("Verification code sent.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't send a code.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (busy || code.length < 6) return;
    setBusy(true);
    try {
      await linkVerify(target, code.trim());
      toast(`${label} verified ✓`);
      reset();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't verify.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-oat p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-charcoal/40">{label}</p>
          <p className="truncate font-medium text-espresso">{value || "Not added"}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {value ? (
            verified ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-sage/20 px-2.5 py-0.5 text-xs font-bold text-sage-dark">
                <CheckIcon className="h-3 w-3" /> Verified
              </span>
            ) : (
              <span className="rounded-full bg-terracotta/15 px-2.5 py-0.5 text-xs font-bold text-terracotta-dark">
                Not verified
              </span>
            )
          ) : null}
          <button
            onClick={() => (open ? reset() : setOpen(true))}
            className="rounded-full bg-oat px-3 py-1 text-xs font-semibold hover:bg-espresso hover:text-cream"
          >
            {open ? "Cancel" : value ? "Change" : `Add ${label.toLowerCase()}`}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3 border-t border-oat pt-3">
          {step === "enter" ? (
            <div className="flex flex-wrap items-end gap-2">
              {channel === "phone" && (
                <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className="rounded-lg border border-oat px-2 py-2 text-sm">
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>{c.code}</option>
                  ))}
                </select>
              )}
              <input
                autoFocus
                type={channel === "phone" ? "tel" : "email"}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={channel === "phone" ? "03 111 222" : "you@example.com"}
                className="flex-1 rounded-lg border border-oat px-3 py-2 text-sm"
              />
              <button onClick={send} disabled={busy || !input.trim()} className="rounded-full bg-espresso px-4 py-2 text-sm font-semibold text-cream disabled:opacity-50">
                {busy ? "Sending…" : "Send code"}
              </button>
            </div>
          ) : (
            <div>
              {devCode && (
                <p className="mb-2 rounded-lg bg-oat/60 px-3 py-1.5 text-xs text-charcoal/70">
                  Dev code: <span className="font-mono font-bold">{devCode}</span>
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  autoFocus
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="6-digit code"
                  className="w-36 rounded-lg border border-oat px-3 py-2 text-center text-sm tracking-widest"
                />
                <button onClick={verify} disabled={busy || code.length < 6} className="rounded-full bg-terracotta px-4 py-2 text-sm font-semibold text-cream disabled:opacity-50">
                  {busy ? "Verifying…" : "Verify"}
                </button>
                <button onClick={() => setStep("enter")} className="text-xs font-semibold text-charcoal/50 hover:text-espresso">
                  Change {label.toLowerCase()}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
