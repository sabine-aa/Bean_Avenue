import { FormEvent, useState } from "react";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";

export function OffersSignup() {
  const toast = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState(""); // local part; +961 is added on submit
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const local = phone.replace(/[^\d]/g, "").replace(/^0+/, ""); // digits only, no leading 0
    if (sending || !local) return;
    setSending(true);
    try {
      // The backend upserts on phone, so duplicates are never added twice.
      await api.post("/api/subscribers", { name: name.trim() || undefined, phone: `+961${local}` });
      setDone(true);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't sign you up — try again.", "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-3xl bg-espresso p-8 text-cream shadow-lg sm:p-10">
      <h2 className="font-display text-3xl font-bold sm:text-4xl">Get Bean Avenue offers and updates</h2>
      <p className="mt-3 max-w-2xl text-lg text-oat">
        Sign up to hear about special offers, new drinks, and events — straight to your phone.
      </p>

      {done ? (
        <div className="mt-6 flex items-center gap-3 rounded-2xl bg-sage/25 p-5 text-cream">
          <span className="text-2xl">✅</span>
          <div>
            <p className="text-lg font-bold">You're on the list!</p>
            <p className="text-sm text-oat">We'll be in touch with the good stuff. No spam, promise.</p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4 sm:flex-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (optional)"
            autoComplete="name"
            className="w-full rounded-full border-0 bg-white px-5 py-3.5 text-base text-charcoal placeholder:text-charcoal/50 sm:w-48"
          />
          <div className="flex w-full flex-1 items-center overflow-hidden rounded-full bg-white">
            <span className="select-none border-r border-oat py-3.5 pl-5 pr-3 text-base font-semibold text-charcoal/70">
              +961
            </span>
            <input
              required
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="70 123 456"
              autoComplete="tel"
              className="w-full border-0 bg-transparent px-3 py-3.5 text-base text-charcoal placeholder:text-charcoal/40 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={sending || !phone.trim()}
            className="btn-3d rounded-full bg-terracotta px-8 py-3.5 text-base font-semibold text-cream transition hover:bg-terracotta-dark disabled:opacity-60"
          >
            {sending ? "…" : "Sign me up"}
          </button>
        </form>
      )}
    </section>
  );
}
