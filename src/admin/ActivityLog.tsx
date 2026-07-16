import { useEffect, useMemo, useState } from "react";
import { api, formatDateTime } from "../lib/api";

type Row = {
  id: number;
  createdAt: string;
  actor: string;
  actorRole: string;
  source: string;
  section: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  entityName: string | null;
  detail: string;
  oldValue: string | null;
  newValue: string | null;
  orderNumber: string | null;
};
type Options = { sections: string[]; actions: string[]; actors: string[]; sources: string[] };

const SECTION_COLOR: Record<string, string> = {
  POS: "bg-terracotta/15 text-terracotta-dark",
  Orders: "bg-terracotta/15 text-terracotta-dark",
  Menu: "bg-sage/20 text-sage-dark",
  Inventory: "bg-amber-400/25 text-amber-800",
  Hanson: "bg-[#e8b4cf]/30 text-[#9c3f6a]",
  Shop: "bg-mocha/15 text-mocha",
  Preorders: "bg-mocha/15 text-mocha",
  Staff: "bg-espresso/10 text-espresso",
  Register: "bg-[#5b3fd6]/12 text-[#5b3fd6]",
  Rooms: "bg-sage/20 text-sage-dark",
  Loyalty: "bg-sage/20 text-sage-dark",
  Payments: "bg-terracotta/15 text-terracotta-dark",
};
const label = (a: string) => a.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

