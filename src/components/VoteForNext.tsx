import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { useToast } from "../context/ToastContext";
import { customerApi, formatDate } from "../lib/api";
import type { VotingOption } from "../types";
import { CalendarIcon } from "./icons";
import { Img } from "./Img";

type VoteDisplay = "OPEN" | "VOTED" | "CLOSED" | "SELECTED";

function displayStatus(o: VotingOption): VoteDisplay {
  if (o.status === "SELECTED") return "SELECTED";
  const closed = o.status === "CLOSED" || (o.closesAt != null && new Date(o.closesAt).getTime() < Date.now());
  if (closed) return "CLOSED";
  if (o.hasVoted) return "VOTED";
  return "OPEN";
}

const BADGE: Record<VoteDisplay, { label: string; cls: string }> = {
  OPEN: { label: "Voting Open", cls: "bg-espresso text-cream" },
  VOTED: { label: "Voted", cls: "bg-sage text-cream" },
  CLOSED: { label: "Voting Closed", cls: "bg-charcoal/70 text-cream" },
  SELECTED: { label: "Selected Event", cls: "bg-terracotta text-cream" },
};

export function VoteForNext() {
  const { account } = useCustomerAuth();
  const toast = useToast();
  const [options, setOptions] = useState<VotingOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);

  // Refetch when login state changes so each card's "hasVoted" reflects this account.
  useEffect(() => {
    customerApi
      .get<VotingOption[]>("/api/voting")
      .then(setOptions)
      .catch(() => setOptions([]))
      .finally(() => setLoaded(true));
  }, [account]);

  async function toggleVote(o: VotingOption) {
    if (!account) return;
    if (busy != null) return; // guard against rapid double-clicks
    setBusy(o.id);
    try {
      const path = `/api/voting/${o.id}/vote`;
      const res = o.hasVoted
        ? await customerApi.delete<{ hasVoted: boolean; voteCount: number }>(path)
        : await customerApi.post<{ hasVoted: boolean; voteCount: number }>(path, {});
      setOptions((prev) =>
        prev.map((x) => (x.id === o.id ? { ...x, hasVoted: res.hasVoted, voteCount: res.voteCount } : x))
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't record your vote.", "error");
    } finally {
      setBusy(null);
    }
  }

  if (!loaded) return null; // avoid flashing the empty state before the first load

  return (
    <section className="mt-14">
      <h2 className="font-display text-3xl font-bold text-espresso sm:text-4xl">Vote for What's Next</h2>
      <p className="mt-3 max-w-2xl text-lg text-charcoal/75">
        Help us choose what to host next — vote for the ideas you'd love to see at Bean Avenue.
      </p>

      {options.length === 0 ? (
        <div className="mx-auto mt-8 max-w-3xl rounded-3xl border border-oat bg-white px-6 py-10 text-center shadow-sm sm:px-10">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-oat text-espresso">
            <CalendarIcon className="h-9 w-9" />
          </span>
          <h3 className="mt-5 font-display text-2xl font-bold text-espresso sm:text-3xl">
            Voting opens soon
          </h3>
          <p className="mx-auto mt-3 max-w-xl text-lg text-charcoal/75">
            We are preparing new event ideas for the Bean Avenue community. Check back soon and
            help us choose what to host next.
          </p>
        </div>
      ) : (
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((o) => {
          const ds = displayStatus(o);
          const badge = BADGE[ds];
          const open = ds === "OPEN" || ds === "VOTED";
          return (
            <div key={o.id} className="card-lift flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm">
              {o.image && (
                <div className="relative">
                  <Img src={o.image} alt={o.title} className="aspect-[16/10] w-full bg-oat/30" />
                </div>
              )}
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  {o.category ? (
                    <span className="text-xs font-bold uppercase tracking-wide text-terracotta">{o.category}</span>
                  ) : <span />}
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${badge.cls}`}>
                    {badge.label}
                  </span>
                </div>
                <h3 className="mt-1 font-display text-lg font-bold leading-tight text-espresso">{o.title}</h3>
                {o.description && <p className="mt-2 line-clamp-3 flex-1 text-sm text-charcoal/70">{o.description}</p>}

                <div className="mt-3 space-y-0.5 text-xs text-charcoal/60">
                  {o.possibleDate && <p>📅 Possible: {o.possibleDate}</p>}
                  {o.closesAt && ds !== "SELECTED" && (
                    <p>{ds === "CLOSED" ? "Voting closed" : `Voting closes ${formatDate(o.closesAt)}`}</p>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-espresso">
                    {o.voteCount} vote{o.voteCount === 1 ? "" : "s"}
                  </span>
                  {ds === "SELECTED" ? (
                    <span className="rounded-full bg-terracotta/15 px-4 py-2 text-sm font-semibold text-terracotta-dark">
                      🎉 Selected
                    </span>
                  ) : !open ? (
                    <span className="cursor-not-allowed rounded-full bg-oat px-4 py-2 text-sm font-semibold text-charcoal/40">
                      Voting Closed
                    </span>
                  ) : !account ? (
                    <Link
                      to="/loyalty"
                      className="rounded-full bg-oat px-4 py-2 text-sm font-semibold text-espresso transition hover:bg-espresso hover:text-cream"
                    >
                      Log in to vote
                    </Link>
                  ) : (
                    <button
                      onClick={() => toggleVote(o)}
                      disabled={busy === o.id}
                      className={`btn-3d rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-60 ${
                        o.hasVoted ? "bg-sage text-cream" : "bg-espresso text-cream"
                      }`}
                    >
                      {busy === o.id ? "…" : o.hasVoted ? "Voted ✓" : "Vote"}
                    </button>
                  )}
                </div>
                {account && open && o.hasVoted && (
                  <p className="mt-1 text-right text-xs text-charcoal/40">Tap to remove your vote</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}
    </section>
  );
}
