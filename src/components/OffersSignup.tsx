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
    <section className="bg-espresso text-cream overflow-hidden rounded-3xl p-8 shadow-lg sm:p-10">
      <h2 className="font-display text-3xl font-bold sm:text-4xl">Get Bean Avenue offers and updates</h2>
      <p className="text-oat mt-3 max-w-2xl text-lg">Sign up to hear about special offers, new drinks, and events — straight to your phone.</p>

      {done ? (
        <div className="bg-sage/25 text-cream mt-6 flex items-center gap-3 rounded-2xl p-5">
          <span className="text-2xl">✅</span>
          <div>
            <p className="text-lg font-bold">You're on the list!</p>
            <p className="text-oat text-sm">We'll be in touch with the good stuff. No spam, promise.</p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4 sm:flex-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (optional)"
            autoComplete="name"
            className="text-charcoal placeholder:text-charcoal/50 w-full rounded-full border-0 bg-white px-5 py-3.5 text-base sm:w-48"
          />
          <div className="flex w-full flex-1 items-center overflow-hidden rounded-full bg-white">
            <span className="border-oat text-charcoal/70 border-r py-3.5 pr-3 pl-5 text-base font-semibold select-none">+961</span>
            <input
              required
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="70 123 456"
              autoComplete="tel"
              className="text-charcoal placeholder:text-charcoal/40 w-full border-0 bg-transparent px-3 py-3.5 text-base focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={sending || !phone.trim()}
            className="btn-3d bg-terracotta text-cream hover:bg-terracotta-dark rounded-full px-8 py-3.5 text-base font-semibold transition disabled:opacity-60"
          >
            {sending ? "…" : "Sign me up"}
          </button>
        </form>
      )}
    </section>
  );
}
