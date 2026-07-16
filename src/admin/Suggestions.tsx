import { useEffect, useState } from "react";
import { useToast } from "../context/ToastContext";
import { api, formatDateTime } from "../lib/api";
import type { Suggestion, SuggestionStatus } from "../types";

const STATUSES: SuggestionStatus[] = ["NEW", "REVIEWED", "RESOLVED"];

const STATUS_CLS: Record<SuggestionStatus, string> = {
  NEW: "bg-terracotta/15 text-terracotta-dark",
  REVIEWED: "bg-oat text-charcoal/70",
  RESOLVED: "bg-sage/20 text-sage-dark",
};

export function AdminSuggestions() {
  const toast = useToast();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [filter, setFilter] = useState("");
  const [notes, setNotes] = useState<Record<number, string>>({});

  const load = () =>
    api.get<Suggestion[]>(`/api/suggestions${filter ? `?status=${filter}` : ""}`).then((rows) => {
      setSuggestions(rows);
      setNotes(Object.fromEntries(rows.map((s) => [s.id, s.adminNote ?? ""])));
    });

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function setStatus(s: Suggestion, status: SuggestionStatus) {
    try {
      await api.patch(`/api/suggestions/${s.id}`, { status });
      toast(`Marked ${status.toLowerCase()}.`);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't update.", "error");
    }
  }

  async function saveNote(s: Suggestion) {
    try {
      await api.patch(`/api/suggestions/${s.id}`, { adminNote: notes[s.id] ?? "" });
      toast("Note saved.");
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save note.", "error");
    }
  }

  return (
    <div>
      <h1 className="font-display text-espresso text-3xl font-bold">Suggestions</h1>
      <p className="text-charcoal/60 mt-1 text-sm">Feedback, ideas, and complaints from customers — only visible to admins.</p>

      <div className="mt-4 flex gap-2">
        {["", ...STATUSES].map((f) => (
          <button
            key={f || "all"}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${filter === f ? "bg-espresso text-cream" : "bg-oat text-espresso"}`}
          >
            {f || "All"}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-4">
        {suggestions.length === 0 && <p className="text-charcoal/60 rounded-2xl bg-white p-8 text-center shadow-sm">No suggestions yet.</p>}
        {suggestions.map((s) => (
          <div key={s.id} className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-espresso font-semibold">
                  {s.name || s.customer?.name || "Anonymous"}
                  {s.customer && <span className="bg-sage/20 text-sage-dark ml-2 rounded-full px-2 py-0.5 text-xs font-semibold">account</span>}
                </p>
                <p className="text-charcoal/50 text-xs">
                  {s.phone || s.customer?.phone || "no phone"} · {formatDateTime(s.createdAt)}
                </p>
              </div>
              <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${STATUS_CLS[s.status]}`}>{s.status}</span>
            </div>

            <p className="bg-oat/30 text-charcoal/90 mt-3 rounded-xl p-3 text-sm whitespace-pre-wrap">{s.message}</p>

            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="text-espresso flex-1 text-xs font-semibold">
                Admin note
                <input
                  value={notes[s.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [s.id]: e.target.value }))}
                  placeholder="Internal note (not shown to the customer)"
                  className="border-oat mt-1 block w-full rounded-lg border px-3 py-1.5 font-normal"
                />
              </label>
              <button onClick={() => saveNote(s)} className="bg-oat hover:bg-espresso hover:text-cream rounded-full px-4 py-1.5 text-sm font-semibold">
                Save note
              </button>
            </div>

            <div className="mt-3 flex gap-2">
              {STATUSES.map((st) => (
                <button
                  key={st}
                  onClick={() => setStatus(s, st)}
                  disabled={s.status === st}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    s.status === st ? "bg-espresso text-cream cursor-default" : "bg-oat text-espresso hover:bg-oat/70"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