const csvCell = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
function toCsv(rows: Row[]): string {
  const head = ["Date/time", "User", "Role", "Source", "Section", "Action", "Description", "Entity", "Item / Order", "Old value", "New value"];
  const body = rows.map((r) =>
    [
      formatDateTime(r.createdAt),
      r.actor,
      r.actorRole,
      r.source,
      r.section,
      label(r.action),
      r.detail,
      r.entity ?? "",
      r.entityName ?? r.orderNumber ?? "",
      r.oldValue ?? "",
      r.newValue ?? "",
    ]
      .map(csvCell)
      .join(","),
  );
  return [head.map(csvCell).join(","), ...body].join("\r\n");
}
const prettyJson = (s: string | null) => {
  if (!s) return null;
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
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
    api
      .get<Options>("/api/activity/options")
      .then(setOpts)
      .catch(() => {});
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
      api
        .get<{ rows: Row[] }>(`/api/activity${query ? `?${query}` : ""}`)
        .then((r) => setRows(r.rows))
        .catch(() => setRows([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const reset = () => {
    setFrom("");
    setTo("");
    setSection("");
    setAction("");
    setSource("");
    setActor("");
    setOrder("");
    setQ("");
  };
  const anyFilter = from || to || section || action || source || actor || order || q;
  const sel = "rounded-lg border border-oat bg-white px-3 py-2 text-sm";

  const [exporting, setExporting] = useState(false);
  async function exportCsv() {
    setExporting(true);
    try {
      // Pull the full filtered set (not just the page's default cap) so the export matches the filters.
      const data = await api.get<{ rows: Row[] }>(`/api/activity?${query ? `${query}&` : ""}limit=5000`);
      const csv = "﻿" + toCsv(data.rows); // BOM → Excel reads UTF-8 correctly
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-espresso text-3xl font-bold">Activity log</h1>
            <p className="text-charcoal/60 mt-1 text-sm">Who changed what, when, and from where — prices, stock, add-ons, rooms, rewards, shifts and more.</p>
          </div>
          <button
            onClick={exportCsv}
            disabled={exporting || rows.length === 0}
            className="bg-espresso text-cream hover:bg-mocha rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
          >
            {exporting ? "Exporting…" : "⬇ Export CSV"}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-charcoal/55 flex flex-col gap-1 text-xs font-semibold">
            From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={sel} />
          </label>
          <label className="text-charcoal/55 flex flex-col gap-1 text-xs font-semibold">
            To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={sel} />
          </label>
          <label className="text-charcoal/55 flex flex-col gap-1 text-xs font-semibold">
            Section
            <select value={section} onChange={(e) => setSection(e.target.value)} className={sel}>
              <option value="">All sections</option>
              {opts.sections.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="text-charcoal/55 flex flex-col gap-1 text-xs font-semibold">
            Action
            <select value={action} onChange={(e) => setAction(e.target.value)} className={sel}>
              <option value="">All actions</option>
              {opts.actions.map((a) => (
                <option key={a} value={a}>
                  {label(a)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-charcoal/55 flex flex-col gap-1 text-xs font-semibold">
            Source
            <select value={source} onChange={(e) => setSource(e.target.value)} className={sel}>
              <option value="">All sources</option>
              {opts.sources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="text-charcoal/55 flex flex-col gap-1 text-xs font-semibold">
            User
            <select value={actor} onChange={(e) => setActor(e.target.value)} className={sel}>
              <option value="">All users</option>
              {opts.actors.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="text-charcoal/55 flex flex-col gap-1 text-xs font-semibold">
            Order / Preorder #
            <input value={order} onChange={(e) => setOrder(e.target.value)} placeholder="e.g. POS-1042" className={sel} />
          </label>
          <label className="text-charcoal/55 flex flex-col gap-1 text-xs font-semibold">
            Search
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Product, item, detail…" className={sel} />
          </label>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-charcoal/50 text-xs">{loading ? "Loading…" : `${rows.length} record${rows.length === 1 ? "" : "s"}`}</p>
          {anyFilter && (
            <button onClick={reset} className="text-terracotta text-xs font-semibold hover:underline">
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="border-oat text-charcoal/45 hidden grid-cols-[auto,auto,auto,auto,1.6fr] gap-3 border-b px-4 py-2 text-xs font-bold tracking-wide uppercase lg:grid">
          <span className="w-36">Time</span>
          <span className="w-28">User</span>
          <span className="w-24">Section</span>
          <span className="w-36">Action</span>
          <span>Details</span>
        </div>
        {rows.length === 0 && !loading && <p className="text-charcoal/50 p-8 text-center">No activity matches these filters.</p>}
        {rows.map((r) => (
          <button
            key={r.id}
            onClick={() => setDetail(r)}
            className="border-oat/60 hover:bg-oat/30 grid w-full grid-cols-1 gap-1 border-b px-4 py-3 text-left text-sm transition lg:grid-cols-[auto,auto,auto,auto,1.6fr] lg:items-center lg:gap-3"
          >
            <span className="text-charcoal/55 w-36 shrink-0 text-xs">{formatDateTime(r.createdAt)}</span>
            <span className="w-28 shrink-0">
              <span className="text-espresso font-semibold">{r.actor}</span>
              <span className="text-charcoal/45 block text-[11px]">
                {r.actorRole} · {r.source}
              </span>
            </span>
            <span className="w-24 shrink-0">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${SECTION_COLOR[r.section] ?? "bg-oat text-charcoal/60"}`}>{r.section}</span>
            </span>
            <span className="text-charcoal/70 w-36 shrink-0 text-xs font-semibold">{label(r.action)}</span>
            <span className="text-charcoal/80 min-w-0 truncate">{r.detail}</span>
          </button>
        ))}
      </div>

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDetail(null)}>
          <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${SECTION_COLOR[detail.section] ?? "bg-oat text-charcoal/60"}`}>
                  {detail.section}
                </span>
                <h2 className="font-display text-espresso mt-2 text-2xl font-bold">{label(detail.action)}</h2>
                <p className="text-charcoal/70 mt-1 text-sm">{detail.detail}</p>
              </div>
              <button onClick={() => setDetail(null)} className="text-charcoal/40 hover:text-charcoal">
                ✕
              </button>
            </div>

            <dl className="mt-4 grid grid-cols-3 gap-y-2 text-sm">
              <dt className="text-charcoal/45">When</dt>
              <dd className="text-espresso col-span-2 font-medium">{formatDateTime(detail.createdAt)}</dd>
              <dt className="text-charcoal/45">User</dt>
              <dd className="text-espresso col-span-2 font-medium">
                {detail.actor} <span className="text-charcoal/45">({detail.actorRole})</span>
              </dd>
              <dt className="text-charcoal/45">From</dt>
              <dd className="text-espresso col-span-2 font-medium">{detail.source}</dd>
              {detail.entityName && (
                <>
                  <dt className="text-charcoal/45">Item</dt>
                  <dd className="text-espresso col-span-2 font-medium">
                    {detail.entityName}
                    {detail.entity ? ` (${detail.entity})` : ""}
                  </dd>
                </>
              )}
              {detail.orderNumber && (
                <>
                  <dt className="text-charcoal/45">Order</dt>
                  <dd className="text-espresso col-span-2 font-medium">{detail.orderNumber}</dd>
                </>
              )}
            </dl>

            {(detail.oldValue || detail.newValue) && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {detail.oldValue && (
                  <div>
                    <p className="text-charcoal/45 text-xs font-bold tracking-wide uppercase">Old value</p>
                    <pre className="bg-terracotta/5 text-terracotta-dark mt-1 overflow-x-auto rounded-lg p-3 text-xs">{prettyJson(detail.oldValue)}</pre>
                  </div>
                )}
                {detail.newValue && (
                  <div>
                    <p className="text-charcoal/45 text-xs font-bold tracking-wide uppercase">New value</p>
                    <pre className="bg-sage/10 text-sage-dark mt-1 overflow-x-auto rounded-lg p-3 text-xs">{prettyJson(detail.newValue)}</pre>
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
