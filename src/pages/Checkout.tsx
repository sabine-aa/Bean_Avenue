import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ItemExtras } from "../components/ItemExtras";
import { useCart } from "../context/CartContext";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { useToast } from "../context/ToastContext";
import { api, money } from "../lib/api";
import type { Order } from "../types";

export function Checkout() {
  const { lines, subtotal, clear } = useCart();
  const { account, refresh } = useCustomerAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [name, setName] = useState(account?.name ?? "");
  const [phone, setPhone] = useState(account?.phone ?? "");
  const [email, setEmail] = useState("");
  const [pickupTime, setPickupTime] = useState("ASAP");
  const [submitting, setSubmitting] = useState(false);
  const promoCode: string = location.state?.promoCode ?? "";
  const beansToEarn = Math.floor(subtotal);

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <p className="text-charcoal/70">Your cart's feeling light. Add something tasty.</p>
        <Link to="/menu" className="mt-4 inline-block font-semibold text-terracotta hover:underline">
          ← Back to the menu
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const order = await api.post<Order>("/api/orders", {
        customerName: name,
        phone,
        email,
        pickupTime,
        promoCode: promoCode || undefined,
        items: lines.map((l) => ({
          menuItemId: l.menuItemId,
          quantity: l.quantity,
          selectedOptions: l.selectedOptions.map((o) => ({ group: o.group, choice: o.choice })),
          addons: l.addons.map((a) => ({ addonId: a.addonId, quantity: a.quantity })),
          specialInstructions: l.specialInstructions || undefined,
        })),
      });
      clear();
      // Pull the freshly-earned beans into the logged-in account.
      if (account) refresh().catch(() => {});
      navigate(`/order-success/${order.number}`, { state: { order } });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong.", "error");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold text-espresso">Checkout</h1>

      {account ? (
        <div className="mt-4 rounded-xl bg-sage/15 px-4 py-3 text-sm text-espresso">
          ☕ Logged in as <span className="font-semibold">{account.name}</span> · you'll earn{" "}
          <span className="font-semibold">{beansToEarn} beans</span> on this order.
        </div>
      ) : (
        <div className="mt-4 rounded-xl bg-oat/60 px-4 py-3 text-sm text-charcoal/80">
          🫘 <Link to="/loyalty" className="font-semibold text-terracotta hover:underline">Log in or create an account</Link>{" "}
          to earn {beansToEarn} beans on this order — or order as a guest below.
        </div>
      )}

      <div className="mt-6 grid gap-8 md:grid-cols-5">
        <form onSubmit={handleSubmit} className="space-y-4 md:col-span-3">
          <div>
            <label className="block text-sm font-semibold text-espresso" htmlFor="name">
              Name
            </label>
            <input
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-oat bg-white px-4 py-2.5"
              autoComplete="name"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-espresso" htmlFor="phone">
              Phone
            </label>
            <input
              id="phone"
              required
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-xl border border-oat bg-white px-4 py-2.5"
              autoComplete="tel"
            />
            {!account && (
              <p className="mt-1 text-xs text-charcoal/50">
                Loyalty member? Log in first, or use your member phone number to earn beans on this order.
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-semibold text-espresso" htmlFor="email">
              Email <span className="font-normal text-charcoal/50">(optional)</span>
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-oat bg-white px-4 py-2.5"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-espresso" htmlFor="pickup">
              Pickup time
            </label>
            <select
              id="pickup"
              value={pickupTime}
              onChange={(e) => setPickupTime(e.target.value)}
              className="mt-1 w-full rounded-xl border border-oat bg-white px-4 py-2.5"
            >
              <option>ASAP</option>
              <option>In 15 minutes</option>
              <option>In 30 minutes</option>
              <option>In 1 hour</option>
            </select>
          </div>

          <div className="rounded-xl bg-oat/60 p-4 text-sm">
            <p className="font-semibold text-espresso">💵 Pay on pickup</p>
            <p className="mt-1 text-charcoal/70">
              Pay with cash or card at the counter. Online payment is coming soon.
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-3d w-full rounded-full bg-terracotta px-6 py-3 font-semibold text-cream disabled:cursor-wait disabled:opacity-60"
          >
            {submitting ? "Placing your order…" : "Place Order"}
          </button>
        </form>

        <aside className="md:col-span-2">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="font-display text-lg font-bold text-espresso">Your order</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {lines.map((l) => (
                <li key={l.key} className="flex justify-between gap-2">
                  <span>
                    {l.quantity}× {l.name}
                    <ItemExtras
                      options={l.selectedOptions}
                      addons={l.addons}
                      instructions={l.specialInstructions}
                    />
                  </span>
                  <span className="font-medium">{money(l.unitPrice * l.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-1 border-t border-oat pt-3 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-semibold">{money(subtotal)}</span>
              </div>
              {promoCode && (
                <div className="flex justify-between text-sage-dark">
                  <span>Promo: {promoCode.toUpperCase()}</span>
                  <span>applied at order</span>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
