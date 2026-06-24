import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { AddressFields, AddressFormValue, emptyAddress } from "../components/AddressFields";
import { BirthdayRewardCard } from "../components/BirthdayReward";
import { ItemExtras } from "../components/ItemExtras";
import { LinkMethod } from "../components/LinkMethod";
import { OrderStatusTimeline } from "../components/OrderStatusTimeline";
import { useCart } from "../context/CartContext";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { useToast } from "../context/ToastContext";
import { customerApi, formatDateTime, money } from "../lib/api";
import { isTerminal, normalizeStatus, paymentStatusMeta, statusMeta } from "../lib/orderStatus";
import type { MenuItem, Order, SavedAddress } from "../types";

const TABS = [
  { key: "account", label: "My Account" },
  { key: "orders", label: "My Orders" },
  { key: "addresses", label: "Addresses" },
  { key: "recent", label: "Recently Ordered" },
  { key: "rewards", label: "My Rewards" },
  { key: "bookings", label: "My Bookings" },
] as const;

const BOOKING_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Pending", cls: "bg-oat text-charcoal/70" },
  CONFIRMED: { label: "Confirmed", cls: "bg-sage/20 text-sage-dark" },
  IN_USE: { label: "In use", cls: "bg-sage/25 text-sage-dark" },
  COMPLETED: { label: "Completed", cls: "bg-espresso/10 text-espresso" },
  CANCELLED: { label: "Cancelled", cls: "bg-terracotta/15 text-terracotta-dark" },
  NO_SHOW: { label: "No-show", cls: "bg-terracotta/15 text-terracotta-dark" },
};

