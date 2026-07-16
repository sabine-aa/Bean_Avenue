import { useEffect, useMemo, useState } from "react";
import { ImageField } from "../components/ImageField";
import { useToast } from "../context/ToastContext";
import { api, money } from "../lib/api";

type Supplier = { id: number; name: string; phone: string | null };
type StockItem = { id: number; name: string; unit: string; category: string; costPerUnit: number };
type RestockRow = {
  id: number;
  number: string;
  supplierName: string;
  invoiceNo: string | null;
  deliveryDate: string;
  receivedBy: string | null;
  notes: string | null;
  itemCount: number;
  totalCost: number;
  voidedAt: string | null;
  voidReason: string | null;
};
type RestockLine = {
  id: number;
  inventoryItemId: number;
  itemName: string;
  quantity: number;
  unit: string;
  costPerUnit: number;
  totalCost: number;
  expiryDate: string | null;
  batchNo: string | null;
  notes: string | null;
};
type RestockDetail = RestockRow & {
  supplierId: number | null;
  supplierPhone: string | null;
  invoicePhoto: string | null;
  createdBy: string | null;
  voidedBy: string | null;
  lines: RestockLine[];
};

type Line = {
  key: number;
  mode: "existing" | "new";
  inventoryItemId: string; // "" or item id
  unit: string;
  quantity: string;
  costPerUnit: string;
  expiryDate: string;
  batchNo: string;
  notes: string;
  newItem: { name: string; category: string; unit: string; minQty: string };
};

let LINE_KEY = 1;
const blankLine = (): Line => ({
  key: LINE_KEY++,
  mode: "existing",
  inventoryItemId: "",
  unit: "",
  quantity: "",
  costPerUnit: "",
  expiryDate: "",
  batchNo: "",
  notes: "",
  newItem: { name: "", category: "", unit: "pcs", minQty: "" },
});

