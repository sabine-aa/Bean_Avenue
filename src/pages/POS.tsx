import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Img } from "../components/Img";
import { api, isAdminTokenValid, money } from "../lib/api";
import type { AddonGroup, MenuItem, Order } from "../types";

// ---- Ticket model -------------------------------------------------------------
type Sel = { group: string; choice: string; priceDelta: number };
type TAddon = { addonId: number; name: string; price: number; quantity: number };
type Line = {
  id: number;
  item: MenuItem;
  quantity: number;
  options: Sel[];
  addons: TAddon[];
  note: string;
};

const unitPrice = (l: Line) =>
  Math.round((l.item.price + l.options.reduce((s, o) => s + o.priceDelta, 0) + l.addons.reduce((s, a) => s + a.price * a.quantity, 0)) * 100) / 100;
const lineTotal = (l: Line) => Math.round(unitPrice(l) * l.quantity * 100) / 100;
const sig = (item: MenuItem, options: Sel[], addons: TAddon[]) =>
  `${item.id}|${options.map((o) => o.group + ":" + o.choice).join(",")}|${addons.map((a) => a.addonId + "x" + a.quantity).join(",")}`;
// Default a line's options to the first choice of each group (e.g. smallest size).
const defaultOptions = (item: MenuItem): Sel[] =>
  item.options.map((g) => ({ group: g.name, choice: g.choices[0]?.label ?? "", priceDelta: g.choices[0]?.priceDelta ?? 0 }));

