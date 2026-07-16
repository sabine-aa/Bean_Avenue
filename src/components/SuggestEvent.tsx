import { FormEvent, useState } from "react";
import { useToast } from "../context/ToastContext";
import { customerApi } from "../lib/api";
import { EVENT_CATEGORIES } from "../lib/events";

const empty = {
  idea: "",
  category: "",
  description: "",
  preferredDay: "",
  preferredTime: "",
  name: "",
  phone: "",
  website: "", // honeypot — stays empty for real users
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const field =
  "mt-1.5 w-full rounded-xl border border-oat bg-white px-4 py-3 text-base text-charcoal transition focus:border-espresso focus:outline-none focus:ring-2 focus:ring-espresso/20";
const label = "block text-base font-semibold text-espresso";
const optional = <span className="text-charcoal/40 font-normal"> (optional)</span>;

/** "What should we host next?" — public event-idea submission form. */
export function SuggestEvent() {
  const toast = useToast();
  const [form, setForm] = useState(empty);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.idea.trim()) {
      setError("Please share your event idea so we know what to host.");
      return;
    }
    setError("");
    setSending(true);
    try {
      await customerApi.post("/api/event-suggestions", form);
      setSent(true);
      setForm(empty);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't send — please try again.", "error");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <section className="border-oat mx-auto max-w-3xl rounded-3xl border bg-white px-6 py-12 text-center shadow-sm sm:px-10">
        <p className="text-5xl">🎉</p>
        <h2 className="font-display text-espresso mt-4 text-2xl font-bold sm:text-3xl">Thank you! Your event idea has been sent to the Bean Avenue team.</h2>
        <button onClick={() => setSent(false)} className="btn-3d bg-espresso text-cream mt-6 rounded-full px-7 py-3 text-base font-semibold">
          Suggest another
        </button>
      </section>
    );
  }

  return (
    <section className="border-oat rounded-3xl border bg-white p-7 shadow-sm sm:p-10">
      <h2 className="font-display text-espresso text-3xl font-bold sm:text-4xl">What should we host next?</h2>
      <p className="text-charcoal/75 mt-3 max-w-2xl text-lg">Have an idea for a workshop, activity, or community event at Bean Avenue? Share it with us.</p>

      <form onSubmit={submit} className="mx-auto mt-8 grid max-w-3xl gap-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={label} htmlFor="se-idea">
            Event idea or title <span className="text-terracotta">*</span>
          </label>
          <input
            id="se-idea"
            value={form.idea}
            onChange={(e) => {
              setForm({ ...form, idea: e.target.value });
              if (error) setError("");
            }}
            placeholder="e.g. Beginner latte art class"
            aria-invalid={!!error}
            className={`${field} ${error ? "border-terracotta ring-terracotta/20 ring-2" : ""}`}
          />
          {error && <p className="text-terracotta-dark mt-1.5 text-sm font-semibold">{error}</p>}
        </div>

        <div>
          <label className={label} htmlFor="se-cat">
            Category{optional}
          </label>
          <select id="se-cat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={field}>
            <option value="">Choose a category…</option>
            {EVENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={label} htmlFor="se-day">
            Preferred day{optional}
          </label>
          <select id="se-day" value={form.preferredDay} onChange={(e) => setForm({ ...form, preferredDay: e.target.value })} className={field}>
            <option value="">No preference</option>
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className={label} htmlFor="se-desc">
            Short description{optional}
          </label>
          <textarea
            id="se-desc"
            rows={5}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Tell us a bit more about your idea…"
            className={field}
          />
        </div>

        <div>
          <label className={label} htmlFor="se-time">
            Preferred time{optional}
          </label>
          <input
            id="se-time"
            value={form.preferredTime}
            onChange={(e) => setForm({ ...form, preferredTime: e.target.value })}
            placeholder="e.g. Evenings, 6 PM"
            className={field}
          />
        </div>

        <div>
          <label className={label} htmlFor="se-name">
            Your name{optional}
          </label>
          <input id="se-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} />
        </div>

        <div className="sm:col-span-2">
          <label className={label} htmlFor="se-phone">
            Phone number{optional}
          </label>
          <input
            id="se-phone"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="So we can let you know if it happens"
            className={field}
          />
        </div>

        {/* Honeypot — hidden from users, catches bots */}
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={form.website}
          onChange={(e) => setForm({ ...form, website: e.target.value })}
          className="hidden"
          aria-hidden="true"
        />

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={sending}
            className="btn-3d bg-espresso text-cream w-full rounded-full px-8 py-4 text-lg font-semibold disabled:opacity-60 sm:w-auto"
          >
            {sending ? "Sending…" : "Submit Suggestion"}
          </button>
          <p className="text-charcoal/50 mt-3 text-sm">Your details stay private with the Bean Avenue team and are never shown publicly.</p>
        </div>
      </form>
    </section>
  );
}
