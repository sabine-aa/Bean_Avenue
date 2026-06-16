import { useEffect, useState } from "react";
import { useToast } from "../context/ToastContext";
import { api, formatDate } from "../lib/api";
import type { Subscriber } from "../types";

export function AdminSubscribers() {
  const toast = useToast();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);

  const load = () => api.get<Subscriber[]>("/api/subscribers").then(setSubscribers);
  useEffect(() => {
    load();
  }, []);

  async function remove(s: Subscriber) {
    if (!confirm(`Remove ${s.phone} from the list?`)) return;
    await api.delete(`/api/subscribers/${s.id}`);
    toast("Removed.");
    load();
  }

  function copyPhones() {
    const text = subscribers.map((s) => s.phone).join(", ");
    navigator.clipboard?.writeText(text).then(
      () => toast(`Copied ${subscribers.length} numbers.`),
      () => toast("Couldn't copy.", "error")
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-espresso">Offer Sign-ups</h1>
          <p className="mt-1 text-sm text-charcoal/60">
            Customers who opted in to WhatsApp offers & updates ({subscribers.length}).
          </p>
        </div>
        {subscribers.length > 0 && (
          <button
            onClick={copyPhones}
            className="rounded-full bg-espresso px-5 py-2 text-sm font-semibold text-cream hover:bg-mocha"
          >
            Copy all numbers
          </button>
        )}
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-oat text-left text-xs uppercase tracking-wide text-charcoal/50">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Signed up</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {subscribers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-charcoal/60">
                  No sign-ups yet.
                </td>
              </tr>
            )}
            {subscribers.map((s) => (
              <tr key={s.id} className="border-b border-oat/60">
                <td className="px-4 py-3 font-semibold text-espresso">{s.name || "—"}</td>
                <td className="px-4 py-3">
                  <a href={`tel:${s.phone}`} className="text-terracotta">{s.phone}</a>
                </td>
                <td className="px-4 py-3 text-charcoal/60">{formatDate(s.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => remove(s)}
                    className="text-xs font-semibold text-charcoal/40 hover:text-terracotta-dark"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