export function POS() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [cats, setCats] = useState<string[]>([]);
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [nextId, setNextId] = useState(1);
  const [editing, setEditing] = useState<Line | null>(null); // config modal
  const [pay, setPay] = useState<null | "CASH" | "CARD">(null);
  const [tendered, setTendered] = useState("");
  const [discount, setDiscount] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<Order | null>(null);
  const [todayTotal, setTodayTotal] = useState(0);

  useEffect(() => {
    api.get<MenuItem[]>("/api/menu").then((m) => setItems(m.filter((i) => i.inStock && !i.isHidden))).catch(() => {});
    api.get<string[]>("/api/categories").then(setCats).catch(() => {});
    refreshToday();
  }, []);
  const refreshToday = () => api.get<{ total: number }>("/api/pos/summary").then((s) => setTodayTotal(s.total)).catch(() => {});

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter(
      (i) => (cat === "All" || i.category === cat) && (s === "" || i.name.toLowerCase().includes(s) || i.category.toLowerCase().includes(s))
    );
  }, [items, cat, q]);

  const subtotal = Math.round(lines.reduce((s, l) => s + lineTotal(l), 0) * 100) / 100;
  const disc = Math.min(Math.max(0, Number(discount) || 0), subtotal);
  const total = Math.round((subtotal - disc) * 100) / 100;

  if (!isAdminTokenValid()) return <Navigate to="/admin/login" replace />;

  function addItem(item: MenuItem) {
    const options = defaultOptions(item);
    const key = sig(item, options, []);
    const existing = lines.find((l) => sig(l.item, l.options, l.addons) === key);
    if (existing) {
      setLines((ls) => ls.map((l) => (l.id === existing.id ? { ...l, quantity: l.quantity + 1 } : l)));
    } else {
      setLines((ls) => [...ls, { id: nextId, item, quantity: 1, options, addons: [], note: "" }]);
      setNextId((n) => n + 1);
    }
  }
  const setQty = (id: number, delta: number) =>
    setLines((ls) => ls.flatMap((l) => (l.id === id ? (l.quantity + delta <= 0 ? [] : [{ ...l, quantity: l.quantity + delta }]) : [l])));
  const removeLine = (id: number) => setLines((ls) => ls.filter((l) => l.id !== id));

  function newSale() {
    setLines([]);
    setDiscount("");
    setPhone("");
    setTendered("");
    setReceipt(null);
    setPay(null);
  }

  async function completeSale(method: "CASH" | "CARD") {
    if (!lines.length || busy) return;
    setBusy(true);
    try {
      const order = await api.post<Order>("/api/pos/sale", {
        paymentMethod: method,
        discount: disc,
        customerPhone: phone.trim() || undefined,
        items: lines.map((l) => ({
          menuItemId: l.item.id,
          quantity: l.quantity,
          selectedOptions: l.options.map((o) => ({ group: o.group, choice: o.choice })),
          addons: l.addons.map((a) => ({ addonId: a.addonId, quantity: a.quantity })),
          specialInstructions: l.note || undefined,
        })),
      });
      setReceipt(order);
      setPay(null);
      refreshToday();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Couldn't complete the sale.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-oat/30 text-espresso">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-oat bg-white px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Img src="/bean.png" alt="" className="h-7 w-7" />
          <span className="font-display text-lg font-bold">Bean Avenue POS</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-charcoal/60">Today: <b className="text-espresso">{money(todayTotal)}</b></span>
          <Link to="/admin" className="rounded-full bg-oat px-3 py-1.5 font-semibold hover:bg-espresso hover:text-cream">Admin</Link>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Menu side */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 p-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search items…"
              className="w-full rounded-full border border-oat bg-white px-4 py-2"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto px-3 pb-2">
            {["All", ...cats].map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold ${
                  cat === c ? "bg-espresso text-cream" : "bg-white text-espresso hover:bg-oat"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto p-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {visible.map((item) => (
              <button
                key={item.id}
                onClick={() => addItem(item)}
                className="card-lift flex flex-col overflow-hidden rounded-xl bg-white text-left shadow-sm active:scale-95"
              >
                <Img src={item.photo} alt={item.name} fit={item.imageFit === "contain" ? "contain" : "cover"} className="aspect-square w-full bg-oat/30" />
                <div className="p-2">
                  <p className="line-clamp-2 text-sm font-semibold leading-tight">{item.name}</p>
                  <p className="text-sm font-bold text-terracotta">
                    {item.options.length ? `From ${money(item.price)}` : money(item.price)}
                  </p>
                </div>
              </button>
            ))}
            {visible.length === 0 && <p className="col-span-full p-8 text-center text-charcoal/50">No items.</p>}
          </div>
        </div>

        {/* Ticket side */}
        <div className="flex w-80 shrink-0 flex-col border-l border-oat bg-white sm:w-96">
          <div className="flex items-center justify-between border-b border-oat px-4 py-2.5">
            <span className="font-display text-lg font-bold">Current sale</span>
            {lines.length > 0 && (
              <button onClick={newSale} className="text-sm font-semibold text-charcoal/50 hover:text-terracotta">Clear</button>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {lines.length === 0 ? (
              <p className="p-8 text-center text-charcoal/40">Tap items to start a sale.</p>
            ) : (
              lines.map((l) => (
                <div key={l.id} className="border-b border-oat/60 px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <button onClick={() => setEditing(l)} className="min-w-0 flex-1 text-left">
                      <p className="truncate font-semibold">{l.item.name}</p>
                      <p className="truncate text-xs text-charcoal/50">
                        {[...l.options.map((o) => o.choice), ...l.addons.map((a) => a.name)].join(" · ") || "tap to edit"}
                      </p>
                    </button>
                    <span className="whitespace-nowrap font-semibold text-terracotta">{money(lineTotal(l))}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <button onClick={() => setQty(l.id, -1)} className="h-7 w-7 rounded-full bg-oat text-lg font-bold leading-none">–</button>
                    <span className="w-6 text-center font-semibold">{l.quantity}</span>
                    <button onClick={() => setQty(l.id, 1)} className="h-7 w-7 rounded-full bg-oat text-lg font-bold leading-none">+</button>
                    <button onClick={() => removeLine(l.id)} className="ml-auto text-xs font-semibold text-charcoal/40 hover:text-terracotta">Remove</button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Totals + pay */}
          <div className="border-t border-oat p-3">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Customer phone (optional — earns beans)"
              className="mb-2 w-full rounded-xl border border-oat px-3 py-2 text-sm"
            />
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-charcoal/60">Subtotal</span>
              <span>{money(subtotal)}</span>
            </div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-charcoal/60">Discount ($)</span>
              <input
                value={discount}
                onChange={(e) => setDiscount(e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                placeholder="0"
                className="w-20 rounded-lg border border-oat px-2 py-1 text-right text-sm"
              />
            </div>
            <div className="mb-3 flex items-center justify-between text-lg font-bold">
              <span>Total</span>
              <span className="text-terracotta">{money(total)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={!lines.length}
                onClick={() => { setTendered(""); setPay("CASH"); }}
                className="btn-3d rounded-xl bg-espresso py-3 font-bold text-cream disabled:opacity-40"
              >
                💵 Cash
              </button>
              <button
                disabled={!lines.length}
                onClick={() => setPay("CARD")}
                className="btn-3d rounded-xl bg-terracotta py-3 font-bold text-cream disabled:opacity-40"
              >
                💳 Card
              </button>
            </div>
          </div>
        </div>
      </div>

      {editing && <ConfigModal line={editing} onClose={() => setEditing(null)} onSave={(u) => { setLines((ls) => ls.map((l) => (l.id === u.id ? u : l))); setEditing(null); }} />}
      {pay && (
        <PayModal
          method={pay}
          total={total}
          tendered={tendered}
          setTendered={setTendered}
          busy={busy}
          onCancel={() => setPay(null)}
          onConfirm={() => completeSale(pay)}
        />
      )}
      {receipt && <Receipt order={receipt} onNew={newSale} />}
    </div>
  );
}

// ---- Config modal (size + add-ons + qty + note) -------------------------------
function ConfigModal({ line, onClose, onSave }: { line: Line; onClose: () => void; onSave: (l: Line) => void }) {
  const [options, setOptions] = useState<Sel[]>(line.options);
  const [addons, setAddons] = useState<TAddon[]>(line.addons);
  const [quantity, setQuantity] = useState(line.quantity);
  const [note, setNote] = useState(line.note);
  const [groups, setGroups] = useState<AddonGroup[]>([]);

  useEffect(() => {
    api.get<AddonGroup[]>(`/api/addons/for/${line.item.id}`).then(setGroups).catch(() => setGroups([]));
  }, [line.item.id]);

  const pickOption = (groupName: string, choiceLabel: string, priceDelta: number) =>
    setOptions((os) => {
      const rest = os.filter((o) => o.group !== groupName);
      return [...rest, { group: groupName, choice: choiceLabel, priceDelta }];
    });
  const toggleAddon = (a: { id: number; name: string; price: number }) =>
    setAddons((as) => (as.some((x) => x.addonId === a.id) ? as.filter((x) => x.addonId !== a.id) : [...as, { addonId: a.id, name: a.name, price: a.price, quantity: 1 }]));

  const preview = { ...line, options, addons, quantity };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <p className="font-display text-xl font-bold text-espresso">{line.item.name}</p>

        {line.item.options.map((g) => (
          <div key={g.name} className="mt-4">
            <p className="text-sm font-semibold text-espresso">{g.name}</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {g.choices.map((c) => {
                const active = options.find((o) => o.group === g.name)?.choice === c.label;
                return (
                  <button
                    key={c.label}
                    onClick={() => pickOption(g.name, c.label, c.priceDelta)}
                    className={`rounded-full border px-4 py-1.5 text-sm font-medium ${active ? "border-espresso bg-espresso text-cream" : "border-oat bg-white text-charcoal"}`}
                  >
                    {c.label}{c.priceDelta ? ` +${money(c.priceDelta)}` : ""}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {groups.map((g) => (
          <div key={g.id} className="mt-4">
            <p className="text-sm font-semibold text-espresso">{g.name}</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {g.addons.map((a) => {
                const active = addons.some((x) => x.addonId === a.id);
                return (
                  <button
                    key={a.id}
                    onClick={() => toggleAddon(a)}
                    className={`rounded-full border px-4 py-1.5 text-sm font-medium ${active ? "border-sage-dark bg-sage/20 text-sage-dark" : "border-oat bg-white text-charcoal"}`}
                  >
                    {a.name}{a.price ? ` +${money(a.price)}` : ""}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <label className="mt-4 block text-sm font-semibold text-espresso">
          Note
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. extra hot" className="mt-1 w-full rounded-xl border border-oat px-3 py-2 font-normal" />
        </label>

        <div className="mt-4 flex items-center gap-3">
          <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="h-9 w-9 rounded-full bg-oat text-xl font-bold">–</button>
          <span className="w-8 text-center text-lg font-bold">{quantity}</span>
          <button onClick={() => setQuantity((q) => q + 1)} className="h-9 w-9 rounded-full bg-oat text-xl font-bold">+</button>
          <span className="ml-auto text-lg font-bold text-terracotta">{money(lineTotal(preview))}</span>
        </div>

        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-full border border-oat py-2.5 font-semibold text-charcoal/60">Cancel</button>
          <button onClick={() => onSave(preview)} className="btn-3d flex-1 rounded-full bg-espresso py-2.5 font-semibold text-cream">Save</button>
        </div>
      </div>
    </div>
  );
}

// ---- Payment modal ------------------------------------------------------------
function PayModal({
  method, total, tendered, setTendered, busy, onCancel, onConfirm,
}: {
  method: "CASH" | "CARD"; total: number; tendered: string; setTendered: (v: string) => void; busy: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  const change = Math.round((Number(tendered) - total) * 100) / 100;
  const quick = [total, Math.ceil(total), Math.ceil(total / 5) * 5, Math.ceil(total / 10) * 10].filter((v, i, a) => a.indexOf(v) === i);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
        <p className="font-display text-xl font-bold text-espresso">{method === "CASH" ? "Cash payment" : "Card payment"}</p>
        <div className="mt-3 flex items-center justify-between text-lg">
          <span className="text-charcoal/60">Total due</span>
          <span className="font-bold text-terracotta">{money(total)}</span>
        </div>

        {method === "CASH" && (
          <>
            <label className="mt-4 block text-sm font-semibold text-espresso">
              Amount received
              <input
                autoFocus
                value={tendered}
                onChange={(e) => setTendered(e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                placeholder="0.00"
                className="mt-1 w-full rounded-xl border border-oat px-4 py-3 text-center text-2xl font-bold"
              />
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {quick.map((v) => (
                <button key={v} onClick={() => setTendered(String(v))} className="rounded-full bg-oat px-3 py-1.5 text-sm font-semibold">{money(v)}</button>
              ))}
            </div>
            {tendered !== "" && (
              <p className={`mt-3 text-center text-lg font-bold ${change >= 0 ? "text-sage-dark" : "text-terracotta"}`}>
                {change >= 0 ? `Change ${money(change)}` : `Short ${money(-change)}`}
              </p>
            )}
          </>
        )}
        {method === "CARD" && (
          <p className="mt-4 rounded-xl bg-oat/50 px-4 py-3 text-sm text-charcoal/70">Charge {money(total)} on the card machine, then confirm.</p>
        )}

        <div className="mt-5 flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-full border border-oat py-2.5 font-semibold text-charcoal/60">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={busy || (method === "CASH" && (tendered === "" || change < 0))}
            className="btn-3d flex-1 rounded-full bg-espresso py-2.5 font-semibold text-cream disabled:opacity-50"
          >
            {busy ? "Saving…" : "Complete sale"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Receipt ------------------------------------------------------------------
function Receipt({ order, onNew }: { order: Order; onNew: () => void }) {
  function printReceipt() {
    const w = window.open("", "_blank", "width=320,height=600");
    if (!w) return;
    const rows = order.items
      .map(
        (i) =>
          `<tr><td>${i.quantity}× ${i.name}${i.selectedOptions?.length ? " (" + i.selectedOptions.map((o) => o.choice).join(", ") + ")" : ""}</td><td style="text-align:right">${money(i.lineTotal)}</td></tr>`
      )
      .join("");
    w.document.write(`<html><head><title>${order.number}</title><style>
      body{font-family:monospace;font-size:12px;padding:8px;width:280px}
      h2{text-align:center;margin:4px 0} table{width:100%;border-collapse:collapse} td{padding:2px 0}
      .tot{border-top:1px dashed #000;margin-top:6px;padding-top:6px;font-weight:bold;font-size:14px}
      .c{text-align:center;color:#555}</style></head><body>
      <h2>Bean Avenue</h2>
      <p class="c">${order.number} · ${new Date(order.createdAt).toLocaleString()}</p>
      <table>${rows}</table>
      <table class="tot"><tr><td>TOTAL</td><td style="text-align:right">${money(order.total)}</td></tr>
      <tr><td>Paid (${order.paymentMethod})</td><td></td></tr></table>
      <p class="c">Thank you! ☕</p>
      <script>window.onload=function(){window.print();setTimeout(function(){window.close()},300)}</script>
      </body></html>`);
    w.document.close();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center">
        <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-sage/20 text-3xl">✓</div>
        <p className="font-display text-xl font-bold text-espresso">Sale complete</p>
        <p className="mt-1 text-sm text-charcoal/60">{order.number}</p>
        <p className="mt-3 text-3xl font-bold text-terracotta">{money(order.total)}</p>
        <p className="text-sm text-charcoal/50">Paid by {order.paymentMethod === "CARD" ? "card" : "cash"}{order.beansEarned ? ` · ${order.beansEarned} beans earned` : ""}</p>
        <div className="mt-5 flex gap-2">
          <button onClick={printReceipt} className="flex-1 rounded-full border border-oat py-2.5 font-semibold text-espresso hover:bg-oat">🖨 Print receipt</button>
          <button onClick={onNew} className="btn-3d flex-1 rounded-full bg-espresso py-2.5 font-semibold text-cream">New sale</button>
        </div>
      </div>
    </div>
  );
}
