import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Img } from "../components/Img";
import { api, isPosTokenValid, money, posApi, setPosToken } from "../lib/api";
import type { AddonGroup, MenuItem, Order } from "../types";

// ---- Shared models ------------------------------------------------------------
type Sel = { group: string; choice: string; priceDelta: number };
type TAddon = { addonId: number; name: string; price: number; quantity: number };
type Line = { id: number; item: MenuItem; quantity: number; options: Sel[]; addons: TAddon[]; note: string };
type Staff = { id: number; name: string; role: string };
type Shift = {
  id: number; staffName: string; openingFloat: number; cashPayIns: number; cashPayOuts: number; openedAt: string;
  salesCount: number; cashSales: number; cardSales: number; salesTotal: number; expectedCash: number; countedCash?: number;
};
type Session = { staff: Staff; shift: Shift | null };

const unitPrice = (l: Line) =>
  Math.round((l.item.price + l.options.reduce((s, o) => s + o.priceDelta, 0) + l.addons.reduce((s, a) => s + a.price * a.quantity, 0)) * 100) / 100;
const lineTotal = (l: Line) => Math.round(unitPrice(l) * l.quantity * 100) / 100;
const sigOf = (item: MenuItem, options: Sel[], addons: TAddon[]) =>
  `${item.id}|${options.map((o) => o.group + ":" + o.choice).join(",")}|${addons.map((a) => a.addonId + "x" + a.quantity).join(",")}`;
const defaultOptions = (item: MenuItem): Sel[] =>
  item.options.map((g) => ({ group: g.name, choice: g.choices[0]?.label ?? "", priceDelta: g.choices[0]?.priceDelta ?? 0 }));

// ---- Root: auth (PIN) + shift gate -------------------------------------------
export function POS() {
  const [authed, setAuthed] = useState(isPosTokenValid());
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    try {
      setSession(await posApi.get<Session>("/api/pos/session"));
    } catch {
      setPosToken(null);
      setAuthed(false);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (authed) loadSession();
    else setLoading(false);
  }, [authed, loadSession]);

  const logout = () => {
    setPosToken(null);
    setAuthed(false);
    setSession(null);
  };

  if (!authed) return <PinLogin onLogin={(s) => { setSession(s); setAuthed(true); setLoading(false); }} />;
  if (loading || !session) return <div className="grid h-screen place-items-center bg-oat/30 text-charcoal/50">Loading register…</div>;
  if (!session.shift) return <OpenShiftScreen staff={session.staff} onOpen={(shift) => setSession({ ...session, shift })} onLogout={logout} />;
  return <Register session={session} setShift={(shift) => setSession({ ...session, shift })} reload={loadSession} onLogout={logout} />;
}

// ---- PIN login ----------------------------------------------------------------
function PinLogin({ onLogin }: { onLogin: (s: Session) => void }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(p: string) {
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const res = await api.post<{ token: string; staff: Staff; shift: Shift | null }>("/api/pos/login", { pin: p });
      setPosToken(res.token);
      onLogin({ staff: res.staff, shift: res.shift });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Wrong PIN.");
      setPin("");
    } finally {
      setBusy(false);
    }
  }
  const press = (d: string) => {
    const next = (pin + d).slice(0, 6);
    setPin(next);
  };

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-espresso text-cream">
      <Img src="/bean.png" alt="" className="mb-2 h-10 w-10 brightness-0 invert" />
      <p className="font-display text-2xl font-bold">Bean Avenue Register</p>
      <p className="mt-1 text-cream/60">Enter your PIN</p>
      <div className="my-5 flex gap-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={`h-3.5 w-3.5 rounded-full ${i < pin.length ? "bg-cream" : "bg-cream/25"}`} />
        ))}
      </div>
      {err && <p className="mb-2 text-sm font-semibold text-terracotta">{err}</p>}
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} onClick={() => press(d)} className="h-16 w-16 rounded-full bg-mocha/60 text-2xl font-bold active:scale-95">{d}</button>
        ))}
        <button onClick={() => setPin("")} className="h-16 w-16 rounded-full text-sm font-semibold text-cream/60">Clear</button>
        <button onClick={() => press("0")} className="h-16 w-16 rounded-full bg-mocha/60 text-2xl font-bold active:scale-95">0</button>
        <button onClick={() => submit(pin)} disabled={pin.length < 4 || busy} className="h-16 w-16 rounded-full bg-terracotta text-lg font-bold disabled:opacity-40">→</button>
      </div>
      <Link to="/" className="mt-8 text-sm text-cream/50 hover:text-cream">← Back to site</Link>
    </div>
  );
}

