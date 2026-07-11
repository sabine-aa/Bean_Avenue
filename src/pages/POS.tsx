import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Img } from "../components/Img";
import { ApiError, api, formatTime, getPosTerminal, isPosTokenValid, money, posApi, setPosToken, setPosTerminal } from "../lib/api";
import { cacheMenu, cachedCats, cachedMenu, flushQueue, getQueue, queueSale } from "../lib/posOffline";
import type { Addon, AddonGroup, MenuItem, Order, OrderItemLine, OrderStatus } from "../types";

const makeRef = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

// ---- Shared models ------------------------------------------------------------
type Sel = { group: string; choice: string; priceDelta: number };
type TAddon = { addonId: number; name: string; price: number; quantity: number };
type PayMethod = "CASH" | "CARD" | "WHISH";
type Line = { id: number; item: MenuItem; quantity: number; options: Sel[]; addons: TAddon[]; note: string };
type Staff = { id: number; name: string; role: string };
type Shift = {
  id: number; staffName: string; openingFloat: number; cashPayIns: number; cashPayOuts: number; openedAt: string;
  salesCount: number; cashSales: number; cardSales: number; whishSales: number; salesTotal: number; expectedCash: number; countedCash?: number;
};
type PosConfig = { card: { enabled: boolean; requireApprovalCode: boolean; provider: string } };
type Session = { staff: Staff; shift: Shift | null; config?: PosConfig; terminal?: string };

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
  const [terminal, setTerminal] = useState(getPosTerminal());

  function renameTerminal() {
    const name = window.prompt("Name this register (each till has its own shift & cash drawer):", terminal);
    if (name && name.trim()) { setPosTerminal(name); setTerminal(getPosTerminal()); }
  }

  async function submit(p: string) {
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const res = await api.post<{ token: string; staff: Staff; shift: Shift | null; config?: PosConfig }>("/api/pos/login", { pin: p });
      setPosToken(res.token);
      onLogin({ staff: res.staff, shift: res.shift, config: res.config });
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
      <button onClick={renameTerminal} className="mt-6 text-sm text-cream/50 hover:text-cream">🖥 {terminal} · change</button>
      <Link to="/" className="mt-3 text-sm text-cream/50 hover:text-cream">← Back to site</Link>
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
  // The customize popup — for a brand-new line (isNew) or editing one in the ticket.
  const [modal, setModal] = useState<{ line: Line; isNew: boolean } | null>(null);
  const [coverage, setCoverage] = useState<{ itemIds: Set<number>; categories: Set<string> }>({ itemIds: new Set(), categories: new Set() });
  const [pay, setPay] = useState<null | PayMethod>(null);
  const [tendered, setTendered] = useState("");
  const [discount, setDiscount] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<Order | null>(null);
  const [shiftPanel, setShiftPanel] = useState(false);
  const [orderType, setOrderType] = useState<"TAKEAWAY" | "DINE_IN">("TAKEAWAY");
  const [table, setTable] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(getQueue().length);
  const [cardApproval, setCardApproval] = useState("");
  const [cardLast4, setCardLast4] = useState("");
  const cardCfg = session.config?.card;
  const cardEnabled = cardCfg?.enabled ?? false;
  const [onlineOrders, setOnlineOrders] = useState<Order[]>([]);
  const [onlineNew, setOnlineNew] = useState(0);
  const [showOnline, setShowOnline] = useState(false);

  // Website/app orders stream into the register live.
  const loadOnline = useCallback(async () => {
    try {
      const r = await posApi.get<{ newCount: number; orders: Order[] }>("/api/pos/online");
      setOnlineOrders(r.orders);
      setOnlineNew(r.newCount);
    } catch { /* offline — keep the last list */ }
  }, []);
  useEffect(() => {
    loadOnline();
    const t = setInterval(loadOnline, 12000);
    return () => clearInterval(t);
  }, [loadOnline]);

  // Load the menu; if we're offline, fall back to the last cached copy.
  useEffect(() => {
    Promise.all([api.get<MenuItem[]>("/api/menu"), api.get<string[]>("/api/categories")])
      .then(([m, c]) => {
        const menu = m.filter((i) => i.inStock && !i.isHidden);
        setItems(menu);
        setCats(c);
        cacheMenu(menu, c);
      })
      .catch(() => {
        setItems(cachedMenu());
        setCats(cachedCats());
      });
    // Which items/categories have add-on groups → tapping them opens the customizer.
    api.get<{ itemIds: number[]; categories: string[] }>("/api/addons/coverage")
      .then((cv) => setCoverage({ itemIds: new Set(cv.itemIds), categories: new Set(cv.categories) }))
      .catch(() => {});
  }, []);

  // Does this product need the customize popup (sizes or any add-ons)?
  const needsConfig = (item: MenuItem) => item.options.length > 0 || coverage.itemIds.has(item.id) || coverage.categories.has(item.category);

  // Keep queued offline sales syncing whenever we're online.
  useEffect(() => {
    const sync = async () => setPending(await flushQueue());
    const goOnline = () => { setOnline(true); sync(); };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    sync();
    const t = setInterval(() => { setOnline(navigator.onLine); if (navigator.onLine) sync(); }, 15000);
    return () => { window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); clearInterval(t); };
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
    // Sizes/add-ons → open the customizer for a fresh line. Simple items add instantly.
    if (needsConfig(item)) {
      setModal({ line: { id: nextId, item, quantity: 1, options, addons: [], note: "" }, isNew: true });
      setNextId((n) => n + 1);
      return;
    }
    const key = sigOf(item, options, []);
    const existing = lines.find((l) => sigOf(l.item, l.options, l.addons) === key);
    if (existing) setLines((ls) => ls.map((l) => (l.id === existing.id ? { ...l, quantity: l.quantity + 1 } : l)));
    else {
      setLines((ls) => [...ls, { id: nextId, item, quantity: 1, options, addons: [], note: "" }]);
      setNextId((n) => n + 1);
    }
  }

  // Save from the customize popup — append a new line or update the edited one.
  function saveConfigured(updated: Line, isNew: boolean) {
    setLines((ls) => (isNew ? [...ls, updated] : ls.map((l) => (l.id === updated.id ? updated : l))));
    setModal(null);
  }
  const setQty = (id: number, delta: number) =>
    setLines((ls) => ls.flatMap((l) => (l.id === id ? (l.quantity + delta <= 0 ? [] : [{ ...l, quantity: l.quantity + delta }]) : [l])));

  function newSale() {
    setLines([]); setDiscount(""); setPhone(""); setTendered(""); setReceipt(null); setPay(null); setTable(""); setCardApproval(""); setCardLast4("");
  }

  async function completeSale(method: PayMethod) {
    if (!lines.length || busy) return;
    setBusy(true);
    const payload = {
      clientRef: makeRef(),
      paymentMethod: method,
      discount: disc,
      orderType,
      tableNumber: orderType === "DINE_IN" ? table.trim() || undefined : undefined,
      customerPhone: phone.trim() || undefined,
      cardApprovalCode: method === "CARD" ? cardApproval.trim() || undefined : undefined,
      cardLast4: method === "CARD" ? cardLast4.trim() || undefined : undefined,
      items: lines.map((l) => ({
        menuItemId: l.item.id,
        quantity: l.quantity,
        selectedOptions: l.options.map((o) => ({ group: o.group, choice: o.choice })),
        addons: l.addons.map((a) => ({ addonId: a.addonId, quantity: a.quantity })),
        specialInstructions: l.note || undefined,
      })),
    };
    try {
      const order = await posApi.post<Order>("/api/pos/sale", payload);
      setReceipt(order);
      setPay(null);
      reload();
    } catch (e) {
      // A real server rejection → show it. A network failure (offline) → save the
      // sale locally and sync it automatically when the connection returns.
      if (e instanceof ApiError && navigator.onLine) {
        alert(e.message);
      } else {
        queueSale(payload);
        setPending(getQueue().length);
        setOnline(navigator.onLine);
        setReceipt({
          number: "SAVED OFFLINE",
          total,
          paymentMethod: method,
          createdAt: new Date().toISOString(),
          beansEarned: 0,
          items: lines.map((l) => ({ id: l.id, menuItemId: l.item.id, name: l.item.name, unitPrice: unitPrice(l), quantity: l.quantity, selectedOptions: l.options, addons: [], specialInstructions: l.note || null, lineTotal: lineTotal(l) })),
        } as unknown as Order);
        setPay(null);
      }
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
          <span className="rounded-full bg-oat px-2 py-0.5 text-xs font-semibold text-charcoal/60">🖥 {session.terminal ?? getPosTerminal()}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowOnline(true)} className={`relative rounded-full px-3 py-1.5 text-sm font-semibold ${onlineNew > 0 ? "bg-terracotta text-cream" : "bg-oat hover:bg-espresso hover:text-cream"}`}>
            🌐 Online Orders{onlineOrders.length ? ` · ${onlineOrders.length}` : ""}
            {onlineNew > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-[20px] place-items-center rounded-full bg-espresso px-1 text-xs font-bold text-cream">{onlineNew}</span>}
          </button>
          <Link to="/kds" className="rounded-full bg-oat px-3 py-1.5 text-sm font-semibold hover:bg-espresso hover:text-cream">🍳 Kitchen</Link>
          <button onClick={() => setShiftPanel(true)} className="rounded-full bg-oat px-3 py-1.5 text-sm font-semibold hover:bg-espresso hover:text-cream">
            Shift · expected {money(shift.expectedCash)}
          </button>
        </div>
      </div>

      {(!online || pending > 0) && (
        <div className={`px-4 py-1 text-center text-sm font-semibold ${online ? "bg-amber-400/40 text-amber-900" : "bg-terracotta text-cream"}`}>
          {online
            ? `Syncing ${pending} offline sale${pending === 1 ? "" : "s"}…`
            : `⚠ Offline — ${pending} sale${pending === 1 ? "" : "s"} saved locally, will sync when back online`}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="p-3">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items…" className="w-full rounded-full border border-oat bg-white px-4 py-2" />
          </div>
          <div className="flex snap-x gap-2 overflow-x-auto scroll-smooth px-3 pb-2 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {["All", ...cats].map((c) => (
              <button key={c} onClick={() => setCat(c)} className={`snap-start whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${cat === c ? "bg-espresso text-cream shadow-sm" : "bg-white hover:bg-oat"}`}>{c}</button>
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
                    <button onClick={() => setModal({ line: l, isNew: false })} className="min-w-0 flex-1 text-left">
                      <p className="truncate font-semibold">{l.item.name}</p>
                      <p className="truncate text-xs text-charcoal/50">{[...l.options.map((o) => o.choice), ...l.addons.map((a) => (a.quantity > 1 ? `${a.name} ×${a.quantity}` : a.name)), l.note].filter(Boolean).join(" · ") || "tap to edit"}</p>
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
            <div className="mb-2 grid grid-cols-2 gap-2">
              <button onClick={() => setOrderType("TAKEAWAY")} className={`rounded-xl py-2 text-sm font-semibold ${orderType === "TAKEAWAY" ? "bg-espresso text-cream" : "bg-oat"}`}>🥡 Takeaway</button>
              <button onClick={() => setOrderType("DINE_IN")} className={`rounded-xl py-2 text-sm font-semibold ${orderType === "DINE_IN" ? "bg-espresso text-cream" : "bg-oat"}`}>🍽 Dine-in</button>
            </div>
            {orderType === "DINE_IN" && (
              <input value={table} onChange={(e) => setTable(e.target.value)} placeholder="Table number" className="mb-2 w-full rounded-xl border border-oat px-3 py-2 text-sm" />
            )}
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Customer phone (optional — earns beans)" className="mb-2 w-full rounded-xl border border-oat px-3 py-2 text-sm" />
            <div className="mb-1 flex items-center justify-between text-sm"><span className="text-charcoal/60">Subtotal</span><span>{money(subtotal)}</span></div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-charcoal/60">Discount ($)</span>
              <input value={discount} onChange={(e) => setDiscount(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="0" className="w-20 rounded-lg border border-oat px-2 py-1 text-right text-sm" />
            </div>
            <div className="mb-3 flex items-center justify-between text-lg font-bold"><span>Total</span><span className="text-terracotta">{money(total)}</span></div>
            <div className={`grid ${cardEnabled ? "grid-cols-3" : "grid-cols-2"} gap-2`}>
              <button disabled={!lines.length} onClick={() => { setTendered(""); setPay("CASH"); }} className="btn-3d rounded-xl bg-espresso py-3 text-sm font-bold text-cream disabled:opacity-40">💵 Cash</button>
              <button disabled={!lines.length} onClick={() => setPay("WHISH")} className="btn-3d rounded-xl bg-[#5b3fd6] py-3 text-sm font-bold text-cream disabled:opacity-40">📱 Whish</button>
              {cardEnabled && (
                <button disabled={!lines.length} onClick={() => { setCardApproval(""); setCardLast4(""); setPay("CARD"); }} className="btn-3d rounded-xl bg-terracotta py-3 text-sm font-bold text-cream disabled:opacity-40">💳 Card</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {showOnline && <OnlineOrdersPanel orders={onlineOrders} onClose={() => setShowOnline(false)} onChanged={loadOnline} />}
      {modal && <ConfigModal line={modal.line} isNew={modal.isNew} onClose={() => setModal(null)} onSave={(u) => saveConfigured(u, modal.isNew)} />}
      {pay && <PayModal method={pay} total={total} tendered={tendered} setTendered={setTendered} approval={cardApproval} setApproval={setCardApproval} last4={cardLast4} setLast4={setCardLast4} requireApproval={cardCfg?.requireApprovalCode ?? false} busy={busy} onCancel={() => setPay(null)} onConfirm={() => completeSale(pay)} />}
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
              <Row label="Whish sales" value={money(report.whishSales)} />
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

// ---- Online orders panel — live website/app orders staff work from the POS ----
const STATUS_PILL: Record<string, { label: string; cls: string }> = {
  RECEIVED: { label: "New", cls: "bg-terracotta text-cream" },
  ACCEPTED: { label: "Accepted", cls: "bg-amber-400/30 text-amber-800" },
  PREPARING: { label: "Preparing", cls: "bg-amber-400/40 text-amber-900" },
  READY_FOR_PICKUP: { label: "Ready", cls: "bg-sage/30 text-sage-dark" },
  READY_FOR_DELIVERY: { label: "Ready", cls: "bg-sage/30 text-sage-dark" },
  OUT_FOR_DELIVERY: { label: "Out for delivery", cls: "bg-sage/30 text-sage-dark" },
};
const PAY_LABEL: Record<string, string> = {
  ONLINE: "Paid online (card)", CASH_ON_DELIVERY: "Cash on delivery", CASH_AT_PICKUP: "Cash at pickup", CASH: "Cash", CARD: "Card", WHISH: "Whish",
};
const PAY_STATUS_LABEL: Record<string, string> = {
  PAID: "Paid", PENDING: "Awaiting payment", CASH_DUE: "Cash due", CASH_COLLECTED: "Cash collected", FAILED: "Payment failed", REFUNDED: "Refunded",
};

function nextActions(o: Order): { label: string; status: OrderStatus; danger?: boolean }[] {
  const del = o.fulfillment === "DELIVERY";
  switch (o.status) {
    case "RECEIVED": return [{ label: "✓ Accept", status: "ACCEPTED" }, { label: "Cancel", status: "CANCELLED", danger: true }];
    case "ACCEPTED": return [{ label: "👨‍🍳 Start preparing", status: "PREPARING" }, { label: "Cancel", status: "CANCELLED", danger: true }];
    case "PREPARING": return [{ label: del ? "📦 Ready for delivery" : "🔔 Mark ready", status: del ? "READY_FOR_DELIVERY" : "READY_FOR_PICKUP" }, { label: "Cancel", status: "CANCELLED", danger: true }];
    case "READY_FOR_PICKUP": return [{ label: "✓ Complete (picked up)", status: "COMPLETED" }];
    case "READY_FOR_DELIVERY": return [{ label: "🛵 Out for delivery", status: "OUT_FOR_DELIVERY" }];
    case "OUT_FOR_DELIVERY": return [{ label: "✓ Delivered", status: "DELIVERED" }];
    default: return [];
  }
}

const itemLine = (it: OrderItemLine) =>
  [...it.selectedOptions.map((o) => o.choice), ...it.addons.map((a) => (a.quantity > 1 ? `${a.name} ×${a.quantity}` : a.name))].filter(Boolean).join(" · ");

function OnlineOrdersPanel({ orders, onClose, onChanged }: { orders: Order[]; onClose: () => void; onChanged: () => void }) {
  const [busyId, setBusyId] = useState<number | null>(null);

  async function act(o: Order, status: OrderStatus) {
    let reason: string | undefined;
    if (status === "CANCELLED") {
      reason = window.prompt(`Cancel order ${o.number}? Enter a reason:`, "") ?? undefined;
      if (!reason || !reason.trim()) return;
    }
    setBusyId(o.id);
    try {
      await posApi.patch(`/api/pos/online/${o.id}/status`, { status, reason });
      await onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Couldn't update the order.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="flex h-full w-full max-w-md flex-col bg-oat/40" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-oat bg-white px-4 py-3">
          <span className="font-display text-lg font-bold text-espresso">🌐 Online orders {orders.length ? `· ${orders.length}` : ""}</span>
          <button onClick={onClose} className="text-2xl leading-none text-charcoal/40 hover:text-charcoal">×</button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          {orders.length === 0 && <p className="p-8 text-center text-charcoal/40">No live online orders right now.</p>}
          {orders.map((o) => {
            const pill = STATUS_PILL[o.status] ?? { label: o.status, cls: "bg-oat text-charcoal/60" };
            const isDelivery = o.fulfillment === "DELIVERY";
            return (
              <div key={o.id} className="rounded-2xl bg-white p-4 shadow-sm">
                {/* header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-espresso">{o.number} <span className="ml-1 rounded-full bg-espresso/10 px-2 py-0.5 text-[11px] font-semibold text-espresso">Online</span></p>
                    <p className="text-xs text-charcoal/50">{isDelivery ? "🛵 Delivery" : "🥡 Pickup"}{o.pickupTime && !isDelivery ? ` · ${o.pickupTime}` : ""} · {formatTime(o.createdAt)}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${pill.cls}`}>{pill.label}</span>
                </div>

                {/* customer */}
                <p className="mt-2 text-sm font-semibold text-espresso">{o.customerName} · <a href={`tel:${o.phone}`} className="text-terracotta">{o.phone}</a></p>

                {/* items */}
                <div className="mt-2 space-y-1.5 border-y border-oat/60 py-2">
                  {o.items.map((it) => (
                    <div key={it.id} className="text-sm">
                      <div className="flex justify-between gap-2">
                        <span className="font-semibold text-espresso">{it.quantity}× {it.name}</span>
                        <span className="text-charcoal/60">{money(it.lineTotal)}</span>
                      </div>
                      {itemLine(it) && <p className="text-xs text-charcoal/60">{itemLine(it)}</p>}
                      {it.specialInstructions && <p className="text-xs font-semibold text-terracotta-dark">📝 {it.specialInstructions}</p>}
                    </div>
                  ))}
                </div>

                {/* delivery address */}
                {isDelivery && (
                  <p className="mt-2 text-xs text-charcoal/60">📍 {[o.area, o.addressLine, o.building && `Bldg ${o.building}`, o.floor && `Fl ${o.floor}`].filter(Boolean).join(", ")}{o.deliveryInstructions ? ` — ${o.deliveryInstructions}` : ""}</p>
                )}

                {/* totals + payment + loyalty */}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-sm">
                  <span className="font-bold text-espresso">Total {money(o.total)}</span>
                  <span className="text-xs text-charcoal/60">{PAY_LABEL[o.paymentMethod] ?? o.paymentMethod} · {PAY_STATUS_LABEL[o.paymentStatus] ?? o.paymentStatus}</span>
                </div>
                {(o.beansEarned > 0 || (o.loyaltyDiscount ?? 0) > 0) && (
                  <p className="text-xs text-sage-dark">{o.beansEarned > 0 ? `+${o.beansEarned} beans` : ""}{(o.loyaltyDiscount ?? 0) > 0 ? `${o.beansEarned > 0 ? " · " : ""}reward −${money(o.loyaltyDiscount)}` : ""}</p>
                )}

                {/* actions */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {nextActions(o).map((a) => (
                    <button key={a.status} disabled={busyId === o.id} onClick={() => act(o, a.status)}
                      className={`flex-1 rounded-full px-3 py-2.5 text-sm font-bold disabled:opacity-40 ${a.danger ? "border border-terracotta/40 text-terracotta-dark" : "btn-3d bg-espresso text-cream"}`}>
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---- Config modal — sizes + grouped add-ons, live price, touch-friendly -------
function ConfigModal({ line, isNew, onClose, onSave }: { line: Line; isNew: boolean; onClose: () => void; onSave: (l: Line) => void }) {
  const [options, setOptions] = useState<Sel[]>(line.options);
  const [addons, setAddons] = useState<TAddon[]>(line.addons);
  const [quantity, setQuantity] = useState(line.quantity);
  const [note, setNote] = useState(line.note);
  const [groups, setGroups] = useState<AddonGroup[]>([]);
  const [err, setErr] = useState("");
  useEffect(() => { api.get<AddonGroup[]>(`/api/addons/for/${line.item.id}`).then(setGroups).catch(() => setGroups([])); }, [line.item.id]);

  const base = line.item.price;
  const pickOption = (g: string, choice: string, priceDelta: number) => setOptions((os) => [...os.filter((o) => o.group !== g), { group: g, choice, priceDelta }]);

  const selectedIn = (g: AddonGroup) => addons.filter((a) => g.addons.some((x) => x.id === a.addonId));
  const isSel = (id: number) => addons.some((a) => a.addonId === id);

  // Pick an add-on, honouring the group's single/multiple + max rules.
  function chooseAddon(g: AddonGroup, a: Addon) {
    setErr("");
    setAddons((cur) => {
      const selected = cur.some((x) => x.addonId === a.id);
      if (g.selection === "SINGLE") {
        const withoutGroup = cur.filter((x) => !g.addons.some((y) => y.id === x.addonId));
        if (selected && g.minSelect === 0) return withoutGroup; // tap again to clear (optional)
        return [...withoutGroup, { addonId: a.id, name: a.name, price: a.price, quantity: 1 }];
      }
      if (selected) return cur.filter((x) => x.addonId !== a.id);
      if (g.maxSelect > 0 && selectedIn(g).length >= g.maxSelect) { setErr(`Choose up to ${g.maxSelect} in ${g.name}.`); return cur; }
      return [...cur, { addonId: a.id, name: a.name, price: a.price, quantity: 1 }];
    });
  }
  const setAddonQty = (a: TAddon, max: number, delta: number) =>
    setAddons((cur) => cur.map((x) => (x.addonId === a.addonId ? { ...x, quantity: Math.max(1, Math.min(max, x.quantity + delta)) } : x)));

  const preview = { ...line, options, addons, quantity };
  const unit = unitPrice(preview);
  const addonsSum = Math.round(addons.reduce((s, a) => s + a.price * a.quantity, 0) * 100) / 100;
  const sizePrice = Math.round((base + options.reduce((s, o) => s + o.priceDelta, 0)) * 100) / 100;

  function save() {
    for (const g of groups) {
      if (g.minSelect > 0 && selectedIn(g).length < g.minSelect) {
        setErr(`Please choose ${g.selection === "SINGLE" ? "an option" : `at least ${g.minSelect}`} for ${g.name}.`);
        return;
      }
    }
    onSave(preview);
  }

  const groupHint = (g: AddonGroup) =>
    g.minSelect > 0 ? "Required" : g.selection === "SINGLE" ? "Choose one" : g.maxSelect > 0 ? `Up to ${g.maxSelect}` : "Optional";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-md flex-col rounded-t-2xl bg-white sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-oat px-5 py-3.5">
          <p className="font-display text-xl font-bold text-espresso">{line.item.name}</p>
          <button onClick={onClose} className="text-2xl leading-none text-charcoal/40 hover:text-charcoal">×</button>
        </div>

        {/* Scrollable body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {/* Sizes — show the full price of each size, not a delta */}
          {line.item.options.map((g) => {
            const isSize = g.name.toLowerCase() === "size";
            return (
              <div key={g.name} className="mb-4">
                <p className="mb-2 text-sm font-bold text-espresso">{g.name}</p>
                <div className="grid grid-cols-3 gap-2">
                  {g.choices.map((c) => {
                    const active = options.find((o) => o.group === g.name)?.choice === c.label;
                    return (
                      <button key={c.label} onClick={() => pickOption(g.name, c.label, c.priceDelta)}
                        className={`rounded-xl border-2 px-2 py-2.5 text-center text-sm font-semibold transition ${active ? "border-espresso bg-espresso text-cream" : "border-oat bg-white text-espresso"}`}>
                        <span className="block">{c.label}</span>
                        <span className={`text-xs font-bold ${active ? "text-cream/90" : "text-terracotta"}`}>{isSize ? money(base + c.priceDelta) : c.priceDelta ? `+${money(c.priceDelta)}` : ""}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Add-on groups */}
          {groups.map((g) => (
            <div key={g.id} className="mb-4">
              <div className="mb-2 flex items-baseline justify-between">
                <p className="text-sm font-bold text-espresso">{g.name}</p>
                <span className={`text-[11px] font-semibold uppercase tracking-wide ${g.minSelect > 0 ? "text-terracotta" : "text-charcoal/40"}`}>{groupHint(g)}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {g.addons.map((a) => {
                  const active = isSel(a.id);
                  const picked = addons.find((x) => x.addonId === a.id);
                  return (
                    <button key={a.id} onClick={() => chooseAddon(g, a)}
                      className={`flex items-center gap-2 rounded-full border-2 px-3.5 py-2 text-sm font-semibold transition ${active ? "border-sage-dark bg-sage/20 text-sage-dark" : "border-oat bg-white text-espresso"}`}>
                      <span>{a.name}</span>
                      {a.price > 0 && <span className={active ? "text-sage-dark" : "text-terracotta"}>+{money(a.price)}</span>}
                      {active && a.maxQuantity > 1 && picked && (
                        <span className="ml-1 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <span onClick={() => setAddonQty(picked, a.maxQuantity, -1)} className="grid h-5 w-5 place-items-center rounded-full bg-white text-base font-bold text-espresso">–</span>
                          <span className="w-3 text-center">{picked.quantity}</span>
                          <span onClick={() => setAddonQty(picked, a.maxQuantity, 1)} className="grid h-5 w-5 place-items-center rounded-full bg-white text-base font-bold text-espresso">+</span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Note */}
          <label className="mt-1 block text-sm font-bold text-espresso">Note
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Extra hot, less sugar, no ice…" className="mt-1.5 w-full rounded-xl border border-oat px-3.5 py-2.5 text-sm font-normal" />
          </label>

          {err && <p className="mt-3 rounded-lg bg-terracotta/10 px-3 py-2 text-sm font-semibold text-terracotta-dark">{err}</p>}
        </div>

        {/* Footer — quantity, price breakdown, actions */}
        <div className="border-t border-oat px-5 py-3.5">
          <div className="mb-3 flex items-center gap-3">
            <span className="text-sm font-bold text-espresso">Quantity</span>
            <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="h-9 w-9 rounded-full bg-oat text-xl font-bold active:scale-95">–</button>
            <span className="w-8 text-center text-lg font-bold">{quantity}</span>
            <button onClick={() => setQuantity((q) => q + 1)} className="h-9 w-9 rounded-full bg-oat text-xl font-bold active:scale-95">+</button>
          </div>
          <div className="mb-3 space-y-0.5 text-sm">
            <div className="flex justify-between text-charcoal/60"><span>Base</span><span>{money(sizePrice)}</span></div>
            {addonsSum > 0 && <div className="flex justify-between text-charcoal/60"><span>Add-ons</span><span>+{money(addonsSum)}</span></div>}
            <div className="flex justify-between text-lg font-bold text-espresso"><span>Item total{quantity > 1 ? ` (×${quantity})` : ""}</span><span className="text-terracotta">{money(lineTotal(preview))}</span></div>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-full border border-oat px-5 py-3 font-semibold text-charcoal/60">Cancel</button>
            <button onClick={save} className="btn-3d flex-1 rounded-full bg-espresso py-3 text-base font-bold text-cream">{isNew ? `Add to order · ${money(lineTotal(preview))}` : "Save changes"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Payment modal ------------------------------------------------------------
function PayModal({ method, total, tendered, setTendered, approval, setApproval, last4, setLast4, requireApproval, busy, onCancel, onConfirm }: {
  method: PayMethod; total: number; tendered: string; setTendered: (v: string) => void;
  approval: string; setApproval: (v: string) => void; last4: string; setLast4: (v: string) => void; requireApproval: boolean;
  busy: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  const change = Math.round((Number(tendered) - total) * 100) / 100;
  const quick = [total, Math.ceil(total), Math.ceil(total / 5) * 5, Math.ceil(total / 10) * 10].filter((v, i, a) => a.indexOf(v) === i);
  const cardBlocked = method === "CARD" && requireApproval && approval.trim() === "";
  const title = method === "CASH" ? "Cash payment" : method === "WHISH" ? "Whish payment" : "Card payment";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
        <p className="font-display text-xl font-bold text-espresso">{title}</p>
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
        {method === "WHISH" && <p className="mt-4 rounded-xl bg-[#5b3fd6]/10 px-4 py-3 text-sm text-charcoal/70">Collect {money(total)} via Whish, then confirm.</p>}
        {method === "CARD" && (
          <>
            <p className="mt-4 rounded-xl bg-oat/50 px-4 py-3 text-sm text-charcoal/70">Charge {money(total)} on the card machine, then confirm.</p>
            <label className="mt-3 block text-sm font-semibold text-espresso">Approval code {requireApproval ? <span className="text-terracotta">*</span> : <span className="font-normal text-charcoal/40">(optional)</span>}
              <input autoFocus value={approval} onChange={(e) => setApproval(e.target.value)} placeholder="From the terminal receipt" className="mt-1 w-full rounded-xl border border-oat px-4 py-2.5" />
            </label>
            <label className="mt-2 block text-sm font-semibold text-espresso">Card last 4 <span className="font-normal text-charcoal/40">(optional)</span>
              <input value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="1234" className="mt-1 w-full rounded-xl border border-oat px-4 py-2.5" />
            </label>
          </>
        )}
        <div className="mt-5 flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-full border border-oat py-2.5 font-semibold text-charcoal/60">Cancel</button>
          <button onClick={onConfirm} disabled={busy || cardBlocked || (method === "CASH" && (tendered === "" || change < 0))} className="btn-3d flex-1 rounded-full bg-espresso py-2.5 font-semibold text-cream disabled:opacity-50">{busy ? "Saving…" : "Complete sale"}</button>
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
        <p className="text-sm text-charcoal/50">Paid by {order.paymentMethod === "CARD" ? "card" : order.paymentMethod === "WHISH" ? "Whish" : "cash"}{order.beansEarned ? ` · ${order.beansEarned} beans earned` : ""}</p>
        {order.number !== "SAVED OFFLINE" && <p className="mt-2 inline-block rounded-full bg-sage/15 px-3 py-1 text-xs font-semibold text-sage-dark">🍳 Sent to kitchen</p>}
        <div className="mt-5 flex gap-2">
          <button onClick={printReceipt} className="flex-1 rounded-full border border-oat py-2.5 font-semibold text-espresso hover:bg-oat">🖨 Print receipt</button>
          <button onClick={onNew} className="btn-3d flex-1 rounded-full bg-espresso py-2.5 font-semibold text-cream">New sale</button>
        </div>
      </div>
    </div>
  );
}
