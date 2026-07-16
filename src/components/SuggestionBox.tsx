import { FormEvent, useEffect, useState } from "react";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { useToast } from "../context/ToastContext";
import { customerApi } from "../lib/api";

export function SuggestionBox() {
  const { account } = useCustomerAuth();
  const toast = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Prefill from the logged-in account (still editable).
  useEffect(() => {
    if (account) {
      setName((n) => n || account.name);
      setPhone((p) => p || account.phone || "");
    }
  }, [account]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (sending || !message.trim()) return;
    setSending(true);
    try {
      // customerApi sends the customer token when logged in, otherwise it's anonymous.
      await customerApi.post("/api/suggestions", {
        name: name.trim() || undefined,
        phone: phone.trim() || undefined,
        message: message.trim(),
      });
      setSent(true);
      setMessage("");
      toast("Thanks for your feedback! 💌");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't send — please try again.", "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <section id="suggestions" className="mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <h2 className="font-display text-espresso text-2xl font-bold">Have a suggestion? We'd love to hear from you.</h2>
      <p className="text-charcoal/70 mt-2 text-sm">
        Your feedback helps us improve Bean Avenue. You can leave your name and phone number if you want us to contact you back.
      </p>

      {sent ? (
        <div className="bg-sage/15 mt-6 rounded-2xl p-6 text-center">
          <p className="text-3xl">🫶</p>
          <p className="text-espresso mt-2 font-semibold">Got it — thank you!</p>
          <p className="text-charcoal/70 mt-1 text-sm">We read every message and use it to make Bean Avenue better.</p>
          <button onClick={() => setSent(false)} className="bg-oat text-espresso hover:bg-oat/70 mt-4 rounded-full px-5 py-2 text-sm font-semibold">
            Send another
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-espresso block text-sm font-semibold">
              Name <span className="text-charcoal/50 font-normal">(optional)</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border-oat mt-1 w-full rounded-xl border px-4 py-2.5 font-normal"
                autoComplete="name"
              />
            </label>
            <label className="text-espresso block text-sm font-semibold">
              Phone <span className="text-charcoal/50 font-normal">(optional)</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="border-oat mt-1 w-full rounded-xl border px-4 py-2.5 font-normal"
                autoComplete="tel"
              />
            </label>
          </div>
          <label className="text-espresso block text-sm font-semibold">
            Message <span className="text-terracotta-dark">*</span>
            <textarea
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Suggestions, feedback, complaints, or ideas — we're all ears."
              className="border-oat mt-1 w-full rounded-xl border px-4 py-2.5 font-normal"
            />
          </label>
          <button
            type="submit"
            disabled={sending || !message.trim()}
            className="btn-3d bg-terracotta text-cream hover:bg-terracotta-dark w-full rounded-full px-6 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {sending ? "Sending…" : "Send suggestion"}
          </button>
        </form>
      )}
    </section>
  );
}
