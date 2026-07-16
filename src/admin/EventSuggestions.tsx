import { useEffect, useState } from "react";
import { useToast } from "../context/ToastContext";
import { api, formatDateTime } from "../lib/api";
import type { EventSuggestion, EventSuggestionStatus } from "../types";
import { VotingManager } from "./VotingManager";

const STATUSES: EventSuggestionStatus[] = ["NEW", "REVIEWED", "CONSIDERING", "APPROVED", "REJECTED"];

const STATUS_CLS: Record<EventSuggestionStatus, string> = {
  NEW: "bg-terracotta/15 text-terracotta-dark",
  REVIEWED: "bg-oat text-charcoal/70",
  CONSIDERING: "bg-sage/20 text-sage-dark",
  APPROVED: "bg-espresso text-cream",
  REJECTED: "bg-charcoal/15 text-charcoal/60",
};

export function AdminEventSuggestions() {
  const toast = useToast();
  const [rows, setRows] = useState<EventSuggestion[]>([]);
  const [filter, setFilter] = useState("");
  const [notes, setNotes] = useState<Record<number, string>>({});

  const load = () =>
    api.get<EventSuggestion[]>(`/api/event-suggestions${filter ? `?status=${filter}` : ""}`).then((data) => {
      setRows(data);
      setNotes(Object.fromEntries(data.map((s) => [s.id, s.adminNote ?? ""])));
    });

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function setStatus(s: EventSuggestion, status: EventSuggestionStatus) {
    try {
      await api.patch(`/api/event-suggestions/${s.id}`, { status });
      toast(`Marked ${status.toLowerCase()}.`);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't update.", "error");
    }
  }

  async function saveNote(s: EventSuggestion) {
    try {
      await api.patch(`/api/event-suggestions/${s.id}`, { adminNote: notes[s.id] ?? "" });
      toast("Note saved.");
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save note.", "error");
    }
  }

  async function remove(s: EventSuggestion) {
    if (!confirm("Delete this suggestion? This cannot be undone.")) return;
    try {
      await api.delete(`/api/event-suggestions/${s.id}`);
      toast("Suggestion deleted.");
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't delete.", "error");
    }
  }

  async function convertToVoting(s: EventSuggestion) {
    if (!confirm(`Publish "${s.idea}" as a voting option? You can edit it below before publishing it to customers.`)) return;
    try {
      await api.post(`/api/voting/from-suggestion/${s.id}`, {});
      toast("Added to voting options below — review, then publish it.");
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't convert.", "error");
    }
  }

  return (
    <div>
      <h1 className="font-display text-espresso text-3xl font-bold">Event Suggestions &amp; Voting</h1>
      <p className="text-charcoal/60 mt-1 text-sm">
        Customer event ideas — private to the team. Review them, convert the best into voting options, then let customers vote. Customer details are never shown
        publicly.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
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
        {rows.length === 0 && <p className="text-charcoal/60 rounded-2xl bg-white p-8 text-center shadow-sm">No event suggestions yet.</p>}
        {rows.map((s) => (
          <div key={s.id} className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display text-espresso text-lg font-bold">{s.idea}</p>
                <p className="text-charcoal/50 mt-0.5 text-xs">
                  {s.category && <span className="text-terracotta font-semibold">{s.category}</span>}
                  {s.category && " · "}
                  {formatDateTime(s.createdAt)}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-3 py-0.5 text-xs font-semibold ${STATUS_CLS[s.status]}`}>{s.status}</span>
            </div>

            {s.description && <p className="bg-oat/30 text-charcoal/90 mt-3 rounded-xl p-3 text-sm whitespace-pre-wrap">{s.description}</p>}

            {(s.preferredDay || s.preferredTime) && (
              <p className="text-charcoal/60 mt-2 text-xs">Preferred: {[s.preferredDay, s.preferredTime].filter(Boolean).join(" · ")}</p>
            )}

            {/* Private contact details — admin only */}
            <p className="text-charcoal/50 mt-2 text-xs">
              From: {s.name || "Anonymous"}
              {s.phone && ` · ${s.phone}`}
              {s.customerId && <span className="bg-sage/20 text-sage-dark ml-2 rounded-full px-2 py-0.5 font-semibold">account #{s.customerId}</span>}
            </p>

            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="text-espresso flex-1 text-xs font-semibold">
                Admin note
                <input
                  value={notes[s.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [s.id]: e.target.value }))}
                  placeholder="Internal note (private)"
                  className="border-oat mt-1 block w-full rounded-lg border px-3 py-1.5 font-normal"
                />
              </label>
              <button onClick={() => saveNote(s)} className="bg-oat hover:bg-espresso hover:text-cream rounded-full px-4 py-1.5 text-sm font-semibold">
                Save note
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
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
              <button
                onClick={() => convertToVoting(s)}
                className="bg-sage/20 text-sage-dark hover:bg-sage hover:text-cream ml-auto rounded-full px-3 py-1 text-xs font-semibold"
              >
                Convert to voting
              </button>
              <button
                onClick={() => remove(s)}
                className="bg-terracotta/15 text-terracotta-dark hover:bg-terracotta hover:text-cream rounded-full px-3 py-1 text-xs font-semibold"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Voting management lives on the same page */}
      <VotingManager />
    </div>
  );
}
