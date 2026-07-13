import { useEffect, useMemo, useState } from "react";
import { api, formatDateTime } from "../lib/api";

type Row = {
  id: number; createdAt: string; actor: string; actorRole: string; source: string;
  section: string; action: string; entity: string | null; entityId: string | null;
  entityName: string | null; detail: string; oldValue: string | null; newValue: string | null;
  orderNumber: string | null;
};
type Options = { sections: string[]; actions: string[]; actors: string[]; sources: string[] };

const SECTION_COLOR: Record<string, string> = {
  POS: "bg-terracotta/15 text-terracotta-dark", Orders: "bg-terracotta/15 text-terracotta-dark",
  Menu: "bg-sage/20 text-sage-dark", Inventory: "bg-amber-400/25 text-amber-800",
  Hanson: "bg-[#e8b4cf]/30 text-[#9c3f6a]", Shop: "bg-mocha/15 text-mocha", Preorders: "bg-mocha/15 text-mocha",
  Staff: "bg-espresso/10 text-espresso", Register: "bg-[#5b3fd6]/12 text-[#5b3fd6]",
  Rooms: "bg-sage/20 text-sage-dark", Loyalty: "bg-sage/20 text-sage-dark", Payments: "bg-terracotta/15 text-terracotta-dark",
};
const label = (a: string) => a.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const prettyJson = (s: string | null) => {
  if (!s) return null;
  try { return JSON.stringify(JSON.parse(s), null, 2); } catch { return s; }
};

