import { useEffect, useMemo, useState } from "react";
import { useToast } from "../context/ToastContext";
import { api, formatDateTime, money } from "../lib/api";

type Item = {
  id: number;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  minQty: number;
  costPerUnit: number;
  supplier: string | null;
  expiryDate: string | null;
};
type Summary = { items: number; low: number; out: number; value: number };
type Movement = {
  id: number;
  name: string;
  unit: string;
  delta: number;
  balance: number;
  type: string;
  reason: string | null;
  staffName: string | null;
  invoiceNo: string | null;
  createdAt: string;
};

const TYPE_LABEL: Record<string, string> = {
  SALE: "Sale",
  RECEIVE: "Received",
  WASTE: "Wastage",
  EXPIRED: "Expired",
  DAMAGED: "Damaged",
  COUNT: "Recount",
  ADJUST: "Adjust",
  REFUND_REVERSAL: "Refund reversal",
};
const ADJUST_TYPES = ["RECEIVE", "WASTE", "EXPIRED", "DAMAGED", "COUNT", "ADJUST"];
const emptyItem = () => ({ name: "", category: "", unit: "pcs", quantity: 0, minQty: 0, costPerUnit: 0, supplier: "", expiryDate: "" });

export function AdminStock() {
  const toast = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [moves, setMoves] = useState<Movement[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [editItem, setEditItem] = useState<(Partial<Item> & { id?: number }) | null>(null);
  const [adjust, setAdjust] = useState<{ item: Item; type: string } | null>(null);

  async function load() {
    const [inv, mv] = await Promise.all([
      api.get<{ items: Item[]; summary: Summary; categories: string[] }>("/api/stock"),
      api.get<Movement[]>("/api/stock/movements?limit=50"),
    ]);
    setItems(inv.items);
    setSummary(inv.summary);
    setCategories(inv.categories);
    setMoves(mv);
  }
  useEffect(() => {
    load().catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter(
      (i) => (cat === "All" || i.category === cat) && (s === "" || i.name.toLowerCase().includes(s) || (i.supplier ?? "").toLowerCase().includes(s)),
    );
  }, [items, q, cat]);

  async function saveItem() {
    if (!editItem) return;
    if (!editItem.name?.trim()) return toast("Item name is required.", "error");
    try {
      if (editItem.id) await api.patch(`/api/stock/${editItem.id}`, editItem);
      else await api.post("/api/stock", editItem);
      setEditItem(null);
      await load();
      toast("Saved.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save.", "error");
    }
  }

  async function deleteItem(i: Item) {
    if (!confirm(`Remove "${i.name}" from stock? Its history is kept.`)) return;
    await api.delete(`/api/stock/${i.id}`);
    load();
  }

  const state = (i: Item) => (i.quantity <= 0 ? "out" : i.quantity <= i.minQty ? "low" : "ok");
  const badge = (i: Item) => {
    const st = state(i);
    const cls = st === "out" ? "bg-terracotta/15 text-terracotta-dark" : st === "low" ? "bg-amber-400/25 text-amber-800" : "bg-sage/20 text-sage-dark";
    return (
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${cls}`}>
        {i.quantity} {i.unit}
        {st === "out" ? " · out" : st === "low" ? " · low" : ""}
      </span>
    );
  };
  const inp = "mt-1 w-full rounded-xl border border-oat bg-white px-3 py-2 text-sm";
  const btn = "rounded-full border border-oat px-3 py-1.5 text-xs font-semibold text-espresso hover:bg-oat";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-espresso text-3xl font-bold">Stock / Inventory</h1>
        {summary && (
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">
              Items <b>{summary.items}</b>
            </span>
            <span className="rounded-full bg-amber-400/20 px-3 py-1.5">
              Low <b>{summary.low}</b>
            </span>
            <span className="bg-terracotta/15 rounded-full px-3 py-1.5">
              Out <b>{summary.out}</b>
            </span>
            <span className="bg-sage/15 rounded-full px-3 py-1.5">
              Stock value <b>{money(summary.value)}</b>
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search items or suppliers…"
          className="border-oat w-full max-w-xs rounded-xl border bg-white px-4 py-2.5 text-sm"
        />
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="border-oat rounded-xl border bg-white px-3 py-2.5 text-sm">
          <option>All</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button onClick={() => setEditItem(emptyItem())} className="btn-3d bg-terracotta text-cream ml-auto rounded-full px-5 py-2 text-sm font-semibold">
          + Add stock item
        </button>
      </div>

      {/* Item list */}
      <section className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-charcoal/50 rounded-2xl bg-white p-6 text-center text-sm shadow-sm">
            No stock items yet. Add your first, or import your stock sheet.
          </p>
        )}
        {filtered.map((i) => (
          <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white px-4 py-3 shadow-sm">
            <div className="min-w-0">
              <p className="text-espresso flex items-center gap-2 font-semibold">
                {i.name} {badge(i)}
              </p>
              <p className="text-charcoal/50 text-xs">
                {i.category || "—"} · min {i.minQty} {i.unit} · {money(i.costPerUnit)}/{i.unit}
                {i.supplier ? ` · ${i.supplier}` : ""}
                {i.expiryDate ? ` · exp ${new Date(i.expiryDate).toLocaleDateString()}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setAdjust({ item: i, type: "RECEIVE" })} className={btn}>
                + Receive
              </button>
              <button onClick={() => setAdjust({ item: i, type: "WASTE" })} className={btn}>
                − Waste
              </button>
              <button onClick={() => setAdjust({ item: i, type: "COUNT" })} className={btn}>
                Recount
              </button>
              <button onClick={() => setEditItem({ ...i, expiryDate: i.expiryDate ? i.expiryDate.slice(0, 10) : "" })} className={btn}>
                Edit
              </button>
              <button onClick={() => deleteItem(i)} className={`${btn} text-terracotta-dark`}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </section>

      {/* Recent movements */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="font-display text-espresso text-xl font-bold">Recent stock movements</h2>
        <div className="mt-3 space-y-1.5">
          {moves.length === 0 && <p className="text-charcoal/50 text-sm">No movements yet.</p>}
          {moves.map((m) => (
            <div key={m.id} className="border-oat/60 flex items-center justify-between gap-2 border-b py-1.5 text-sm last:border-0">
              <span className="min-w-0 truncate">
                <span className={`font-semibold ${m.delta < 0 ? "text-terracotta-dark" : "text-sage-dark"}`}>
                  {m.delta > 0 ? `+${m.delta}` : m.delta} {m.unit}
                </span>{" "}
                <span className="text-espresso">{m.name}</span>{" "}
                <span className="text-charcoal/40">
                  · {TYPE_LABEL[m.type] ?? m.type}
                  {m.reason ? ` (${m.reason})` : ""}
                  {m.invoiceNo ? ` · inv ${m.invoiceNo}` : ""}
                </span>
              </span>
              <span className="text-charcoal/40 shrink-0 text-xs">
                → {m.balance} · {formatDateTime(m.createdAt)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {editItem && <ItemModal item={editItem} onChange={setEditItem} onClose={() => setEditItem(null)} onSave={saveItem} inp={inp} />}
      {adjust && (
        <AdjustModal
          ctx={adjust}
          onClose={() => setAdjust(null)}
          onDone={() => {
            setAdjust(null);
            load();
          }}
          inp={inp}
        />
      )}
    </div>
  );
}

function ItemModal({
  item,
  onChange,
  onClose,
  onSave,
  inp,
}: {
  item: Partial<Item> & { id?: number };
  onChange: (v: Partial<Item> & { id?: number }) => void;
  onClose: () => void;
  onSave: () => void;
  inp: string;
}) {
  const set = (k: string, v: unknown) => onChange({ ...item, [k]: v });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <p className="font-display text-espresso text-xl font-bold">{item.id ? "Edit stock item" : "Add stock item"}</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="text-espresso col-span-2 text-sm font-semibold">
            Name
            <input value={item.name ?? ""} onChange={(e) => set("name", e.target.value)} className={inp} />
          </label>
          <label className="text-espresso text-sm font-semibold">
            Category
            <input value={item.category ?? ""} onChange={(e) => set("category", e.target.value)} placeholder="Dairy, Packaging…" className={inp} />
          </label>
          <label className="text-espresso text-sm font-semibold">
            Unit
            <input value={item.unit ?? ""} onChange={(e) => set("unit", e.target.value)} placeholder="ml, g, pcs…" className={inp} />
          </label>
          {!item.id && (
            <label className="text-espresso text-sm font-semibold">
              Opening quantity
              <input type="number" value={item.quantity ?? 0} onChange={(e) => set("quantity", Number(e.target.value))} className={inp} />
            </label>
          )}
          <label className="text-espresso text-sm font-semibold">
            Min stock level
            <input type="number" value={item.minQty ?? 0} onChange={(e) => set("minQty", Number(e.target.value))} className={inp} />
          </label>
          <label className="text-espresso text-sm font-semibold">
            Cost per unit ($)
            <input type="number" step="0.001" value={item.costPerUnit ?? 0} onChange={(e) => set("costPerUnit", Number(e.target.value))} className={inp} />
          </label>
          <label className="text-espresso text-sm font-semibold">
            Supplier
            <input value={item.supplier ?? ""} onChange={(e) => set("supplier", e.target.value)} className={inp} />
          </label>
          <label className="text-espresso col-span-2 text-sm font-semibold">
            Expiry date (optional)
            <input type="date" value={(item.expiryDate as string) ?? ""} onChange={(e) => set("expiryDate", e.target.value)} className={inp} />
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="border-oat text-charcoal/60 flex-1 rounded-full border py-2.5 font-semibold">
            Cancel
          </button>
          <button onClick={onSave} className="btn-3d bg-espresso text-cream flex-1 rounded-full py-2.5 font-semibold">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function AdjustModal({ ctx, onClose, onDone, inp }: { ctx: { item: Item; type: string }; onClose: () => void; onDone: () => void; inp: string }) {
  const toast = useToast();
  const { item } = ctx;
  const [type, setType] = useState(ctx.type);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [cost, setCost] = useState(String(item.costPerUnit || ""));
  const [supplier, setSupplier] = useState(item.supplier ?? "");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || (type !== "ADJUST" && amt < 0)) return toast("Enter a valid amount.", "error");
    setBusy(true);
    try {
      await api.post(`/api/stock/${item.id}/adjust`, {
        type,
        amount: amt,
        reason: reason || undefined,
        ...(type === "RECEIVE"
          ? {
              costPerUnit: cost ? Number(cost) : undefined,
              supplier: supplier || undefined,
              invoiceNo: invoiceNo || undefined,
              expiryDate: expiryDate || undefined,
            }
          : {}),
      });
      toast("Stock updated.");
      onDone();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't update stock.", "error");
    } finally {
      setBusy(false);
    }
  }

  const label =
    type === "RECEIVE"
      ? `Add to stock (in ${item.unit})`
      : type === "COUNT"
        ? `New counted quantity (${item.unit})`
        : type === "ADJUST"
          ? `Signed change (${item.unit})`
          : `Quantity removed (${item.unit})`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <p className="font-display text-espresso text-xl font-bold">
          {item.name}{" "}
          <span className="text-charcoal/50 text-sm font-normal">
            · {item.quantity} {item.unit} on hand
          </span>
        </p>
        <label className="text-espresso mt-3 block text-sm font-semibold">
          Action
          <select value={type} onChange={(e) => setType(e.target.value)} className={inp}>
            {ADJUST_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-espresso mt-2 block text-sm font-semibold">
          {label}
          <input autoFocus type="number" step="0.001" value={amount} onChange={(e) => setAmount(e.target.value)} className={inp} />
        </label>
        {type === "RECEIVE" && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="text-espresso text-sm font-semibold">
              Cost / unit ($)
              <input type="number" step="0.001" value={cost} onChange={(e) => setCost(e.target.value)} className={inp} />
            </label>
            <label className="text-espresso text-sm font-semibold">
              Invoice #<input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} className={inp} />
            </label>
            <label className="text-espresso text-sm font-semibold">
              Supplier
              <input value={supplier} onChange={(e) => setSupplier(e.target.value)} className={inp} />
            </label>
            <label className="text-espresso text-sm font-semibold">
              Expiry
              <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className={inp} />
            </label>
          </div>
        )}
        {type !== "RECEIVE" && (
          <label className="text-espresso mt-2 block text-sm font-semibold">
            Reason (optional)
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Spilled, expired, miscount…" className={inp} />
          </label>
        )}
        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="border-oat text-charcoal/60 flex-1 rounded-full border py-2.5 font-semibold">
            Cancel
          </button>
          <button onClick={submit} disabled={busy} className="btn-3d bg-espresso text-cream flex-1 rounded-full py-2.5 font-semibold disabled:opacity-50">
            {busy ? "Saving…" : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}
