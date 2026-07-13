import { useEffect, useState } from "react";
import { api, formatDateTime, money } from "../lib/api";

type Movement = { id: number; type: "PAYIN" | "PAYOUT"; amount: number; reason: string; staffName: string; createdAt: string };
type Shift = {
  id: number; staffName: string; terminal: string; status: "OPEN" | "CLOSED";
  openingFloat: number; cashPayIns: number; cashPayOuts: number;
  countedCash: number | null; expectedCash: number | null; difference: number | null;
  note: string | null; openedAt: string; closedAt: string | null;
  salesCount: number; cashSales: number; cardSales: number; movements: Movement[];
};

// Expected drawer cash: stored value once closed, otherwise computed live.
const expectedOf = (s: Shift) =>
  s.expectedCash != null ? s.expectedCash : s.openingFloat + s.cashSales + s.cashPayIns - s.cashPayOuts;

function Figure({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-charcoal/45">{label}</p>
      <p className={`font-display text-lg font-bold ${tone ?? "text-espresso"}`}>{value}</p>
    </div>
  );
}

export function AdminShifts() {
  const [shifts, setShifts] = useState<Shift[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    api.get<Shift[]>("/api/staff/shifts").then(setShifts).catch(() => setShifts([]));
  }, []);

  if (shifts === null) return <p className="text-charcoal/60">Loading shifts…</p>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold text-espresso">Shifts &amp; cash drawer</h1>
        <p className="mt-1 text-sm text-charcoal/60">Register Z-reports — opening float, sales, and the counted-vs-expected cash for every shift.</p>
      </div>

      {shifts.length === 0 && <p className="rounded-2xl bg-white p-6 text-center text-charcoal/60 shadow-sm">No shifts recorded yet.</p>}

      <div className="space-y-3">
        {shifts.map((s) => {
          const expected = expectedOf(s);
          const diff = s.status === "CLOSED" && s.difference != null ? s.difference : null;
          const diffTone = diff == null ? "" : Math.abs(diff) < 0.005 ? "text-sage-dark" : diff < 0 ? "text-terracotta-dark" : "text-amber-700";
          const isOpen = open === s.id;
          return (
            <section key={s.id} className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="flex items-center gap-2 font-semibold text-espresso">
                    {s.terminal} · {s.staffName}
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${s.status === "OPEN" ? "bg-sage/25 text-sage-dark" : "bg-oat text-charcoal/60"}`}>
                      {s.status === "OPEN" ? "● Open" : "Closed"}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-charcoal/50">
                    {formatDateTime(s.openedAt)}{s.closedAt ? ` → ${formatDateTime(s.closedAt)}` : " → in progress"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-charcoal/45">{s.salesCount} sale{s.salesCount === 1 ? "" : "s"}</p>
                  <p className="font-display text-lg font-bold text-espresso">{money(s.cashSales + s.cardSales)}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <Figure label="Opening float" value={money(s.openingFloat)} />
                <Figure label="Cash sales" value={money(s.cashSales)} />
                <Figure label="Card sales" value={money(s.cardSales)} />
                <Figure label="Pay in / out" value={`${money(s.cashPayIns)} / ${money(s.cashPayOuts)}`} />
                <Figure label="Expected cash" value={money(expected)} />
                {s.status === "CLOSED" ? (
                  <Figure label="Counted" value={s.countedCash != null ? money(s.countedCash) : "—"} tone={diffTone} />
                ) : (
                  <Figure label="Counted" value="—" />
                )}
              </div>

              {diff != null && (
                <p className={`mt-3 text-sm font-semibold ${diffTone}`}>
                  {Math.abs(diff) < 0.005 ? "Drawer balanced ✓" : diff < 0 ? `Short ${money(Math.abs(diff))}` : `Over ${money(diff)}`}
                </p>
              )}
              {s.note && <p className="mt-2 text-sm text-charcoal/60">📝 {s.note}</p>}

              {s.movements.length > 0 && (
                <div className="mt-3">
                  <button onClick={() => setOpen(isOpen ? null : s.id)} className="text-xs font-semibold text-terracotta hover:underline">
                    {isOpen ? "Hide" : "Show"} {s.movements.length} cash movement{s.movements.length === 1 ? "" : "s"}
                  </button>
                  {isOpen && (
                    <div className="mt-2 space-y-1">
                      {s.movements.map((m) => (
                        <div key={m.id} className="flex items-center justify-between gap-2 border-b border-oat/60 py-1.5 text-sm last:border-0">
                          <span className="min-w-0 truncate">
                            <span className={`font-semibold ${m.type === "PAYIN" ? "text-sage-dark" : "text-terracotta-dark"}`}>
                              {m.type === "PAYIN" ? "+" : "−"}{money(m.amount)}
                            </span>{" "}
                            <span className="text-charcoal/50">{m.reason || (m.type === "PAYIN" ? "Pay in" : "Pay out")} · {m.staffName}</span>
                          </span>
                          <span className="shrink-0 text-xs text-charcoal/40">{formatDateTime(m.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