export function AdminRestock() {
  const toast = useToast();
  const [tab, setTab] = useState<"new" | "history">("new");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [history, setHistory] = useState<RestockRow[]>([]);
  const [detail, setDetail] = useState<RestockDetail | null>(null);
  const [saving, setSaving] = useState(false);

  // Header
  const [supplierId, setSupplierId] = useState<string>("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoicePhoto, setInvoicePhoto] = useState("");
  const [deliveryDate, setDeliveryDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [receivedBy, setReceivedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([blankLine()]);

  const loadRefs = () => {
    api
      .get<Supplier[]>("/api/suppliers")
      .then(setSuppliers)
      .catch(() => {});
    api
      .get<{ items: StockItem[] }>("/api/stock")
      .then((r) => setStockItems(r.items))
      .catch(() => {});
  };
  const loadHistory = () =>
    api
      .get<RestockRow[]>("/api/stock/restocks")
      .then(setHistory)
      .catch(() => {});
  useEffect(() => {
    loadRefs();
    loadHistory();
  }, []);

  function chooseSupplier(val: string) {
    setSupplierId(val);
    if (val && val !== "manual") {
      const s = suppliers.find((x) => String(x.id) === val);
      if (s) {
        setSupplierName(s.name);
        setSupplierPhone(s.phone ?? "");
      }
    } else if (val === "manual") {
      setSupplierName("");
      setSupplierPhone("");
    }
  }

  function updateLine(key: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function pickItem(key: number, val: string) {
    if (val === "new") {
      updateLine(key, { mode: "new", inventoryItemId: "" });
      return;
    }
    const item = stockItems.find((i) => String(i.id) === val);
    updateLine(key, {
      mode: "existing",
      inventoryItemId: val,
      unit: item?.unit ?? "",
      costPerUnit: item && item.costPerUnit > 0 ? String(item.costPerUnit) : "",
    });
  }
  const addLine = () => setLines((ls) => [...ls, blankLine()]);
  const removeLine = (key: number) => setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== key) : ls));

  const lineTotal = (l: Line) => (Number(l.quantity) || 0) * (Number(l.costPerUnit) || 0);
  const totals = useMemo(() => {
    const valid = lines.filter((l) => Number(l.quantity) > 0);
    return { count: valid.length, cost: Math.round(valid.reduce((s, l) => s + lineTotal(l), 0) * 100) / 100 };
  }, [lines]);

  function resetForm() {
    setSupplierId("");
    setSupplierName("");
    setSupplierPhone("");
    setInvoiceNo("");
    setInvoicePhoto("");
    setDeliveryDate(new Date().toISOString().slice(0, 10));
    setReceivedBy("");
    setNotes("");
    setLines([blankLine()]);
  }

  async function save() {
    if (saving) return;
    if (!supplierName.trim()) return toast("Choose or enter a supplier.", "error");
    const validLines = lines.filter((l) => Number(l.quantity) > 0);
    if (!validLines.length) return toast("Add at least one item with a quantity.", "error");
    if (validLines.some((l) => l.mode === "new" && !l.newItem.name.trim())) return toast("New items need a name.", "error");
    if (validLines.some((l) => l.mode === "existing" && !l.inventoryItemId)) return toast("Pick an item for every line (or add a new one).", "error");
    const payloadLines = validLines.map((l) =>
      l.mode === "new"
        ? {
            newItem: { name: l.newItem.name, category: l.newItem.category, unit: l.newItem.unit, minQty: Number(l.newItem.minQty) || 0 },
            unit: l.newItem.unit,
            quantity: Number(l.quantity),
            costPerUnit: Number(l.costPerUnit) || 0,
            expiryDate: l.expiryDate || undefined,
            batchNo: l.batchNo || undefined,
            notes: l.notes || undefined,
          }
        : {
            inventoryItemId: Number(l.inventoryItemId),
            quantity: Number(l.quantity),
            costPerUnit: Number(l.costPerUnit) || 0,
            expiryDate: l.expiryDate || undefined,
            batchNo: l.batchNo || undefined,
            notes: l.notes || undefined,
          },
    );

    setSaving(true);
    try {
      const r = await api.post<RestockRow>("/api/stock/restock", {
        supplierId: supplierId && supplierId !== "manual" ? Number(supplierId) : undefined,
        supplierName: supplierName.trim(),
        supplierPhone: supplierPhone.trim() || undefined,
        invoiceNo: invoiceNo.trim() || undefined,
        invoicePhoto: invoicePhoto || undefined,
        deliveryDate,
        receivedBy: receivedBy.trim() || undefined,
        notes: notes.trim() || undefined,
        lines: payloadLines,
      });
      toast(`Restock ${r.number} saved · inventory updated.`);
      resetForm();
      loadRefs();
      loadHistory();
      setTab("history");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save the restock.", "error");
    } finally {
      setSaving(false);
    }
  }

  function openDetail(id: number) {
    api
      .get<RestockDetail>(`/api/stock/restocks/${id}`)
      .then(setDetail)
      .catch(() => {});
  }

  function prefillFrom(d: RestockDetail) {
    const known = d.supplierId && suppliers.some((s) => s.id === d.supplierId);
    setSupplierId(known ? String(d.supplierId) : "manual");
    setSupplierName(d.supplierName);
    setSupplierPhone(d.supplierPhone ?? "");
    setInvoiceNo(d.invoiceNo ?? "");
    setInvoicePhoto(d.invoicePhoto ?? "");
    setDeliveryDate(d.deliveryDate ? new Date(d.deliveryDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
    setReceivedBy(d.receivedBy ?? "");
    setNotes(d.notes ?? "");
    setLines(
      d.lines.map((li) => ({
        key: LINE_KEY++,
        mode: "existing" as const,
        inventoryItemId: String(li.inventoryItemId),
        unit: li.unit,
        quantity: String(li.quantity),
        costPerUnit: String(li.costPerUnit),
        expiryDate: li.expiryDate ? new Date(li.expiryDate).toISOString().slice(0, 10) : "",
        batchNo: li.batchNo ?? "",
        notes: li.notes ?? "",
        newItem: { name: "", category: "", unit: "pcs", minQty: "" },
      })),
    );
  }

  async function voidRestock(d: RestockDetail, reEnter: boolean) {
    const reason = window.prompt(
      reEnter
        ? `Correcting ${d.number} — this voids the original (reversing its stock), then re-opens it for editing. Reason:`
        : `Void ${d.number}? This reverses the stock it added. Reason:`,
      reEnter ? "Correction" : "",
    );
    if (reason === null) return;
    try {
      await api.post(`/api/stock/restocks/${d.id}/void`, { reason });
      toast(`${d.number} voided · stock reversed.`);
      loadRefs();
      loadHistory();
      if (reEnter) {
        prefillFrom(d);
        setTab("new");
      }
      setDetail(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't void the restock.", "error");
    }
  }

  const field = "w-full rounded-xl border border-oat px-3 py-2 text-sm font-normal";
  const label = "block text-xs font-semibold text-espresso";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-espresso text-3xl font-bold">Restock / Receive Stock</h1>
          <p className="text-charcoal/60 mt-1 text-sm">Record a supplier delivery — inventory updates automatically.</p>
        </div>
        <div className="bg-oat flex gap-1 rounded-full p-1">
          <button
            onClick={() => setTab("new")}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === "new" ? "bg-espresso text-cream" : "text-espresso"}`}
          >
            New Restock
          </button>
          <button
            onClick={() => setTab("history")}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === "history" ? "bg-espresso text-cream" : "text-espresso"}`}
          >
            History
          </button>
        </div>
      </div>

      {tab === "new" && (
        <div className="mt-5 space-y-5">
          {/* Supplier & delivery details */}
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="font-display text-espresso text-lg font-bold">Supplier & delivery</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className={label}>Supplier *</label>
                <select value={supplierId} onChange={(e) => chooseSupplier(e.target.value)} className={`mt-1 ${field}`}>
                  <option value="">— Choose supplier —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                  <option value="manual">✏️ Type a supplier name…</option>
                </select>
              </div>
              {(supplierId === "manual" || (!supplierId && supplierName)) && (
                <div>
                  <label className={label}>Supplier name</label>
                  <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className={`mt-1 ${field}`} placeholder="e.g. ABC Dairy" />
                </div>
              )}
              <div>
                <label className={label}>Supplier phone</label>
                <input value={supplierPhone} onChange={(e) => setSupplierPhone(e.target.value)} className={`mt-1 ${field}`} placeholder="optional" />
              </div>
              <div>
                <label className={label}>Invoice number</label>
                <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} className={`mt-1 ${field}`} placeholder="optional" />
              </div>
              <div>
                <label className={label}>Delivery date</label>
                <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className={`mt-1 ${field}`} />
              </div>
              <div>
                <label className={label}>Received by</label>
                <input value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} className={`mt-1 ${field}`} placeholder="staff/manager name" />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className={label}>Notes</label>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} className={`mt-1 ${field}`} placeholder="optional" />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className={label}>Invoice photo</label>
                <ImageField value={invoicePhoto} onChange={setInvoicePhoto} placeholder="Upload the supplier invoice or paste a link" />
              </div>
            </div>
          </section>

          {/* Received items */}
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="font-display text-espresso text-lg font-bold">Received items</h2>
            <div className="mt-3 space-y-3">
              {lines.map((l) => (
                <div key={l.key} className="border-oat rounded-xl border p-3">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="lg:col-span-2">
                      <label className={label}>Item</label>
                      <select
                        value={l.mode === "new" ? "new" : l.inventoryItemId}
                        onChange={(e) => pickItem(l.key, e.target.value)}
                        className={`mt-1 ${field}`}
                      >
                        <option value="">— Choose item —</option>
                        {stockItems.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name} ({i.unit})
                          </option>
                        ))}
                        <option value="new">➕ New item…</option>
                      </select>
                    </div>
                    <div>
                      <label className={label}>Quantity</label>
                      <input
                        value={l.quantity}
                        onChange={(e) => updateLine(l.key, { quantity: e.target.value.replace(/[^0-9.]/g, "") })}
                        inputMode="decimal"
                        className={`mt-1 ${field}`}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className={label}>Cost / unit ($)</label>
                      <input
                        value={l.costPerUnit}
                        onChange={(e) => updateLine(l.key, { costPerUnit: e.target.value.replace(/[^0-9.]/g, "") })}
                        inputMode="decimal"
                        className={`mt-1 ${field}`}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {l.mode === "new" && (
                    <div className="bg-oat/40 mt-2 grid gap-2 rounded-lg p-2 sm:grid-cols-2 lg:grid-cols-4">
                      <input
                        value={l.newItem.name}
                        onChange={(e) => updateLine(l.key, { newItem: { ...l.newItem, name: e.target.value } })}
                        placeholder="New item name *"
                        className={field}
                      />
                      <input
                        value={l.newItem.category}
                        onChange={(e) => updateLine(l.key, { newItem: { ...l.newItem, category: e.target.value } })}
                        placeholder="Category (Dairy, Coffee…)"
                        className={field}
                      />
                      <input
                        value={l.newItem.unit}
                        onChange={(e) => updateLine(l.key, { newItem: { ...l.newItem, unit: e.target.value } })}
                        placeholder="Unit (L, kg, pcs)"
                        className={field}
                      />
                      <input
                        value={l.newItem.minQty}
                        onChange={(e) => updateLine(l.key, { newItem: { ...l.newItem, minQty: e.target.value.replace(/[^0-9.]/g, "") } })}
                        inputMode="decimal"
                        placeholder="Min stock level"
                        className={field}
                      />
                    </div>
                  )}

                  <div className="mt-2 grid items-end gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label className={label}>Expiry (optional)</label>
                      <input type="date" value={l.expiryDate} onChange={(e) => updateLine(l.key, { expiryDate: e.target.value })} className={`mt-1 ${field}`} />
                    </div>
                    <div>
                      <label className={label}>Batch # (optional)</label>
                      <input value={l.batchNo} onChange={(e) => updateLine(l.key, { batchNo: e.target.value })} className={`mt-1 ${field}`} />
                    </div>
                    <div>
                      <label className={label}>Line notes</label>
                      <input value={l.notes} onChange={(e) => updateLine(l.key, { notes: e.target.value })} className={`mt-1 ${field}`} />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm">
                        <span className="text-charcoal/50">Line total </span>
                        <span className="text-espresso font-bold">{money(lineTotal(l))}</span>
                      </span>
                      <button onClick={() => removeLine(l.key)} className="text-charcoal/40 hover:text-terracotta rounded-full px-2 py-1 text-xs font-semibold">
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={addLine}
              className="border-oat text-charcoal/70 hover:border-espresso mt-3 rounded-full border border-dashed px-4 py-2 text-sm font-semibold"
            >
              + Add another item
            </button>
          </section>

          {/* Totals & save */}
          <section className="bg-espresso text-cream sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4 shadow-lg">
            <div className="text-sm">
              <span className="font-semibold">{totals.count}</span> item{totals.count === 1 ? "" : "s"} ·<span className="ml-1">Total invoice cost </span>
              <span className="text-lg font-bold">{money(totals.cost)}</span>
            </div>
            <button onClick={save} disabled={saving} className="btn-3d bg-terracotta text-cream rounded-full px-6 py-2.5 font-semibold disabled:opacity-60">
              {saving ? "Saving…" : "Save restock & update inventory"}
            </button>
          </section>
        </div>
      )}

      {tab === "history" && (
        <div className="mt-5 space-y-2">
          {history.map((r) => (
            <button
              key={r.id}
              onClick={() => openDetail(r.id)}
              className="hover:ring-oat flex w-full flex-wrap items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm hover:ring-2"
            >
              <div className="flex-1">
                <p className="text-espresso font-semibold">
                  {r.number} · {r.supplierName}
                  {r.voidedAt && <span className="bg-terracotta/15 text-terracotta-dark ml-2 rounded-full px-2 py-0.5 text-xs font-semibold">VOIDED</span>}
                </p>
                <p className="text-charcoal/55 text-xs">
                  {new Date(r.deliveryDate).toLocaleDateString()}
                  {r.invoiceNo ? ` · Inv #${r.invoiceNo}` : ""}
                  {r.receivedBy ? ` · by ${r.receivedBy}` : ""} · {r.itemCount} item{r.itemCount === 1 ? "" : "s"}
                </p>
              </div>
              <span className={`font-bold ${r.voidedAt ? "text-charcoal/40 line-through" : "text-terracotta"}`}>{money(r.totalCost)}</span>
              <span className="text-charcoal/40 text-xs font-semibold">View →</span>
            </button>
          ))}
          {history.length === 0 && <p className="text-charcoal/50 rounded-2xl bg-white p-6 text-center shadow-sm">No restocks recorded yet.</p>}
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDetail(null)}>
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display text-espresso text-xl font-bold">{detail.number}</h3>
                <p className="text-charcoal/60 text-sm">
                  {detail.supplierName}
                  {detail.supplierPhone ? ` · ${detail.supplierPhone}` : ""}
                </p>
                <p className="text-charcoal/50 text-xs">
                  {new Date(detail.deliveryDate).toLocaleString()}
                  {detail.invoiceNo ? ` · Invoice #${detail.invoiceNo}` : ""}
                  {detail.receivedBy ? ` · received by ${detail.receivedBy}` : ""}
                </p>
              </div>
              <button onClick={() => setDetail(null)} className="text-charcoal/40 hover:text-charcoal">
                ✕
              </button>
            </div>
            {detail.notes && <p className="bg-oat/40 text-charcoal/70 mt-2 rounded-lg px-3 py-2 text-sm">{detail.notes}</p>}
            <div className="mt-3 space-y-1.5">
              {detail.lines.map((li) => (
                <div key={li.id} className="border-oat/60 flex items-center justify-between border-b py-1.5 text-sm">
                  <div>
                    <span className="text-espresso font-semibold">
                      {li.quantity} {li.unit} · {li.itemName}
                    </span>
                    <span className="text-charcoal/45 block text-xs">
                      {money(li.costPerUnit)}/{li.unit}
                      {li.expiryDate ? ` · exp ${new Date(li.expiryDate).toLocaleDateString()}` : ""}
                      {li.batchNo ? ` · batch ${li.batchNo}` : ""}
                    </span>
                  </div>
                  <span className="text-charcoal/70 font-semibold">{money(li.totalCost)}</span>
                </div>
              ))}
            </div>
            <div className="text-espresso mt-3 flex items-center justify-between text-base font-bold">
              <span>Total</span>
              <span className="text-terracotta">{money(detail.totalCost)}</span>
            </div>
            {detail.invoicePhoto && (
              <a href={detail.invoicePhoto} target="_blank" rel="noreferrer" className="text-terracotta mt-3 block text-sm font-semibold hover:underline">
                🧾 View invoice photo
              </a>
            )}

            {detail.voidedAt ? (
              <div className="bg-terracotta/10 text-terracotta-dark mt-4 rounded-xl px-3 py-2 text-sm">
                🚫 <span className="font-semibold">Voided</span> {detail.voidedBy ? `by ${detail.voidedBy}` : ""} on{" "}
                {new Date(detail.voidedAt).toLocaleString()}. Stock was reversed.
                {detail.voidReason && <span className="block text-xs">Reason: {detail.voidReason}</span>}
              </div>
            ) : (
              <div className="border-oat mt-4 flex flex-wrap gap-2 border-t pt-3">
                <button
                  onClick={() => voidRestock(detail, true)}
                  className="bg-espresso text-cream hover:bg-mocha rounded-full px-4 py-2 text-sm font-semibold"
                >
                  ✏️ Correct (void &amp; re-enter)
                </button>
                <button
                  onClick={() => voidRestock(detail, false)}
                  className="border-terracotta text-terracotta-dark hover:bg-terracotta/10 rounded-full border px-4 py-2 text-sm font-semibold"
                >
                  🗑 Void (reverse stock)
                </button>
              </div>
            )}
            <p className="text-charcoal/45 mt-2 text-xs">
              Voiding reverses this delivery's stock and is fully logged in the inventory movements — nothing changes silently.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