export function AdminActivityLog() {
  const [rows, setRows] = useState<Row[]>([]);
  const [opts, setOpts] = useState<Options>({ sections: [], actions: [], actors: [], sources: [] });
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Row | null>(null);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [section, setSection] = useState("");
  const [action, setAction] = useState("");
  const [source, setSource] = useState("");
  const [actor, setActor] = useState("");
  const [order, setOrder] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    api.get<Options>("/api/activity/options").then(setOpts).catch(() => {});
  }, []);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (section) p.set("section", section);
    if (action) p.set("action", action);
    if (source) p.set("source", source);
    if (actor) p.set("actor", actor);
    if (order) p.set("order", order);
    if (q.trim()) p.set("q", q.trim());
    return p.toString();
  }, [from, to, section, action, source, actor, order, q]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      api.get<{ rows: Row[] }>(`/api/activity${query ? `?${query}` : ""}`)
        .then((r) => setRows(r.rows))
        .catch(() => setRows([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const reset = () => { setFrom(""); setTo(""); setSection(""); setAction(""); setSource(""); setActor(""); setOrder(""); setQ(""); };
  const anyFilter = from || to || section || action || source || actor || order || q;
  const sel = "rounded-lg border border-oat bg-white px-3 py-2 text-sm";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold text-espresso">Activity log</h1>
        <p className="mt-1 text-sm text-charcoal/60">Who changed what, when, and from where — prices, stock, discounts, voids, shifts, staff and more.</p>
      </div>

      {/* Filters */}
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs font-semibold text-charcoal/55">From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={sel} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-charcoal/55">To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={sel} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-charcoal/55">Section
            <select value={section} onChange={(e) => setSection(e.target.value)} className={sel}>
              <option value="">All sections</option>
              {opts.sections.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-charcoal/55">Action
            <select value={action} onChange={(e) => setAction(e.target.value)} className={sel}>
              <option value="">All actions</option>
              {opts.actions.map((a) => <option key={a} value={a}>{label(a)}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-charcoal/55">Source
            <select value={source} onChange={(e) => setSource(e.target.value)} className={sel}>
              <option value="">All sources</option>
              {opts.sources.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-charcoal/55">User
            <select value={actor} onChange={(e) => setActor(e.target.value)} className={sel}>
              <option value="">All users</option>
              {opts.actors.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-charcoal/55">Order / Preorder #
            <input value={order} onChange={(e) => setOrder(e.target.value)} placeholder="e.g. POS-1042" className={sel} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-charcoal/55">Search
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Product, item, detail…" className={sel} />
          </label>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-charcoal/50">{loading ? "Loading…" : `${rows.length} record${rows.length === 1 ? "" : "s"}`}</p>
          {anyFilter && <button onClick={reset} className="text-xs font-semibold text-terracotta hover:underline">Clear filters</button>}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="hidden grid-cols-[auto,auto,auto,auto,1.6fr] gap-3 border-b border-oat px-4 py-2 text-xs font-bold uppercase tracking-wide text-charcoal/45 lg:grid">
          <span className="w-36">Time</span><span className="w-28">User</span><span className="w-24">Section</span><span className="w-36">Action</span><span>Details</span>
        </div>
        {rows.length === 0 && !loading && <p className="p-8 text-center text-charcoal/50">No activity matches these filters.</p>}
        {rows.map((r) => (
          <button key={r.id} onClick={() => setDetail(r)} className="grid w-full grid-cols-1 gap-1 border-b border-oat/60 px-4 py-3 text-left text-sm transition hover:bg-oat/30 lg:grid-cols-[auto,auto,auto,auto,1.6fr] lg:items-center lg:gap-3">
            <span className="w-36 shrink-0 text-xs text-charcoal/55">{formatDateTime(r.createdAt)}</span>
            <span className="w-28 shrink-0"><span className="font-semibold text-espresso">{r.actor}</span><span className="block text-[11px] text-charcoal/45">{r.actorRole} · {r.source}</span></span>
            <span className="w-24 shrink-0"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${SECTION_COLOR[r.section] ?? "bg-oat text-charcoal/60"}`}>{r.section}</span></span>
            <span className="w-36 shrink-0 text-xs font-semibold text-charcoal/70">{label(r.action)}</span>
            <span className="min-w-0 truncate text-charcoal/80">{r.detail}</span>
          </button>
        ))}
      </div>

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDetail(null)}>
          <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${SECTION_COLOR[detail.section] ?? "bg-oat text-charcoal/60"}`}>{detail.section}</span>
                <h2 className="mt-2 font-display text-2xl font-bold text-espresso">{label(detail.action)}</h2>
                <p className="mt-1 text-sm text-charcoal/70">{detail.detail}</p>
              </div>
              <button onClick={() => setDetail(null)} className="text-charcoal/40 hover:text-charcoal">✕</button>
            </div>

            <dl className="mt-4 grid grid-cols-3 gap-y-2 text-sm">
              <dt className="text-charcoal/45">When</dt><dd className="col-span-2 font-medium text-espresso">{formatDateTime(detail.createdAt)}</dd>
              <dt className="text-charcoal/45">User</dt><dd className="col-span-2 font-medium text-espresso">{detail.actor} <span className="text-charcoal/45">({detail.actorRole})</span></dd>
              <dt className="text-charcoal/45">From</dt><dd className="col-span-2 font-medium text-espresso">{detail.source}</dd>
              {detail.entityName && <><dt className="text-charcoal/45">Item</dt><dd className="col-span-2 font-medium text-espresso">{detail.entityName}{detail.entity ? ` (${detail.entity})` : ""}</dd></>}
              {detail.orderNumber && <><dt className="text-charcoal/45">Order</dt><dd className="col-span-2 font-medium text-espresso">{detail.orderNumber}</dd></>}
            </dl>

            {(detail.oldValue || detail.newValue) && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {detail.oldValue && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-charcoal/45">Old value</p>
                    <pre className="mt-1 overflow-x-auto rounded-lg bg-terracotta/5 p-3 text-xs text-terracotta-dark">{prettyJson(detail.oldValue)}</pre>
                  </div>
                )}
                {detail.newValue && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-charcoal/45">New value</p>
                    <pre className="mt-1 overflow-x-auto rounded-lg bg-sage/10 p-3 text-xs text-sage-dark">{prettyJson(detail.newValue)}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
