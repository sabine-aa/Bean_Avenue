import { FormEvent, useState } from "react";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";

export function OffersSignup() {
  const toast = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (sending || !phone.trim()) return;
    setSending(true);
    try {
      await api.post("/api/subscribers", { name: name.trim() || undefined, phone: phone.trim() });
      setDone(true);
      toast("You're on the list! 🎉");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't sign you up — try again.", "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-3xl bg-espresso p-6 text-cream shadow-lg sm:p-8">
      <h2 className="font-display text-2xl font-bold">Get Bean Avenue offers and updates</h2>
      <p className="mt-1 text-sm text-oat">
        Sign up to hear about special offers, new drinks, and events — straight to your phone.
      </p>

      {done ? (
        <p className="mt-5 rounded-2xl bg-sage/20 p-4 text-sm font-semibold text-cream">
          ✅ Thanks! We'll be in touch with the good stuff.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (optional)"
            autoComplete="name"
            className="w-full rounded-full border-0 bg-white px-4 py-2.5 text-charcoal placeholder:text-charcoal/50 sm:w-44"
          />
          <input
            required
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number"
            autoComplete="tel"
            className="w-full flex-1 rounded-full border-0 bg-white px-4 py-2.5 text-charcoal placeholder:text-charcoal/50"
          />
          <button
            type="submit"
            disabled={sending || !phone.trim()}
            className="btn-3d rounded-full bg-terracotta px-6 py-2.5 font-semibold text-cream transition hover:bg-terracotta-dark disabled:opacity-60"
          >
            {sending ? "…" : "Sign me up"}
          </button>
        </form>
      )}
    </section>
  );
}
