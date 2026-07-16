import { useRef, useState } from "react";
import { api } from "../lib/api";
import { useToast } from "../context/ToastContext";

// Canonical keys per tab + the normalized header names that map onto them.
const norm = (x: unknown) =>
  String(x ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const HEADER_MAP: Record<string, Record<string, string>> = {
  stock: {
    itemname: "itemName",
    category: "category",
    unit: "unit",
    currentqty: "currentQty",
    minqty: "minQty",
    costunit: "costPerUnit",
    costperunit: "costPerUnit",
    supplier: "supplier",
    expirydate: "expiryDate",
    trackexpiry: "trackExpiry",
    batchlotnumber: "batchLot",
    batchlot: "batchLot",
    storagelocation: "storageLocation",
    notes: "notes",
  },
  recipes: {
    menuitem: "menuItem",
    menucategory: "menuCategory",
    size: "size",
    addon: "addon",
    inventoryitemused: "inventoryItemUsed",
    qtyused: "qtyUsed",
    unit: "unit",
    deductionrule: "deductionRule",
    replacesinventoryitem: "replacesInventoryItem",
    notes: "notes",
  },
  products: {
    productname: "productName",
    type: "type",
    currentqty: "currentQty",
    minqty: "minQty",
    cost: "cost",
    supplier: "supplier",
    expirydate: "expiryDate",
    notes: "notes",
  },
  hanson: {
    date: "date",
    doughnut: "doughnut",
    category: "category",
    qtyproduced: "qtyProduced",
    costpiece: "costPiece",
    costpieceoptional: "costPiece",
    availabletoday: "availableToday",
    notes: "notes",
  },
};
const tabFromSheet = (name: string): keyof typeof HEADER_MAP | null => {
  const n = norm(name);
  if (n.includes("instruction")) return null;
  if (n.includes("recipe")) return "recipes";
  if (n.includes("hanson")) return "hanson";
  if (n.includes("product")) return "products";
  if (n.includes("stock")) return "stock";
  return null;
};

type Row = Record<string, string> & { _row: number; _status: "ok" | "warn" | "error"; _messages: string[] };
type Issue = { tab: string; row: number; message: string };
type ValResult = {
  summary: { stock: number; recipes: number; products: number; hanson: number; errors: number; warnings: number; willImport: number };
  tabs: { stock: Row[]; recipes: Row[]; products: Row[]; hanson: Row[] };
  errors: Issue[];
  warnings: Issue[];
};
type Payload = Record<string, Record<string, string>[]>;

const TABS: { key: keyof ValResult["tabs"]; title: string; label: (r: Row) => string }[] = [
  { key: "stock", title: "A · Current Stock", label: (r) => `${r.itemName || "?"} — ${r.currentQty || 0} ${r.unit || ""}` },
  {
    key: "recipes",
    title: "B · Recipes",
    label: (r) =>
      `${r.menuItem || "?"}${r.size ? ` (${r.size})` : ""}${r.addon ? ` +${r.addon}` : ""} → ${r.inventoryItemUsed || "?"} ${r.qtyUsed || ""}${r.unit || ""}${norm(r.deductionRule) === "replace" ? ` [replaces ${r.replacesInventoryItem}]` : ""}`,
  },
  { key: "products", title: "C · Products", label: (r) => `${r.productName || "?"} (${r.type || "?"}) — ${r.currentQty || 0}` },
  {
    key: "hanson",
    title: "D · Hanson Daily",
    label: (r) => `${r.date || "?"} · ${r.doughnut || "?"} ×${r.qtyProduced || 0}${norm(r.availableToday) === "no" ? " (hidden)" : ""}`,
  },
];

const DOT: Record<string, string> = { ok: "bg-sage", warn: "bg-amber-400", error: "bg-terracotta" };

export function AdminImportData() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState("");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [val, setVal] = useState<ValResult | null>(null);
  const [done, setDone] = useState<{ results: Record<string, number>; errors: Issue[]; warnings: Issue[] } | null>(null);
  const [err, setErr] = useState("");

  async function onFile(file: File) {
    setErr("");
    setVal(null);
    setDone(null);
    setPayload(null);
    setFileName(file.name);
    setBusy("Reading workbook…");
    try {
      const XLSX = await import("xlsx"); // code-split: only loaded on this page
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const out: Payload = { stock: [], recipes: [], products: [], hanson: [] };
      for (const sheetName of wb.SheetNames) {
        const tab = tabFromSheet(sheetName);
        if (!tab) continue;
        const map = HEADER_MAP[tab];
        const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[sheetName], { header: 1, raw: false, defval: "" });
        if (!rows.length) continue;
        const headers = (rows[0] as unknown[]).map((h) => map[norm(h)]);
        for (let i = 1; i < rows.length; i++) {
          const arr = rows[i] as unknown[];
          if (!arr || arr.every((c) => String(c ?? "").trim() === "")) continue;
          const obj: Record<string, string> = {};
          headers.forEach((key, idx) => {
            if (key) obj[key] = String(arr[idx] ?? "").trim();
          });
          out[tab].push(obj);
        }
      }
      const total = out.stock.length + out.recipes.length + out.products.length + out.hanson.length;
      if (!total) {
        setErr("No recognizable data found. Make sure the tabs are named like the template (Current Stock, Recipes, Products, Hanson Daily).");
        setBusy("");
        return;
      }
      setPayload(out);
      setBusy("Validating against the system…");
      const result = await api.post<ValResult>("/api/import/validate", out);
      setVal(result);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't read that file.");
    } finally {
      setBusy("");
    }
  }

  async function commit() {
    if (!payload) return;
    setBusy("Importing…");
    setErr("");
    try {
      const res = await api.post<{ results: Record<string, number>; errors: Issue[]; warnings: Issue[] }>("/api/import/commit", payload);
      setDone(res);
      toast("Import complete ✓");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy("");
    }
  }

  function reset() {
    setPayload(null);
    setVal(null);
    setDone(null);
    setErr("");
    setFileName("");
    if (fileRef.current) fileRef.current.value = "";
  }

  const tile = "rounded-2xl bg-white p-4 text-center shadow-sm";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-espresso text-3xl font-bold">Import from Excel</h1>
        <p className="text-charcoal/60 mt-1 text-sm">Upload the Bean Avenue inventory workbook. Nothing is saved until you review and confirm.</p>
      </div>

      {/* Upload */}
      <div className="border-oat rounded-2xl border-2 border-dashed bg-white p-6 text-center">
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={!!busy}
          className="bg-espresso text-cream hover:bg-mocha rounded-full px-6 py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          {fileName ? "Choose a different file" : "Choose Excel file"}
        </button>
        {fileName && <p className="text-charcoal/60 mt-2 text-sm">{fileName}</p>}
        {busy && <p className="text-terracotta mt-2 text-sm font-medium">{busy}</p>}
      </div>

      {err && <p className="bg-terracotta/10 text-terracotta-dark rounded-xl px-4 py-3 text-sm font-medium">{err}</p>}

      {/* Results after commit */}
      {done && (
        <div className="space-y-4">
          <div className="bg-sage/10 rounded-2xl p-5">
            <h2 className="font-display text-sage-dark text-xl font-bold">Import complete ✓</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className={tile}>
                <p className="text-charcoal/55 text-xs">Inventory</p>
                <p className="font-display text-espresso text-2xl font-bold">{done.results.stock}</p>
              </div>
              <div className={tile}>
                <p className="text-charcoal/55 text-xs">Recipes</p>
                <p className="font-display text-espresso text-2xl font-bold">{done.results.recipes}</p>
              </div>
              <div className={tile}>
                <p className="text-charcoal/55 text-xs">Products</p>
                <p className="font-display text-espresso text-2xl font-bold">{done.results.products}</p>
              </div>
              <div className={tile}>
                <p className="text-charcoal/55 text-xs">Hanson</p>
                <p className="font-display text-espresso text-2xl font-bold">{done.results.hanson}</p>
              </div>
              <div className={tile}>
                <p className="text-charcoal/55 text-xs">Skipped</p>
                <p className="font-display text-terracotta-dark text-2xl font-bold">{done.results.skipped}</p>
              </div>
            </div>
          </div>
          <button onClick={reset} className="border-oat text-espresso hover:bg-oat rounded-full border px-5 py-2 text-sm font-semibold">
            Import another file
          </button>
        </div>
      )}

      {/* Review */}
      {val && !done && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            <div className={tile}>
              <p className="text-charcoal/55 text-xs">Inventory</p>
              <p className="font-display text-espresso text-2xl font-bold">{val.summary.stock}</p>
            </div>
            <div className={tile}>
              <p className="text-charcoal/55 text-xs">Recipes</p>
              <p className="font-display text-espresso text-2xl font-bold">{val.summary.recipes}</p>
            </div>
            <div className={tile}>
              <p className="text-charcoal/55 text-xs">Products</p>
              <p className="font-display text-espresso text-2xl font-bold">{val.summary.products}</p>
            </div>
            <div className={tile}>
              <p className="text-charcoal/55 text-xs">Hanson</p>
              <p className="font-display text-espresso text-2xl font-bold">{val.summary.hanson}</p>
            </div>
            <div className={tile}>
              <p className="text-charcoal/55 text-xs">Errors</p>
              <p className={`font-display text-2xl font-bold ${val.summary.errors ? "text-terracotta-dark" : "text-sage-dark"}`}>{val.summary.errors}</p>
            </div>
            <div className={tile}>
              <p className="text-charcoal/55 text-xs">Warnings</p>
              <p className={`font-display text-2xl font-bold ${val.summary.warnings ? "text-amber-700" : "text-sage-dark"}`}>{val.summary.warnings}</p>
            </div>
          </div>

          {val.summary.errors > 0 && (
            <div className="bg-terracotta/8 rounded-2xl p-4">
              <p className="text-terracotta-dark font-semibold">
                {val.summary.errors} error{val.summary.errors === 1 ? "" : "s"} — these rows will be skipped:
              </p>
              <ul className="text-terracotta-dark/90 mt-2 max-h-48 space-y-1 overflow-y-auto text-sm">
                {val.errors.map((e, i) => (
                  <li key={i}>
                    • <b>{e.tab}</b> row {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {val.summary.warnings > 0 && (
            <div className="rounded-2xl bg-amber-400/10 p-4">
              <p className="font-semibold text-amber-800">
                {val.summary.warnings} warning{val.summary.warnings === 1 ? "" : "s"}:
              </p>
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm text-amber-800/90">
                {val.warnings.map((w, i) => (
                  <li key={i}>
                    • <b>{w.tab}</b> row {w.row}: {w.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Per-tab preview */}
          {TABS.map(
            ({ key, title, label }) =>
              val.tabs[key].length > 0 && (
                <div key={key} className="overflow-hidden rounded-2xl bg-white shadow-sm">
                  <div className="border-oat text-espresso border-b px-4 py-2 text-sm font-bold">
                    {title} <span className="text-charcoal/40">({val.tabs[key].length})</span>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {val.tabs[key].map((r) => (
                      <div key={r._row} className="border-oat/50 flex items-start gap-3 border-b px-4 py-2 text-sm last:border-0">
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[r._status]}`} />
                        <div className="min-w-0">
                          <p className="text-espresso truncate">{label(r)}</p>
                          {r._messages.length > 0 && (
                            <p className={`text-xs ${r._status === "error" ? "text-terracotta-dark" : "text-amber-700"}`}>{r._messages.join(" · ")}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ),
          )}

          <div className="sticky bottom-0 flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-[0_-4px_16px_-8px_rgba(0,0,0,0.15)]">
            <p className="text-charcoal/70 text-sm">
              <b className="text-espresso">{val.summary.willImport}</b> row{val.summary.willImport === 1 ? "" : "s"} will be imported
              {val.summary.errors ? `, ${val.summary.errors} skipped` : ""}.
            </p>
            <div className="flex gap-2">
              <button onClick={reset} className="border-oat text-charcoal/60 hover:bg-oat rounded-full border px-5 py-2 text-sm font-semibold">
                Cancel
              </button>
              <button
                onClick={commit}
                disabled={!!busy || val.summary.willImport === 0}
                className="bg-terracotta text-cream hover:bg-terracotta-dark rounded-full px-6 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {busy ? busy : `Confirm import (${val.summary.willImport})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
