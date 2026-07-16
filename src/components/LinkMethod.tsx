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

  const target: OtpTarget = channel === "phone" ? { channel: "phone", countryCode, phone: input } : { channel: "email", email: input };

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
    <div className="border-oat rounded-xl border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-charcoal/40 text-xs font-semibold tracking-wide uppercase">{label}</p>
          <p className="text-espresso truncate font-medium">{value || "Not added"}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {value ? (
            verified ? (
              <span className="bg-sage/20 text-sage-dark inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold">
                <CheckIcon className="h-3 w-3" /> Verified
              </span>
            ) : (
              <span className="bg-terracotta/15 text-terracotta-dark rounded-full px-2.5 py-0.5 text-xs font-bold">Not verified</span>
            )
          ) : null}
          <button
            onClick={() => (open ? reset() : setOpen(true))}
            className="bg-oat hover:bg-espresso hover:text-cream rounded-full px-3 py-1 text-xs font-semibold"
          >
            {open ? "Cancel" : value ? "Change" : `Add ${label.toLowerCase()}`}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-oat mt-3 border-t pt-3">
          {step === "enter" ? (
            <div className="flex flex-wrap items-end gap-2">
              {channel === "phone" && (
                <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className="border-oat rounded-lg border px-2 py-2 text-sm">
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
              )}
              <input
                autoFocus
                type={channel === "phone" ? "tel" : "email"}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={channel === "phone" ? "03 111 222" : "you@example.com"}
                className="border-oat flex-1 rounded-lg border px-3 py-2 text-sm"
              />
              <button
                onClick={send}
                disabled={busy || !input.trim()}
                className="bg-espresso text-cream rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {busy ? "Sending…" : "Send code"}
              </button>
            </div>
          ) : (
            <div>
              {devCode && (
                <p className="bg-oat/60 text-charcoal/70 mb-2 rounded-lg px-3 py-1.5 text-xs">
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
                  className="border-oat w-36 rounded-lg border px-3 py-2 text-center text-sm tracking-widest"
                />
                <button
                  onClick={verify}
                  disabled={busy || code.length < 6}
                  className="bg-terracotta text-cream rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  {busy ? "Verifying…" : "Verify"}
                </button>
                <button onClick={() => setStep("enter")} className="text-charcoal/50 hover:text-espresso text-xs font-semibold">
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