export function Account() {
  const { account, loading, updateProfile, logout, refresh } = useCustomerAuth();
  const { add } = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "account";
  const setTab = (t: string) => setParams(t === "account" ? {} : { tab: t });

  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [name, setName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [saving, setSaving] = useState(false);

  // Pull a fresh copy (orders/bookings) when the page opens, and load the menu for reorder.
  useEffect(() => {
    refresh().catch(() => {});
    customerApi.get<MenuItem[]>("/api/menu").then(setMenu).catch(() => {});
  }, [refresh]);

  async function cancelOrder(order: Order) {
    if (!confirm(`Cancel order ${order.number}?`)) return;
    try {
      await customerApi.post(`/api/orders/${order.number}/cancel`, {});
      await refresh();
      toast("Order cancelled.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't cancel the order.", "error");
    }
  }

  useEffect(() => {
    if (account) {
      setName(account.name);
      setBirthday(account.birthday ? account.birthday.slice(0, 10) : "");
    }
  }, [account]);

  if (loading) {
    return <p className="mx-auto max-w-5xl px-4 py-16 text-charcoal/60">Loading your account…</p>;
  }
  if (!account) return <Navigate to="/loyalty" replace />;

  const birthdayLocked = !!account?.birthday;

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      // Birthday is set-once; only send it the first time so a locked one is never touched.
      await updateProfile({ name, birthday: birthdayLocked ? undefined : birthday || undefined });
      toast("Profile updated.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save.", "error");
    } finally {
      setSaving(false);
    }
  }

  function reorder(order: Order) {
    let added = 0;
    let missing = 0;
    for (const it of order.items) {
      const item = menu.find((m) => m.id === it.menuItemId);
      if (item && item.inStock) {
        const addons = (it.addons ?? [])
          .filter((a) => a.addonId != null)
          .map((a) => ({ addonId: a.addonId!, name: a.name, price: a.price, quantity: a.quantity }));
        add(item, it.quantity, it.selectedOptions, addons, it.specialInstructions ?? "");
        added += it.quantity;
      } else {
        missing += 1;
      }
    }
    if (added === 0) {
      toast("Those items aren't available to reorder right now.", "error");
      return;
    }
    toast(missing ? `Added to cart — ${missing} item(s) were unavailable.` : "Added to your cart 🛒");
    navigate("/cart");
  }

  const orders = account.orders ?? [];
  const bookings = account.bookings ?? [];
  const transactions = account.transactions ?? [];
  const redemptions = account.redemptions ?? [];

  function OrderCard({ order }: { order: Order }) {
    const meta = statusMeta(order.status);
    const status = normalizeStatus(order.status);
    const canReorder = order.items.some((it) => menu.find((m) => m.id === it.menuItemId)?.inStock);
    const isActive = !isTerminal(order.status);
    const canCancel = ["AWAITING_PAYMENT", "RECEIVED"].includes(status) && order.paymentStatus !== "REFUNDED";
    return (
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-display font-bold text-espresso">
              {order.fulfillment === "DELIVERY" ? "🛵" : "🏪"} {order.number}
            </p>
            <p className="text-xs text-charcoal/50">{formatDateTime(order.createdAt)}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${meta.badge}`}>{meta.label}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${paymentStatusMeta(order.paymentStatus).badge}`}>
              {paymentStatusMeta(order.paymentStatus).label}
            </span>
          </div>
        </div>

        {/* status progress */}
        <div className="mt-3 rounded-xl bg-oat/30 p-3">
          <OrderStatusTimeline status={order.status} fulfillment={order.fulfillment} compact />
        </div>

        {order.fulfillment === "DELIVERY" && order.area && (
          <p className="mt-2 text-xs text-charcoal/60">📍 {[order.building, order.area].filter(Boolean).join(", ")}</p>
        )}

        <ul className="mt-3 space-y-1.5 text-sm">
          {order.items.map((it) => (
            <li key={it.id} className="flex justify-between gap-2">
              <span>
                {it.quantity}× {it.name}
                <ItemExtras options={it.selectedOptions} addons={it.addons} instructions={it.specialInstructions} />
              </span>
              <span className="font-medium">{money(it.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-oat pt-3">
          <div className="text-sm">
            <span className="font-bold text-espresso">Total {money(order.total)}</span>
            {order.beansEarned > 0 && <span className="ml-2 text-sage-dark">· 🫘 +{order.beansEarned} beans</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            {canCancel && (
              <button
                onClick={() => cancelOrder(order)}
                className="rounded-full border border-terracotta/40 px-4 py-2 text-sm font-semibold text-terracotta-dark transition hover:bg-terracotta hover:text-cream"
              >
                Cancel
              </button>
            )}
            {isActive && (
              <Link
                to={`/order-success/${order.number}`}
                className="rounded-full border border-oat px-5 py-2 text-sm font-semibold text-espresso transition hover:bg-oat"
              >
                Track order
              </Link>
            )}
            <button
              onClick={() => reorder(order)}
              disabled={!canReorder}
              className="btn-3d rounded-full bg-terracotta px-5 py-2 text-sm font-semibold text-cream transition hover:bg-terracotta-dark disabled:cursor-not-allowed disabled:bg-oat disabled:text-charcoal/40"
            >
              Reorder
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-espresso">My Account</h1>
          <p className="text-sm text-charcoal/60">
            {account.name || "Welcome"}
            {(account.phone || account.email) && ` · ${account.phone || account.email}`}
          </p>
        </div>
        <button
          onClick={() => {
            logout();
            toast("Logged out.");
            navigate("/");
          }}
          className="rounded-full border border-oat bg-white px-5 py-2 text-sm font-semibold text-terracotta-dark transition hover:bg-terracotta hover:text-cream"
        >
          Log out
        </button>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
              tab === t.key ? "bg-espresso text-cream" : "bg-oat text-espresso hover:bg-oat/70"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {/* MY ACCOUNT */}
        {tab === "account" && (
          <div className="space-y-6">
            <BirthdayRewardCard actionableOnly />
            <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl bg-espresso p-6 text-cream shadow-md">
              <p className="text-sm text-oat">Beans balance</p>
              <p className="mt-1 font-display text-5xl font-bold">{account.beanBalance}</p>
              <p className="mt-1 text-xs text-oat/80">{account.lifetimeBeans} earned all-time</p>
              <span className="mt-3 inline-block rounded-full bg-sage px-4 py-1 text-sm font-bold text-cream">
                {account.tier}
              </span>
              <button
                onClick={() => navigate("/loyalty")}
                className="btn-3d mt-5 block w-full rounded-full bg-terracotta px-6 py-2.5 font-semibold text-cream"
              >
                Redeem rewards
              </button>
            </div>

            <div className="space-y-4">
              <form onSubmit={saveProfile} className="rounded-2xl bg-white p-6 shadow-sm">
                <h2 className="font-display text-xl font-bold text-espresso">Account details</h2>
                {account.needsProfile && (
                  <p className="mt-2 rounded-lg bg-oat/60 px-3 py-2 text-xs text-charcoal/70">
                    Welcome! Add your name to complete your profile.
                  </p>
                )}
                <label className="mt-4 block text-sm font-semibold text-espresso">
                  Full name
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="mt-1 w-full rounded-xl border border-oat px-4 py-2.5 font-normal"
                  />
                </label>
                <div className="mt-3">
                  <label className="block text-sm font-semibold text-espresso" htmlFor="birthday">
                    Date of birth <span className="font-normal text-charcoal/50">(optional)</span>
                  </label>
                  <input
                    id="birthday"
                    type="date"
                    value={birthday}
                    disabled={birthdayLocked}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setBirthday(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-oat px-4 py-2.5 font-normal disabled:cursor-not-allowed disabled:bg-oat/40 disabled:text-charcoal/60"
                  />
                  {birthdayLocked ? (
                    <p className="mt-1.5 text-xs text-charcoal/50">
                      🔒 Your birthday is saved and locked. To change it, contact Bean Avenue support.
                    </p>
                  ) : (
                    <p className="mt-1.5 text-xs text-charcoal/50">
                      We use your birthday only to provide your birthday reward and related account
                      benefits. Once saved it can't be changed without contacting support.
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-3d mt-5 w-full rounded-full bg-espresso px-6 py-2.5 font-semibold text-cream disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </form>

              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <h2 className="font-display text-xl font-bold text-espresso">Login methods</h2>
                <p className="mt-1 text-sm text-charcoal/60">
                  Add and verify another way to sign in. Either method opens this same account.
                </p>
                <div className="mt-3 space-y-3">
                  <LinkMethod channel="phone" />
                  <LinkMethod channel="email" />
                </div>
              </div>
            </div>
            </div>
          </div>
        )}

        {/* MY ORDERS */}
        {tab === "orders" && (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <EmptyState text="You haven't placed any orders yet." cta="Browse the menu" to="/menu" navigate={navigate} />
            ) : (
              orders.map((o) => <OrderCard key={o.id} order={o} />)
            )}
          </div>
        )}

        {/* ADDRESSES */}
        {tab === "addresses" && <AddressesTab addresses={account.addresses ?? []} onChange={() => refresh()} />}

        {/* RECENTLY ORDERED */}
        {tab === "recent" && (
          <div className="space-y-4">
            <p className="text-sm text-charcoal/60">Your latest orders — tap Reorder to add them straight back to your cart.</p>
            {orders.length === 0 ? (
              <EmptyState text="Nothing here yet — your recent orders will show up here." cta="Order now" to="/menu" navigate={navigate} />
            ) : (
              orders.slice(0, 5).map((o) => <OrderCard key={o.id} order={o} />)
            )}
          </div>
        )}

        {/* MY REWARDS */}
        {tab === "rewards" && (
          <div className="space-y-6">
            <section>
              <h2 className="font-display text-xl font-bold text-espresso">Birthday reward</h2>
              <div className="mt-3">
                <BirthdayRewardCard />
              </div>
            </section>
            <div className="grid gap-6 lg:grid-cols-2">
            <section>
              <h2 className="font-display text-xl font-bold text-espresso">Redeemed rewards</h2>
              {redemptions.length === 0 ? (
                <p className="mt-3 rounded-2xl bg-white p-6 text-sm text-charcoal/60 shadow-sm">
                  No rewards redeemed yet. Head to the rewards page to spend your beans.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {redemptions.map((r) => (
                    <li key={r.id} className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm">
                      <div>
                        <p className="font-semibold text-espresso">{r.rewardName}</p>
                        <p className="text-xs text-charcoal/50">
                          {r.cost} beans · {formatDateTime(r.createdAt)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
                          r.status === "ACTIVE"
                            ? "bg-sage/20 text-sage-dark"
                            : r.status === "CLAIMED"
                              ? "bg-oat text-charcoal/60"
                              : "bg-terracotta/15 text-terracotta-dark"
                        }`}
                      >
                        {r.status === "ACTIVE" ? r.code : r.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="font-display text-xl font-bold text-espresso">Points history</h2>
              {transactions.length === 0 ? (
                <p className="mt-3 rounded-2xl bg-white p-6 text-sm text-charcoal/60 shadow-sm">
                  No points activity yet.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-oat rounded-2xl bg-white shadow-sm">
                  {transactions.map((t) => (
                    <li key={t.id} className="flex items-center justify-between px-4 py-3 text-sm">
                      <span>
                        {t.note ?? (t.type === "EARN" ? `Earned on ${t.refId ?? t.source}` : t.source)}
                        <span className="block text-xs text-charcoal/50">
                          {formatDateTime(t.createdAt)} · balance {t.balanceAfter}
                        </span>
                      </span>
                      <span className={`font-bold ${t.amount > 0 ? "text-sage-dark" : "text-terracotta-dark"}`}>
                        {t.amount > 0 ? "+" : ""}
                        {t.amount}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            </div>
          </div>
        )}

        {/* MY BOOKINGS */}
        {tab === "bookings" && (
          <div className="space-y-4">
            {bookings.length === 0 ? (
              <EmptyState text="No room bookings yet." cta="Book a room" to="/book" navigate={navigate} />
            ) : (
              bookings.map((b) => {
                const status = BOOKING_STATUS[b.status] ?? { label: b.status, cls: "bg-oat" };
                return (
                  <div key={b.id} className="rounded-2xl bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-display font-bold text-espresso">
                          {b.room?.name ?? "Room"} · {b.number}
                        </p>
                        <p className="text-xs text-charcoal/50">
                          {formatDateTime(b.startTime)} – {formatDateTime(b.endTime)}
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${status.cls}`}>
                        {status.label}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-oat pt-3 text-sm">
                      <span className="text-charcoal/70">
                        {b.durationHours}h · {b.peopleCount} {b.peopleCount === 1 ? "person" : "people"}
                      </span>
                      <span className="font-bold text-espresso">{money(b.total)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AddressesTab({ addresses, onChange }: { addresses: SavedAddress[]; onChange: () => void }) {
  const toast = useToast();
  const [editing, setEditing] = useState<AddressFormValue | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  function startNew() {
    setEditingId(null);
    setEditing(emptyAddress());
  }
  function startEdit(a: SavedAddress) {
    setEditingId(a.id);
    setEditing({
      label: a.label, fullName: a.fullName, phone: a.phone, addressLine: a.addressLine,
      building: a.building, floor: a.floor, apartment: a.apartment, area: a.area,
      landmark: a.landmark, instructions: a.instructions, lat: a.lat, lng: a.lng,
    });
  }

  async function save() {
    if (!editing) return;
    if (!editing.fullName.trim() || !editing.phone.trim() || !editing.area.trim()) {
      return toast("Name, phone and area are required.", "error");
    }
    setSaving(true);
    try {
      if (editingId) await customerApi.patch(`/api/addresses/${editingId}`, editing);
      else await customerApi.post("/api/addresses", editing);
      setEditing(null);
      setEditingId(null);
      onChange();
      toast("Address saved.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(a: SavedAddress) {
    if (!confirm(`Delete the "${a.label}" address?`)) return;
    try {
      await customerApi.delete(`/api/addresses/${a.id}`);
      onChange();
      toast("Address deleted.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't delete.", "error");
    }
  }

  async function makeDefault(a: SavedAddress) {
    try {
      await customerApi.patch(`/api/addresses/${a.id}`, { isDefault: true });
      onChange();
    } catch {
      /* ignore */
    }
  }

  if (editing) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="font-display text-xl font-bold text-espresso">{editingId ? "Edit address" : "New address"}</h2>
        <div className="mt-4">
          <AddressFields value={editing} onChange={setEditing} />
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={save} disabled={saving} className="btn-3d rounded-full bg-terracotta px-6 py-2.5 font-semibold text-cream disabled:opacity-60">
            {saving ? "Saving…" : "Save address"}
          </button>
          <button onClick={() => { setEditing(null); setEditingId(null); }} className="rounded-full border border-oat px-6 py-2.5 font-semibold text-espresso">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-charcoal/60">Saved delivery addresses for faster checkout.</p>
        <button onClick={startNew} className="btn-3d rounded-full bg-espresso px-5 py-2 text-sm font-semibold text-cream">+ Add address</button>
      </div>
      {addresses.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center text-charcoal/60 shadow-sm">No saved addresses yet.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {addresses.map((a) => (
            <div key={a.id} className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-espresso">{a.label}</span>
                {a.isDefault ? (
                  <span className="rounded-full bg-sage/20 px-2.5 py-0.5 text-xs font-semibold text-sage-dark">Default</span>
                ) : (
                  <button onClick={() => makeDefault(a)} className="text-xs font-semibold text-terracotta hover:underline">Make default</button>
                )}
              </div>
              <p className="mt-2 text-sm text-charcoal/80">{a.fullName} · {a.phone}</p>
              <p className="text-sm text-charcoal/60">
                {[a.building, a.addressLine, a.apartment && `Apt ${a.apartment}`, a.area].filter(Boolean).join(", ")}
              </p>
              {a.landmark && <p className="text-xs text-charcoal/50">Near {a.landmark}</p>}
              <div className="mt-3 flex gap-2">
                <button onClick={() => startEdit(a)} className="rounded-full border border-oat px-4 py-1.5 text-sm font-semibold text-espresso hover:bg-oat">Edit</button>
                <button onClick={() => remove(a)} className="rounded-full border border-terracotta/40 px-4 py-1.5 text-sm font-semibold text-terracotta-dark hover:bg-terracotta hover:text-cream">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({
  text,
  cta,
  to,
  navigate,
}: {
  text: string;
  cta: string;
  to: string;
  navigate: (to: string) => void;
}) {
  return (
    <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
      <p className="text-charcoal/60">{text}</p>
      <button
        onClick={() => navigate(to)}
        className="btn-3d mt-4 rounded-full bg-terracotta px-6 py-2.5 font-semibold text-cream"
      >
        {cta}
      </button>
    </div>
  );
}
