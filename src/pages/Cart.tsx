import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Img } from "../components/Img";
import { ItemExtras } from "../components/ItemExtras";
import { BeanIcon, CartIcon, CheckIcon, EditIcon, MinusIcon, PlusIcon, ScooterIcon, StoreIcon, TagIcon, TrashIcon } from "../components/icons";
import { useCart } from "../context/CartContext";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { customerApi, money } from "../lib/api";
import { promoInfo, round2, type PromoInfo } from "../lib/promos";
import type { Fulfillment, StorefrontConfig } from "../types";

export function Cart() {
  const { lines, subtotal, count, updateQuantity, remove } = useCart();
  const { account } = useCustomerAuth();
  const navigate = useNavigate();

  const [fulfillment, setFulfillment] = useState<Fulfillment>("PICKUP");
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<PromoInfo | null>(null);
  const [promoError, setPromoError] = useState("");
  const [voucher, setVoucher] = useState("");
  const [config, setConfig] = useState<StorefrontConfig | null>(null);

  useEffect(() => {
    customerApi
      .get<StorefrontConfig>("/api/delivery/config")
      .then(setConfig)
      .catch(() => {});
  }, []);

  const discount = useMemo(() => (promo ? round2(subtotal * promo.rate) : 0), [promo, subtotal]);
  const total = round2(subtotal - discount);
  const beansToEarn = Math.floor(Math.max(0, subtotal - discount));
  const activeVouchers = (account?.redemptions ?? []).filter((r) => r.status === "ACTIVE");
  const deliveryAvailable = config?.delivery.available ?? true;
  const freeThreshold = config?.delivery.freeThreshold ?? 0;

  function applyPromo() {
    const info = promoInfo(promoInput);
    if (!info) {
      setPromo(null);
      setPromoError("That code isn't valid. Try WELCOME or BEAN10.");
      return;
    }
    setPromo(info);
    setPromoError("");
    setPromoInput(info.code);
  }

  function goToCheckout() {
    navigate("/checkout", {
      state: { promoCode: promo?.code, fulfillment, redemptionCode: voucher || undefined },
    });
  }

  // ---- Empty state ----
  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:py-28">
        <div className="bg-oat/70 text-espresso mx-auto flex h-24 w-24 items-center justify-center rounded-full shadow-inner">
          <CartIcon className="h-11 w-11" />
        </div>
        <h1 className="font-display text-espresso mt-6 text-2xl font-bold sm:text-3xl">Your cart is waiting for something good.</h1>
        <p className="text-charcoal/60 mt-2">Add a drink or a treat and it'll show up right here.</p>
        <Link to="/menu" className="btn-3d bg-terracotta text-cream mt-7 inline-flex items-center gap-2 rounded-full px-8 py-3 font-semibold">
          Browse the Menu
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-espresso text-3xl font-bold">Your cart</h1>
        <span className="text-charcoal/50 text-sm">
          {count} {count === 1 ? "item" : "items"}
        </span>
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
        {/* ---- Left: items ---- */}
        <div className="space-y-3">
          {lines.map((line) => (
            <div key={line.key} className="card-lift flex gap-4 rounded-2xl bg-white p-3.5 shadow-sm sm:p-4">
              <Img src={line.photo} alt={line.name} className="h-24 w-24 shrink-0 rounded-xl sm:h-28 sm:w-28" />

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-display text-espresso truncate text-base font-bold">{line.name}</p>
                    <ItemExtras options={line.selectedOptions} addons={line.addons} instructions={line.specialInstructions} />
                  </div>
                  <button
                    onClick={() => remove(line.key)}
                    aria-label={`Remove ${line.name}`}
                    className="tap text-charcoal/40 hover:bg-terracotta/10 hover:text-terracotta-dark shrink-0 rounded-full p-2 transition"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>

                <p className="text-charcoal/50 mt-1 text-xs">{money(line.unitPrice)} each</p>

                <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                  <div className="flex items-center gap-3">
                    {/* compact quantity selector */}
                    <div className="border-oat bg-cream/60 inline-flex items-center rounded-full border">
                      <button
                        onClick={() => updateQuantity(line.key, line.quantity - 1)}
                        className="tap text-espresso hover:bg-oat flex h-8 w-8 items-center justify-center rounded-full transition"
                        aria-label={`Decrease ${line.name}`}
                      >
                        <MinusIcon />
                      </button>
                      <span className="text-espresso w-7 text-center text-sm font-bold">{line.quantity}</span>
                      <button
                        onClick={() => updateQuantity(line.key, line.quantity + 1)}
                        className="tap text-espresso hover:bg-oat flex h-8 w-8 items-center justify-center rounded-full transition"
                        aria-label={`Increase ${line.name}`}
                      >
                        <PlusIcon />
                      </button>
                    </div>
                    <button
                      onClick={() => navigate(`/menu/${line.menuItemId}`)}
                      className="tap text-charcoal/55 hover:text-espresso inline-flex items-center gap-1 text-xs font-semibold transition"
                    >
                      <EditIcon className="h-4 w-4" /> Edit
                    </button>
                  </div>
                  <p className="font-display text-espresso text-lg font-bold">{money(line.unitPrice * line.quantity)}</p>
                </div>
              </div>
            </div>
          ))}

          <Link to="/menu" className="tap text-terracotta inline-flex items-center gap-1 px-1 text-sm font-semibold hover:underline">
            ← Add more items
          </Link>
        </div>

        {/* ---- Right: fulfillment + promo + loyalty + summary (sticky) ---- */}
        <div className="space-y-4 lg:sticky lg:top-24">
          {/* Fulfillment */}
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-espresso text-sm font-semibold">How would you like your order?</p>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <FulfillmentCard
                selected={fulfillment === "PICKUP"}
                onClick={() => setFulfillment("PICKUP")}
                icon={<StoreIcon className="h-6 w-6" />}
                title="Pickup"
                desc="From Bean Avenue"
              />
              <FulfillmentCard
                selected={fulfillment === "DELIVERY"}
                onClick={() => deliveryAvailable && setFulfillment("DELIVERY")}
                disabled={!deliveryAvailable}
                icon={<ScooterIcon className="h-6 w-6" />}
                title="Delivery"
                desc={deliveryAvailable ? "To your address" : config?.delivery.paused ? "Paused" : "Unavailable"}
              />
            </div>
          </div>

          {/* Promo */}
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-espresso flex items-center gap-1.5 text-sm font-semibold">
              <TagIcon className="text-sage-dark h-4 w-4" /> Promo code
            </p>
            {promo ? (
              <div className="bg-sage/15 mt-2 flex items-center justify-between rounded-xl px-3.5 py-2.5">
                <p className="text-sage-dark text-sm">
                  <span className="font-bold">{promo.code}</span> applied — {money(discount)} off
                </p>
                <button
                  onClick={() => {
                    setPromo(null);
                    setPromoInput("");
                  }}
                  className="text-charcoal/50 hover:text-terracotta-dark text-xs font-semibold"
                >
                  Remove
                </button>
              </div>
            ) : (
              <>
                <div className="mt-2 flex gap-2">
                  <input
                    value={promoInput}
                    onChange={(e) => {
                      setPromoInput(e.target.value);
                      setPromoError("");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && applyPromo()}
                    placeholder="e.g. WELCOME"
                    className="inset-3d border-oat bg-cream/50 placeholder:text-charcoal/40 min-w-0 flex-1 rounded-full border px-4 py-2 text-sm uppercase placeholder:normal-case"
                  />
                  <button
                    onClick={applyPromo}
                    disabled={!promoInput.trim()}
                    className="btn-3d bg-espresso text-cream shrink-0 rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    Apply
                  </button>
                </div>
                {promoError && <p className="text-terracotta-dark mt-1.5 text-xs font-medium">{promoError}</p>}
              </>
            )}
          </div>

          {/* Loyalty */}
          {account && (
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-espresso flex items-center gap-1.5 text-sm font-semibold">
                  <BeanIcon className="text-sage-dark h-5 w-5" /> You have {account.beanBalance} beans
                </p>
                <Link to="/loyalty" className="text-terracotta text-xs font-semibold hover:underline">
                  View rewards
                </Link>
              </div>
              {activeVouchers.length > 0 && (
                <div className="mt-3">
                  <label className="text-charcoal/60 text-xs font-semibold">Apply a reward voucher</label>
                  <select
                    value={voucher}
                    onChange={(e) => setVoucher(e.target.value)}
                    className="border-oat mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
                  >
                    <option value="">No reward</option>
                    {activeVouchers.map((r) => (
                      <option key={r.id} value={r.code}>
                        {r.rewardName} ({r.code})
                      </option>
                    ))}
                  </select>
                  <p className="text-charcoal/45 mt-1 text-[11px]">Applied at checkout — beans are only spent once you confirm.</p>
                </div>
              )}
              <p className="text-sage-dark mt-2 text-xs">🫘 Earn ~{beansToEarn} beans on this order.</p>
            </div>
          )}

          {/* Order summary */}
          <div className="ring-oat/60 rounded-2xl bg-white p-5 shadow-md ring-1">
            <h2 className="font-display text-espresso text-lg font-bold">Order summary</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Subtotal" value={money(subtotal)} />
              <Row label="Discount" value={discount > 0 ? `−${money(discount)}` : money(0)} accent={discount > 0} />
              {voucher && <Row label="Loyalty reward" value="at checkout" muted />}
              <Row label="Delivery fee" value={fulfillment === "DELIVERY" ? "After address" : money(0)} muted={fulfillment === "DELIVERY"} />
              <Row
                label={`Tax${config && config.tax.rate > 0 ? ` (${config.tax.rate}%)` : ""}`}
                value={config && config.tax.rate > 0 ? "At checkout" : money(0)}
                muted={!!(config && config.tax.rate > 0)}
              />
              <div className="border-oat mt-2 flex items-baseline justify-between border-t pt-3">
                <dt className="font-display text-espresso text-base font-bold">Total</dt>
                <dd className="font-display text-espresso text-2xl font-extrabold">{money(total)}</dd>
              </div>
            </dl>

            {fulfillment === "DELIVERY" && freeThreshold > 0 && subtotal < freeThreshold && (
              <p className="text-sage-dark mt-2 text-xs">🛵 Add {money(freeThreshold - subtotal)} more for free delivery!</p>
            )}

            <button onClick={goToCheckout} className="btn-3d bg-terracotta text-cream mt-4 w-full rounded-full px-6 py-3.5 text-base font-semibold">
              Continue to Checkout
            </button>
            <p className="text-charcoal/45 mt-2 text-center text-[11px]">
              {fulfillment === "DELIVERY" ? "Delivery fee & address added next" : "Pickup details added next"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FulfillmentCard({
  selected,
  onClick,
  disabled,
  icon,
  title,
  desc,
}: {
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`tap relative flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
        selected ? "border-espresso bg-espresso/[0.04] ring-espresso/15 shadow-sm ring-2" : "border-oat hover:border-sage bg-white hover:shadow-sm"
      }`}
    >
      {selected && (
        <span className="bg-espresso text-cream absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full">
          <CheckIcon className="h-3 w-3" />
        </span>
      )}
      <span className={selected ? "text-espresso" : "text-sage-dark"}>{icon}</span>
      <span className="font-display text-espresso text-sm font-bold">{title}</span>
      <span className="text-charcoal/55 text-[11px] leading-tight">{desc}</span>
    </button>
  );
}

function Row({ label, value, accent, muted }: { label: string; value: string; accent?: boolean; muted?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-charcoal/70">{label}</dt>
      <dd className={`font-medium ${accent ? "text-sage-dark" : muted ? "text-charcoal/45" : "text-espresso"}`}>{value}</dd>
    </div>
  );
}
