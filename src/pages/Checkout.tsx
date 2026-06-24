import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AddressFields, AddressFormValue, emptyAddress } from "../components/AddressFields";
import { ItemExtras } from "../components/ItemExtras";
import { PaymentModal } from "../components/PaymentModal";
import { PhoneInput } from "../components/PhoneInput";
import { useCart } from "../context/CartContext";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { useToast } from "../context/ToastContext";
import { customerApi, money } from "../lib/api";
import { PAYMENT_METHOD_LABEL } from "../lib/orderStatus";
import { PROMOS } from "../lib/promos";
import type { DeliveryQuote, Fulfillment, Order, PaymentMethod, SavedAddress, StorefrontConfig } from "../types";

const PAYMENT_ICON: Record<string, string> = {
  ONLINE: "💳",
  CASH_ON_DELIVERY: "💵",
  CASH_AT_PICKUP: "💵",
};

export function Checkout() {
  const { lines, subtotal, clear } = useCart();
  const { account, refresh } = useCustomerAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const toast = useToast();

  const [config, setConfig] = useState<StorefrontConfig | null>(null);
  const [fulfillment, setFulfillment] = useState<Fulfillment>(location.state?.fulfillment === "DELIVERY" ? "DELIVERY" : "PICKUP");
  const [name, setName] = useState(account?.name ?? "");
  const [phone, setPhone] = useState(account?.phone ?? "");
  const [email, setEmail] = useState(account?.email ?? "");
  const [promoCode, setPromoCode] = useState<string>(location.state?.promoCode ?? "");
  const [pickupTime, setPickupTime] = useState("ASAP");
  const [payment, setPayment] = useState<PaymentMethod | "">("");
  const [redemptionCode, setRedemptionCode] = useState<string>(location.state?.redemptionCode ?? "");

  const [address, setAddress] = useState<AddressFormValue>(emptyAddress());
  const [selectedAddressId, setSelectedAddressId] = useState<number | "new">("new");
  const [saveAddress, setSaveAddress] = useState(false);

  const [quote, setQuote] = useState<DeliveryQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof AddressFormValue, string>>>({});
  const [payOrder, setPayOrder] = useState<Order | null>(null);

  const savedAddresses: SavedAddress[] = account?.addresses ?? [];

  // Load storefront config (delivery availability, payment methods, tax, etc.).
  useEffect(() => {
    customerApi.get<StorefrontConfig>("/api/delivery/config").then(setConfig).catch(() => {});
  }, []);

  // Prefill contact details from the account once it loads.
  useEffect(() => {
    if (account) {
      setName((n) => n || account.name || "");
      setPhone((p) => p || account.phone || "");
      setEmail((e) => e || account.email || "");
    }
  }, [account]);

  // Default to the saved default address when switching to delivery.
  useEffect(() => {
    if (fulfillment === "DELIVERY" && savedAddresses.length && selectedAddressId === "new" && !address.area) {
      const def = savedAddresses.find((a) => a.isDefault) ?? savedAddresses[0];
      applySavedAddress(def);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fulfillment, account]);

  // Available payment methods for the chosen fulfillment.
  const paymentOptions = useMemo<PaymentMethod[]>(() => {
    if (!config) return [];
    const opts: PaymentMethod[] = [];
    if (config.payment.online) opts.push("ONLINE");
    if (fulfillment === "DELIVERY" && config.payment.cashOnDelivery) opts.push("CASH_ON_DELIVERY");
    if (fulfillment === "PICKUP" && config.payment.cashAtPickup) opts.push("CASH_AT_PICKUP");
    return opts;
  }, [config, fulfillment]);

  useEffect(() => {
    if (paymentOptions.length && !paymentOptions.includes(payment as PaymentMethod)) setPayment(paymentOptions[0]);
  }, [paymentOptions, payment]);

  // ---- Live delivery quote (debounced) ----
  const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (fulfillment !== "DELIVERY") {
      setQuote(null);
      return;
    }
    if (!address.area.trim() && address.lat == null) {
      setQuote(null);
      return;
    }
    if (quoteTimer.current) clearTimeout(quoteTimer.current);
    setQuoting(true);
    quoteTimer.current = setTimeout(async () => {
      try {
        const q = await customerApi.post<DeliveryQuote>("/api/delivery/quote", {
          area: address.area,
          lat: address.lat,
          lng: address.lng,
          subtotal,
        });
        setQuote(q);
      } catch {
        setQuote(null);
      } finally {
        setQuoting(false);
      }
    }, 450);
    return () => {
      if (quoteTimer.current) clearTimeout(quoteTimer.current);
    };
  }, [fulfillment, address.area, address.lat, address.lng, subtotal]);

  function applySavedAddress(a: SavedAddress) {
    setSelectedAddressId(a.id);
    setAddress({
      label: a.label,
      fullName: a.fullName,
      phone: a.phone,
      addressLine: a.addressLine,
      building: a.building,
      floor: a.floor,
      apartment: a.apartment,
      area: a.area,
      landmark: a.landmark,
      instructions: a.instructions,
      lat: a.lat,
      lng: a.lng,
    });
    if (a.fullName) setName((n) => n || a.fullName);
    if (a.phone) setPhone((p) => p || a.phone);
  }

  // ---- Order summary estimate (server is authoritative on the final total) ----
  const summary = useMemo(() => {
    const addonsTotal = lines.reduce(
      (s, l) => s + l.addons.reduce((a, x) => a + x.price * x.quantity, 0) * l.quantity,
      0
    );
    const itemsSubtotal = subtotal - addonsTotal;
    const rate = PROMOS[promoCode.trim().toUpperCase()] ?? 0;
    const discount = Math.round(subtotal * rate * 100) / 100;
    const deliveryFee = fulfillment === "DELIVERY" && quote?.available ? quote.fee : 0;
    const taxRate = config?.tax.rate ?? 0;
    const tax = Math.round(Math.max(0, subtotal - discount + deliveryFee) * (taxRate / 100) * 100) / 100;
    const total = Math.round((subtotal - discount + deliveryFee + tax) * 100) / 100;
    return { addonsTotal, itemsSubtotal, discount, deliveryFee, tax, total, taxRate };
  }, [lines, subtotal, promoCode, fulfillment, quote, config]);

  const beansToEarn = Math.floor(Math.max(0, subtotal - summary.discount));

  // Handle a retry link (/checkout?retry=ORD-XXX) from a failed payment.
  useEffect(() => {
    const retry = searchParams.get("retry");
    if (!retry) return;
    customerApi
      .get<Order>(`/api/orders/track/${retry}`)
      .then((o) => {
        if (o.paymentMethod === "ONLINE" && o.paymentStatus !== "PAID" && o.status !== "CANCELLED") setPayOrder(o);
      })
      .catch(() => {});
  }, [searchParams]);

  if (lines.length === 0 && !payOrder) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <p className="text-charcoal/70">Your cart's feeling light. Add something tasty.</p>
        <Link to="/menu" className="mt-4 inline-block font-semibold text-terracotta hover:underline">
          ← Back to the menu
        </Link>
      </div>
    );
  }

  const deliveryBlocked =
    fulfillment === "DELIVERY" && (!quote || !quote.available || quote.belowMinimum);

  function validate(): boolean {
    const errs: Partial<Record<keyof AddressFormValue, string>> = {};
    if (fulfillment === "DELIVERY") {
      if (!address.fullName.trim()) errs.fullName = "Required";
      if (!address.phone.trim()) errs.phone = "Required";
      if (!address.area.trim()) errs.area = "Required";
      if (!address.addressLine.trim() && !address.building.trim()) errs.addressLine = "Enter your address";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!name.trim()) return toast("Please enter your name.", "error");
    if (fulfillment === "PICKUP" && !phone.trim()) return toast("Please enter a phone number.", "error");
    if (!validate()) return toast("Please complete the delivery details.", "error");

    setSubmitting(true);
    try {
      const order = await customerApi.post<Order>("/api/orders", {
        customerName: fulfillment === "DELIVERY" ? address.fullName || name : name,
        phone: fulfillment === "DELIVERY" ? address.phone || phone : phone,
        email,
        fulfillment,
        pickupTime: fulfillment === "PICKUP" ? pickupTime : undefined,
        promoCode: promoCode.trim() || undefined,
        loyaltyRedemptionCode: redemptionCode || undefined,
        paymentMethod: payment,
        items: lines.map((l) => ({
          menuItemId: l.menuItemId,
          quantity: l.quantity,
          selectedOptions: l.selectedOptions.map((o) => ({ group: o.group, choice: o.choice })),
          addons: l.addons.map((a) => ({ addonId: a.addonId, quantity: a.quantity })),
          specialInstructions: l.specialInstructions || undefined,
        })),
        delivery:
          fulfillment === "DELIVERY"
            ? {
                name: address.fullName,
                phone: address.phone,
                label: address.label,
                addressLine: address.addressLine,
                building: address.building,
                floor: address.floor,
                apartment: address.apartment,
                area: address.area,
                landmark: address.landmark,
                instructions: address.instructions,
                lat: address.lat,
                lng: address.lng,
              }
            : undefined,
      });

      // Optionally save a new address to the account.
      if (fulfillment === "DELIVERY" && saveAddress && account && selectedAddressId === "new") {
        customerApi.post("/api/addresses", { ...address }).then(() => refresh()).catch(() => {});
      }

      if (payment === "ONLINE") {
        // Don't clear the cart until payment succeeds (so a failed payment is recoverable).
        setPayOrder(order);
      } else {
        clear();
        if (account) refresh().catch(() => {});
        navigate(`/order-success/${order.number}`, { state: { order } });
      }
    } catch (err) {
      const e2 = err as { message?: string };
      toast(e2.message ?? "Something went wrong.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  function onPaid(order: Order) {
    clear();
    if (account) refresh().catch(() => {});
    setPayOrder(null);
    navigate(`/order-success/${order.number}`, { state: { order } });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-10">
      <h1 className="font-display text-3xl font-bold text-espresso">Checkout</h1>

      {/* Fulfillment toggle */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        {(["PICKUP", "DELIVERY"] as Fulfillment[]).map((f) => {
          const disabled = f === "DELIVERY" ? !config?.delivery.available : !config?.pickup.enabled;
          return (
            <button
              key={f}
              type="button"
              disabled={disabled}
              onClick={() => setFulfillment(f)}
              className={`rounded-2xl border-2 p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                fulfillment === f ? "border-terracotta bg-terracotta/5" : "border-oat bg-white hover:border-sage"
              }`}
            >
              <span className="text-2xl">{f === "PICKUP" ? "🏪" : "🛵"}</span>
              <p className="mt-1 font-display font-bold text-espresso">{f === "PICKUP" ? "Pickup" : "Delivery"}</p>
              <p className="text-xs text-charcoal/60">
                {f === "PICKUP"
                  ? config?.pickup.enabled ? "Collect from Bean Avenue" : "Unavailable"
                  : config?.delivery.available ? "To your address" : config?.delivery.paused ? "Paused — too busy" : "Currently unavailable"}
              </p>
            </button>
          );
        })}
      </div>

      {account ? (
        <div className="mt-4 rounded-xl bg-sage/15 px-4 py-3 text-sm text-espresso">
          ☕ Logged in as <span className="font-semibold">{account.name}</span> · you'll earn{" "}
          <span className="font-semibold">{beansToEarn} beans</span> once this order is {payment === "ONLINE" ? "paid" : "completed"}.
        </div>
      ) : (
        <div className="mt-4 rounded-xl bg-oat/60 px-4 py-3 text-sm text-charcoal/80">
          🫘 <Link to="/loyalty" className="font-semibold text-terracotta hover:underline">Log in or create an account</Link>{" "}
          to earn beans and save addresses — or order as a guest below.
        </div>
      )}

      <div className="mt-6 grid gap-8 md:grid-cols-5">
        <form onSubmit={handleSubmit} className="space-y-5 md:col-span-3">
          {/* Contact (pickup uses these; delivery uses the address recipient) */}
          {fulfillment === "PICKUP" && (
            <section className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-espresso" htmlFor="name">Name</label>
                <input id="name" required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl border border-oat bg-white px-4 py-2.5" autoComplete="name" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-espresso" htmlFor="phone">Phone</label>
                <div className="mt-1">
                  <PhoneInput id="phone" required value={phone} onChange={setPhone} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-espresso" htmlFor="email">Email <span className="font-normal text-charcoal/50">(optional)</span></label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-oat bg-white px-4 py-2.5" autoComplete="email" />
              </div>
            </section>
          )}

          {/* Pickup options */}
          {fulfillment === "PICKUP" && config && (
            <section className="rounded-2xl border border-oat bg-white p-4">
              <p className="font-display font-bold text-espresso">🏪 Pickup details</p>
              <p className="mt-1 text-sm text-charcoal/70">{config.pickup.location}</p>
              <p className="mt-1 text-xs text-charcoal/50">Typical prep time: {config.pickup.prepTime}</p>
              <div className="mt-3">
                <label className="block text-sm font-semibold text-espresso" htmlFor="pickup">When</label>
                <select id="pickup" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} className="mt-1 w-full rounded-xl border border-oat bg-white px-4 py-2.5">
                  <option value="ASAP">As soon as possible</option>
                  {config.pickup.scheduleEnabled && (
                    <>
                      <option>In 30 minutes</option>
                      <option>In 1 hour</option>
                      <option>In 2 hours</option>
                    </>
                  )}
                </select>
              </div>
            </section>
          )}

          {/* Delivery address */}
          {fulfillment === "DELIVERY" && (
            <section className="space-y-3">
              {savedAddresses.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-espresso">Deliver to</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {savedAddresses.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => applySavedAddress(a)}
                        className={`rounded-xl border px-3 py-2 text-left text-xs transition ${
                          selectedAddressId === a.id ? "border-terracotta bg-terracotta/5" : "border-oat bg-white hover:border-sage"
                        }`}
                      >
                        <span className="font-semibold text-espresso">{a.label}</span>
                        <span className="block text-charcoal/60">{a.area}{a.building ? ` · ${a.building}` : ""}</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAddressId("new");
                        setAddress(emptyAddress({ fullName: name, phone }));
                      }}
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                        selectedAddressId === "new" ? "border-terracotta bg-terracotta/5 text-espresso" : "border-dashed border-oat bg-white text-charcoal/70 hover:border-sage"
                      }`}
                    >
                      + New address
                    </button>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-oat bg-white p-4">
                <AddressFields value={address} onChange={setAddress} showLabel={selectedAddressId === "new"} errors={errors} />
              </div>

              {account && selectedAddressId === "new" && (
                <label className="flex items-center gap-2 text-sm text-charcoal/70">
                  <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} className="h-4 w-4 rounded border-oat" />
                  Save this address to my account
                </label>
              )}

              {/* Delivery availability feedback */}
              {quoting && <p className="text-sm text-charcoal/50">Checking delivery availability…</p>}
              {!quoting && quote && !quote.available && (
                <div className="rounded-xl bg-terracotta/10 p-3 text-sm font-medium text-terracotta-dark">
                  🚫 {quote.reason}
                </div>
              )}
              {!quoting && quote?.available && quote.belowMinimum && (
                <div className="rounded-xl bg-amber-100 p-3 text-sm font-medium text-amber-700">
                  This area has a minimum order of {money(quote.minOrder)}. Add {money(Math.max(0, quote.minOrder - subtotal))} more, or switch to pickup.
                </div>
              )}
              {!quoting && quote?.available && !quote.belowMinimum && (
                <div className="rounded-xl bg-sage/15 p-3 text-sm text-sage-dark">
                  ✅ We deliver to <span className="font-semibold">{quote.zone?.name}</span> · {quote.zone?.estimatedTime}
                  {" · "}{quote.fee === 0 ? (quote.freeApplied ? "Free delivery!" : "Free") : `${money(quote.fee)} delivery`}
                </div>
              )}
            </section>
          )}

          {/* Loyalty reward voucher */}
          {account && (account.redemptions ?? []).some((r) => r.status === "ACTIVE") && (
            <section>
              <label className="block text-sm font-semibold text-espresso" htmlFor="reward">Apply a reward voucher <span className="font-normal text-charcoal/50">(optional)</span></label>
              <select id="reward" value={redemptionCode} onChange={(e) => setRedemptionCode(e.target.value)} className="mt-1 w-full rounded-xl border border-oat bg-white px-4 py-2.5 text-sm">
                <option value="">No reward</option>
                {(account.redemptions ?? []).filter((r) => r.status === "ACTIVE").map((r) => (
                  <option key={r.id} value={r.code}>{r.rewardName} ({r.code})</option>
                ))}
              </select>
            </section>
          )}

          {/* Promo code */}
          <section>
            <label className="block text-sm font-semibold text-espresso" htmlFor="promo">Promo code <span className="font-normal text-charcoal/50">(optional)</span></label>
            <input id="promo" value={promoCode} onChange={(e) => setPromoCode(e.target.value)} placeholder="e.g. WELCOME" className="mt-1 w-full rounded-xl border border-oat bg-white px-4 py-2.5 text-sm" />
          </section>

          {/* Payment method */}
          <section>
            <p className="text-sm font-semibold text-espresso">Payment method</p>
            <div className="mt-2 space-y-2">
              {paymentOptions.length === 0 && <p className="text-sm text-charcoal/50">No payment methods available right now.</p>}
              {paymentOptions.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPayment(m)}
                  className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition ${
                    payment === m ? "border-terracotta bg-terracotta/5" : "border-oat bg-white hover:border-sage"
                  }`}
                >
                  <span className="text-xl">{PAYMENT_ICON[m]}</span>
                  <span className="font-semibold text-espresso">{PAYMENT_METHOD_LABEL[m]}</span>
                  {m === "ONLINE" && <span className="ml-auto rounded-full bg-sage/20 px-2 py-0.5 text-xs font-semibold text-sage-dark">Secure</span>}
                </button>
              ))}
            </div>
          </section>

          <button
            type="submit"
            disabled={submitting || deliveryBlocked || paymentOptions.length === 0}
            className="btn-3d w-full rounded-full bg-terracotta px-6 py-3.5 text-base font-semibold text-cream disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Placing your order…" : payment === "ONLINE" ? `Pay & place order · ${money(summary.total)}` : `Place order · ${money(summary.total)}`}
          </button>
          {deliveryBlocked && fulfillment === "DELIVERY" && (
            <p className="text-center text-xs text-charcoal/50">Enter a deliverable address (or switch to pickup) to continue.</p>
          )}
        </form>

        {/* Order summary */}
        <aside className="md:col-span-2">
          <div className="sticky top-24 rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="font-display text-lg font-bold text-espresso">Order summary</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {lines.map((l) => (
                <li key={l.key} className="flex justify-between gap-2">
                  <span>
                    {l.quantity}× {l.name}
                    <ItemExtras options={l.selectedOptions} addons={l.addons} instructions={l.specialInstructions} />
                  </span>
                  <span className="font-medium">{money(l.unitPrice * l.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-1.5 border-t border-oat pt-3 text-sm">
              <Row label="Items subtotal" value={money(summary.itemsSubtotal)} />
              {summary.addonsTotal > 0 && <Row label="Add-ons" value={money(summary.addonsTotal)} />}
              {summary.discount > 0 && <Row label={`Discount${promoCode ? ` (${promoCode.toUpperCase()})` : ""}`} value={`−${money(summary.discount)}`} accent />}
              {redemptionCode && <Row label="Loyalty reward" value="applied at order" muted />}
              {fulfillment === "DELIVERY" && (
                <Row label="Delivery fee" value={quote?.available ? (summary.deliveryFee === 0 ? "Free" : money(summary.deliveryFee)) : "—"} />
              )}
              {summary.taxRate > 0 && <Row label={`${config?.tax.label ?? "Tax"} (${summary.taxRate}%)`} value={money(summary.tax)} />}
              <div className="flex justify-between border-t border-oat pt-2 text-base font-bold text-espresso">
                <span>Total</span>
                <span>{money(summary.total)}</span>
              </div>
              {config && config.delivery.freeThreshold > 0 && fulfillment === "DELIVERY" && subtotal < config.delivery.freeThreshold && (
                <p className="pt-1 text-xs text-sage-dark">🚚 Add {money(config.delivery.freeThreshold - subtotal)} more for free delivery!</p>
              )}
            </div>
          </div>
        </aside>
      </div>

      {payOrder && (
        <PaymentModal
          orderNumber={payOrder.number}
          amount={payOrder.total}
          onPaid={onPaid}
          onClose={() => {
            const o = payOrder;
            setPayOrder(null);
            navigate(`/order-success/${o.number}`, { state: { order: o } });
          }}
        />
      )}
    </div>
  );
}

function Row({ label, value, accent, muted }: { label: string; value: string; accent?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${accent ? "text-sage-dark" : muted ? "text-charcoal/50" : ""}`}>
      <span>{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