// ---- Open shift ---------------------------------------------------------------
function OpenShiftScreen({ staff, onOpen, onLogout }: { staff: Staff; onOpen: (s: Shift) => void; onLogout: () => void }) {
  const [float, setFloat] = useState("");
  const [busy, setBusy] = useState(false);
  async function open() {
    setBusy(true);
    try {
      onOpen(await posApi.post<Shift>("/api/pos/shift/open", { openingFloat: Number(float) || 0 }));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Couldn't open the shift.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-oat/30 text-espresso">
      <p className="font-display text-2xl font-bold">Hi {staff.name} 👋</p>
      <p className="mt-1 text-charcoal/60">Open a shift to start selling.</p>
      <div className="mt-6 w-72 rounded-2xl bg-white p-5 shadow-sm">
        <label className="text-sm font-semibold">
          Starting cash in drawer
          <div className="mt-1 flex items-center gap-1">
            <span className="text-lg text-charcoal/50">$</span>
            <input autoFocus value={float} onChange={(e) => setFloat(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="0.00" className="w-full rounded-xl border border-oat px-3 py-2.5 text-lg" />
          </div>
        </label>
        <button onClick={open} disabled={busy} className="btn-3d mt-4 w-full rounded-xl bg-espresso py-3 font-bold text-cream disabled:opacity-50">
          {busy ? "Opening…" : "Open shift"}
        </button>
      </div>
      <button onClick={onLogout} className="mt-6 text-sm text-charcoal/50 hover:text-terracotta">Sign out</button>
    </div>
  );
}

// ---- Register -----------------------------------------------------------------
function Register({ session, setShift, reload, onLogout }: { session: Session; setShift: (s: Shift | null) => void; reload: () => void; onLogout: () => void }) {
  const shift = session.shift!;
  const [items, setItems] = useState<MenuItem[]>([]);
  const [cats, setCats] = useState<string[]>([]);
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [nextId, setNextId] = useState(1);
  const [editing, setEditing] = useState<Line | null>(null);
  const [pay, setPay] = useState<null | "CASH" | "CARD">(null);
  const [tendered, setTendered] = useState("");
  const [discount, setDiscount] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<Order | null>(null);
  const [shiftPanel, setShiftPanel] = useState(false);

  useEffect(() => {
    api.get<MenuItem[]>("/api/menu").then((m) => setItems(m.filter((i) => i.inStock && !i.isHidden))).catch(() => {});
    api.get<string[]>("/api/categories").then(setCats).catch(() => {});
  }, []);

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((i) => (cat === "All" || i.category === cat) && (s === "" || i.name.toLowerCase().includes(s) || i.category.toLowerCase().includes(s)));
  }, [items, cat, q]);

  const subtotal = Math.round(lines.reduce((s, l) => s + lineTotal(l), 0) * 100) / 100;
  const disc = Math.min(Math.max(0, Number(discount) || 0), subtotal);
  const total = Math.round((subtotal - disc) * 100) / 100;

  function addItem(item: MenuItem) {
    const options = defaultOptions(item);
    const key = sigOf(item, options, []);
    const existing = lines.find((l) => sigOf(l.item, l.options, l.addons) === key);
    if (existing) setLines((ls) => ls.map((l) => (l.id === existing.id ? { ...l, quantity: l.quantity + 1 } : l)));
    else {
      setLines((ls) => [...ls, { id: nextId, item, quantity: 1, options, addons: [], note: "" }]);
      setNextId((n) => n + 1);
    }
  }
  const setQty = (id: number, delta: number) =>
    setLines((ls) => ls.flatMap((l) => (l.id === id ? (l.quantity + delta <= 0 ? [] : [{ ...l, quantity: l.quantity + delta }]) : [l])));

  function newSale() {
    setLines([]); setDiscount(""); setPhone(""); setTendered(""); setReceipt(null); setPay(null);
  }

  async function completeSale(method: "CASH" | "CARD") {
    if (!lines.length || busy) return;
    setBusy(true);
    try {
      const order = await posApi.post<Order>("/api/pos/sale", {
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
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Couldn't complete the sale.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-oat/30 text-espresso">
      <div className="flex items-center justify-between border-b border-oat bg-white px-4 py-2">
        <div className="flex items-center gap-2">
          <Img src="/bean.png" alt="" className="h-6 w-6" />
          <span className="font-display text-base font-bold">Bean Avenue POS</span>
          <span className="ml-2 text-sm text-charcoal/50">{session.staff.name}</span>
        </div>
        <button onClick={() => setShiftPanel(true)} className="rounded-full bg-oat px-3 py-1.5 text-sm font-semibold hover:bg-espresso hover:text-cream">
          Shift · expected {money(shift.expectedCash)}
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="p-3">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items…" className="w-full rounded-full border border-oat bg-white px-4 py-2" />
          </div>
          <div className="flex gap-2 overflow-x-auto px-3 pb-2">
            {["All", ...cats].map((c) => (
              <button key={c} onClick={() => setCat(c)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold ${cat === c ? "bg-espresso text-cream" : "bg-white hover:bg-oat"}`}>{c}</button>
            ))}
          </div>
          <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto p-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {visible.map((item) => (
              <button key={item.id} onClick={() => addItem(item)} className="card-lift flex flex-col overflow-hidden rounded-xl bg-white text-left shadow-sm active:scale-95">
                <Img src={item.photo} alt={item.name} fit={item.imageFit === "contain" ? "contain" : "cover"} className="aspect-square w-full bg-oat/30" />
                <div className="p-2">
                  <p className="line-clamp-2 text-sm font-semibold leading-tight">{item.name}</p>
                  <p className="text-sm font-bold text-terracotta">{item.options.length ? `From ${money(item.price)}` : money(item.price)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex w-80 shrink-0 flex-col border-l border-oat bg-white sm:w-96">
          <div className="flex items-center justify-between border-b border-oat px-4 py-2.5">
            <span className="font-display text-lg font-bold">Current sale</span>
            {lines.length > 0 && <button onClick={newSale} className="text-sm font-semibold text-charcoal/50 hover:text-terracotta">Clear</button>}
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
                      <p className="truncate text-xs text-charcoal/50">{[...l.options.map((o) => o.choice), ...l.addons.map((a) => a.name)].join(" · ") || "tap to edit"}</p>
                    </button>
                    <span className="whitespace-nowrap font-semibold text-terracotta">{money(lineTotal(l))}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <button onClick={() => setQty(l.id, -1)} className="h-7 w-7 rounded-full bg-oat text-lg font-bold leading-none">–</button>
                    <span className="w-6 text-center font-semibold">{l.quantity}</span>
                    <button onClick={() => setQty(l.id, 1)} className="h-7 w-7 rounded-full bg-oat text-lg font-bold leading-none">+</button>
                    <button onClick={() => setLines((ls) => ls.filter((x) => x.id !== l.id))} className="ml-auto text-xs font-semibold text-charcoal/40 hover:text-terracotta">Remove</button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-oat p-3">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Customer phone (optional — earns beans)" className="mb-2 w-full rounded-xl border border-oat px-3 py-2 text-sm" />
            <div className="mb-1 flex items-center justify-between text-sm"><span className="text-charcoal/60">Subtotal</span><span>{money(subtotal)}</span></div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-charcoal/60">Discount ($)</span>
              <input value={discount} onChange={(e) => setDiscount(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="0" className="w-20 rounded-lg border border-oat px-2 py-1 text-right text-sm" />
            </div>
            <div className="mb-3 flex items-center justify-between text-lg font-bold"><span>Total</span><span className="text-terracotta">{money(total)}</span></div>
            <div className="grid grid-cols-2 gap-2">
              <button disabled={!lines.length} onClick={() => { setTendered(""); setPay("CASH"); }} className="btn-3d rounded-xl bg-espresso py-3 font-bold text-cream disabled:opacity-40">💵 Cash</button>
              <button disabled={!lines.length} onClick={() => setPay("CARD")} className="btn-3d rounded-xl bg-terracotta py-3 font-bold text-cream disabled:opacity-40">💳 Card</button>
            </div>
          </div>
        </div>
      </div>

      {editing && <ConfigModal line={editing} onClose={() => setEditing(null)} onSave={(u) => { setLines((ls) => ls.map((l) => (l.id === u.id ? u : l))); setEditing(null); }} />}
      {pay && <PayModal method={pay} total={total} tendered={tendered} setTendered={setTendered} busy={busy} onCancel={() => setPay(null)} onConfirm={() => completeSale(pay)} />}
      {receipt && <Receipt order={receipt} onNew={newSale} />}
      {shiftPanel && <ShiftPanel shift={shift} staff={session.staff} onClose={() => setShiftPanel(false)} reload={reload} onClosedShift={() => setShift(null)} onLogout={onLogout} />}
    </div>
  );
}

// ---- Shift panel (cash in/out, close, sign out) -------------------------------
function ShiftPanel({ shift, staff, onClose, reload, onClosedShift, onLogout }: {
  shift: Shift; staff: Staff; onClose: () => void; reload: () => void; onClosedShift: () => void; onLogout: () => void;
}) {
  const [mode, setMode] = useState<"menu" | "cash" | "close">("menu");
  const [cashType, setCashType] = useState<"PAYIN" | "PAYOUT">("PAYOUT");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [counted, setCounted] = useState("");
  const [report, setReport] = useState<Shift & { difference: number } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submitCash() {
    setBusy(true);
    try {
      await posApi.post("/api/pos/cash", { type: cashType, amount: Number(amount) || 0, reason });
      reload();
      onClose();
    } catch (e) { alert(e instanceof Error ? e.message : "Couldn't record cash."); } finally { setBusy(false); }
  }
  async function closeShift() {
    setBusy(true);
    try {
      setReport(await posApi.post("/api/pos/shift/close", { countedCash: Number(counted) || 0 }));
    } catch (e) { alert(e instanceof Error ? e.message : "Couldn't close the shift."); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={report ? undefined : onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
        {report ? (
          <div className="text-center">
            <p className="font-display text-xl font-bold text-espresso">Shift closed</p>
            <div className="mt-3 space-y-1 text-left text-sm">
              <Row label="Sales" value={`${report.salesCount} · ${money(report.salesTotal)}`} />
              <Row label="Cash sales" value={money(report.cashSales)} />
              <Row label="Card sales" value={money(report.cardSales)} />
              <Row label="Opening float" value={money(report.openingFloat)} />
              <Row label="Pay-ins / outs" value={`${money(report.cashPayIns)} / ${money(report.cashPayOuts)}`} />
              <Row label="Expected cash" value={money(report.expectedCash)} bold />
              <Row label="Counted cash" value={money(report.countedCash ?? 0)} bold />
              <Row label="Difference" value={`${report.difference >= 0 ? "+" : ""}${money(report.difference)}`} bold />
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={() => { onClosedShift(); onClose(); }} className="flex-1 rounded-full border border-oat py-2.5 font-semibold">New shift</button>
              <button onClick={() => { onLogout(); }} className="btn-3d flex-1 rounded-full bg-espresso py-2.5 font-semibold text-cream">Sign out</button>
            </div>
          </div>
        ) : mode === "menu" ? (
          <>
            <p className="font-display text-xl font-bold text-espresso">Shift</p>
            <div className="mt-3 space-y-1 text-sm">
              <Row label="Staff" value={staff.name} />
              <Row label="Sales so far" value={`${shift.salesCount} · ${money(shift.salesTotal)}`} />
              <Row label="Expected cash" value={money(shift.expectedCash)} bold />
            </div>
            <div className="mt-4 space-y-2">
              <button onClick={() => { setCashType("PAYIN"); setMode("cash"); }} className="w-full rounded-xl bg-oat py-2.5 font-semibold">＋ Cash in</button>
              <button onClick={() => { setCashType("PAYOUT"); setMode("cash"); }} className="w-full rounded-xl bg-oat py-2.5 font-semibold">－ Cash out</button>
              <button onClick={() => setMode("close")} className="w-full rounded-xl bg-terracotta py-2.5 font-semibold text-cream">Close shift (Z-report)</button>
              <button onClick={onLogout} className="w-full py-1 text-sm text-charcoal/50 hover:text-terracotta">Sign out</button>
            </div>
            <button onClick={onClose} className="mt-3 w-full text-sm text-charcoal/50">Back to register</button>
          </>
        ) : mode === "cash" ? (
          <>
            <p className="font-display text-xl font-bold text-espresso">{cashType === "PAYIN" ? "Cash in" : "Cash out"}</p>
            <label className="mt-3 block text-sm font-semibold">Amount
              <input autoFocus value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="0.00" className="mt-1 w-full rounded-xl border border-oat px-3 py-2 text-lg" />
            </label>
            <label className="mt-2 block text-sm font-semibold">Reason
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. milk run, tips" className="mt-1 w-full rounded-xl border border-oat px-3 py-2 font-normal" />
            </label>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setMode("menu")} className="flex-1 rounded-full border border-oat py-2.5 font-semibold">Back</button>
              <button onClick={submitCash} disabled={busy || !amount} className="btn-3d flex-1 rounded-full bg-espresso py-2.5 font-semibold text-cream disabled:opacity-50">Record</button>
            </div>
          </>
        ) : (
          <>
            <p className="font-display text-xl font-bold text-espresso">Close shift</p>
            <div className="mt-3 space-y-1 text-sm">
              <Row label="Expected cash in drawer" value={money(shift.expectedCash)} bold />
            </div>
            <label className="mt-3 block text-sm font-semibold">Count the cash in the drawer
              <div className="mt-1 flex items-center gap-1">
                <span className="text-lg text-charcoal/50">$</span>
                <input autoFocus value={counted} onChange={(e) => setCounted(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="0.00" className="w-full rounded-xl border border-oat px-3 py-2 text-lg" />
              </div>
            </label>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setMode("menu")} className="flex-1 rounded-full border border-oat py-2.5 font-semibold">Back</button>
              <button onClick={closeShift} disabled={busy || counted === ""} className="btn-3d flex-1 rounded-full bg-terracotta py-2.5 font-semibold text-cream disabled:opacity-50">{busy ? "Closing…" : "Close shift"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
const Row = ({ label, value, bold }: { label: string; value: string; bold?: boolean }) => (
  <div className={`flex items-center justify-between ${bold ? "font-bold text-espresso" : "text-charcoal/70"}`}><span>{label}</span><span>{value}</span></div>
);

// ---- Config modal -------------------------------------------------------------
function ConfigModal({ line, onClose, onSave }: { line: Line; onClose: () => void; onSave: (l: Line) => void }) {
  const [options, setOptions] = useState<Sel[]>(line.options);
  const [addons, setAddons] = useState<TAddon[]>(line.addons);
  const [quantity, setQuantity] = useState(line.quantity);
  const [note, setNote] = useState(line.note);
  const [groups, setGroups] = useState<AddonGroup[]>([]);
  useEffect(() => { api.get<AddonGroup[]>(`/api/addons/for/${line.item.id}`).then(setGroups).catch(() => setGroups([])); }, [line.item.id]);

  const pickOption = (g: string, choice: string, priceDelta: number) => setOptions((os) => [...os.filter((o) => o.group !== g), { group: g, choice, priceDelta }]);
  const toggleAddon = (a: { id: number; name: string; price: number }) =>
    setAddons((as) => (as.some((x) => x.addonId === a.id) ? as.filter((x) => x.addonId !== a.id) : [...as, { addonId: a.id, name: a.name, price: a.price, quantity: 1 }]));
  const preview = { ...line, options, addons, quantity };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <p className="font-display text-xl font-bold text-espresso">{line.item.name}</p>
        {line.item.options.map((g) => (
          <div key={g.name} className="mt-4">
            <p className="text-sm font-semibold text-espresso">{g.name}</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {g.choices.map((c) => {
                const active = options.find((o) => o.group === g.name)?.choice === c.label;
                return <button key={c.label} onClick={() => pickOption(g.name, c.label, c.priceDelta)} className={`rounded-full border px-4 py-1.5 text-sm font-medium ${active ? "border-espresso bg-espresso text-cream" : "border-oat bg-white"}`}>{c.label}{c.priceDelta ? ` +${money(c.priceDelta)}` : ""}</button>;
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
                return <button key={a.id} onClick={() => toggleAddon(a)} className={`rounded-full border px-4 py-1.5 text-sm font-medium ${active ? "border-sage-dark bg-sage/20 text-sage-dark" : "border-oat bg-white"}`}>{a.name}{a.price ? ` +${money(a.price)}` : ""}</button>;
              })}
            </div>
          </div>
        ))}
        <label className="mt-4 block text-sm font-semibold text-espresso">Note
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
function PayModal({ method, total, tendered, setTendered, busy, onCancel, onConfirm }: {
  method: "CASH" | "CARD"; total: number; tendered: string; setTendered: (v: string) => void; busy: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  const change = Math.round((Number(tendered) - total) * 100) / 100;
  const quick = [total, Math.ceil(total), Math.ceil(total / 5) * 5, Math.ceil(total / 10) * 10].filter((v, i, a) => a.indexOf(v) === i);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
        <p className="font-display text-xl font-bold text-espresso">{method === "CASH" ? "Cash payment" : "Card payment"}</p>
        <div className="mt-3 flex items-center justify-between text-lg"><span className="text-charcoal/60">Total due</span><span className="font-bold text-terracotta">{money(total)}</span></div>
        {method === "CASH" && (
          <>
            <label className="mt-4 block text-sm font-semibold text-espresso">Amount received
              <input autoFocus value={tendered} onChange={(e) => setTendered(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="0.00" className="mt-1 w-full rounded-xl border border-oat px-4 py-3 text-center text-2xl font-bold" />
            </label>
            <div className="mt-2 flex flex-wrap gap-2">{quick.map((v) => <button key={v} onClick={() => setTendered(String(v))} className="rounded-full bg-oat px-3 py-1.5 text-sm font-semibold">{money(v)}</button>)}</div>
            {tendered !== "" && <p className={`mt-3 text-center text-lg font-bold ${change >= 0 ? "text-sage-dark" : "text-terracotta"}`}>{change >= 0 ? `Change ${money(change)}` : `Short ${money(-change)}`}</p>}
          </>
        )}
        {method === "CARD" && <p className="mt-4 rounded-xl bg-oat/50 px-4 py-3 text-sm text-charcoal/70">Charge {money(total)} on the card machine, then confirm.</p>}
        <div className="mt-5 flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-full border border-oat py-2.5 font-semibold text-charcoal/60">Cancel</button>
          <button onClick={onConfirm} disabled={busy || (method === "CASH" && (tendered === "" || change < 0))} className="btn-3d flex-1 rounded-full bg-espresso py-2.5 font-semibold text-cream disabled:opacity-50">{busy ? "Saving…" : "Complete sale"}</button>
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
      .map((i) => `<tr><td>${i.quantity}× ${i.name}${i.selectedOptions?.length ? " (" + i.selectedOptions.map((o) => o.choice).join(", ") + ")" : ""}</td><td style="text-align:right">${money(i.lineTotal)}</td></tr>`)
      .join("");
    w.document.write(`<html><head><title>${order.number}</title><style>body{font-family:monospace;font-size:12px;padding:8px;width:280px}h2{text-align:center;margin:4px 0}table{width:100%;border-collapse:collapse}td{padding:2px 0}.tot{border-top:1px dashed #000;margin-top:6px;padding-top:6px;font-weight:bold;font-size:14px}.c{text-align:center;color:#555}</style></head><body><h2>Bean Avenue</h2><p class="c">${order.number} · ${new Date(order.createdAt).toLocaleString()}</p><table>${rows}</table><table class="tot"><tr><td>TOTAL</td><td style="text-align:right">${money(order.total)}</td></tr><tr><td>Paid (${order.paymentMethod})</td><td></td></tr></table><p class="c">Thank you! ☕</p><script>window.onload=function(){window.print();setTimeout(function(){window.close()},300)}</script></body></html>`);
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
