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
      () => toast("Couldn't copy.", "error"),
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-espresso text-3xl font-bold">Offer Sign-ups</h1>
          <p className="text-charcoal/60 mt-1 text-sm">Customers who opted in to WhatsApp offers & updates ({subscribers.length}).</p>
        </div>
        {subscribers.length > 0 && (
          <button onClick={copyPhones} className="bg-espresso text-cream hover:bg-mocha rounded-full px-5 py-2 text-sm font-semibold">
            Copy all numbers
          </button>
        )}
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-oat text-charcoal/50 border-b text-left text-xs tracking-wide uppercase">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Signed up</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {subscribers.length === 0 && (
              <tr>
                <td colSpan={4} className="text-charcoal/60 px-4 py-8 text-center">
                  No sign-ups yet.
                </td>
              </tr>
            )}
            {subscribers.map((s) => (
              <tr key={s.id} className="border-oat/60 border-b">
                <td className="text-espresso px-4 py-3 font-semibold">{s.name || "—"}</td>
                <td className="px-4 py-3">
                  <a href={`tel:${s.phone}`} className="text-terracotta">
                    {s.phone}
                  </a>
                </td>
                <td className="text-charcoal/60 px-4 py-3">{formatDate(s.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => remove(s)} className="text-charcoal/40 hover:text-terracotta-dark text-xs font-semibold">
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
