import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Img } from "../components/Img";
import { ItemExtras } from "../components/ItemExtras";
import { useCart } from "../context/CartContext";
import { money } from "../lib/api";

export function Cart() {
  const { lines, subtotal, updateQuantity, remove } = useCart();
  const navigate = useNavigate();
  const [promoCode, setPromoCode] = useState("");

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <p className="text-5xl">🛒</p>
        <h1 className="mt-4 font-display text-2xl font-bold text-espresso">
          Your cart's feeling light.
        </h1>
        <p className="mt-2 text-charcoal/70">Add something tasty.</p>
        <Link
          to="/menu"
          className="btn-3d mt-6 inline-block rounded-full bg-espresso px-8 py-3 font-semibold text-cream"
        >
          Browse the menu
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold text-espresso">Your cart</h1>

      <ul className="mt-6 space-y-4">
        {lines.map((line) => (
          <li key={line.key} className="flex gap-4 rounded-2xl bg-white p-4 shadow-sm">
            <Img src={line.photo} alt={line.name} className="h-20 w-20 shrink-0 rounded-xl" />
            <div className="flex flex-1 flex-col">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-espresso">{line.name}</p>
                <p className="font-semibold text-terracotta">
                  {money(line.unitPrice * line.quantity)}
                </p>
              </div>
              <ItemExtras
                options={line.selectedOptions}
                addons={line.addons}
                instructions={line.specialInstructions}
              />
              <div className="mt-auto flex items-center justify-between pt-2">
                <div className="flex items-center rounded-full border border-oat">
                  <button
                    onClick={() => updateQuantity(line.key, line.quantity - 1)}
                    className="px-3 py-1 font-bold text-espresso"
                    aria-label={`Decrease ${line.name} quantity`}
                  >
                    −
                  </button>
                  <span className="w-7 text-center text-sm font-semibold">{line.quantity}</span>
                  <button
                    onClick={() => updateQuantity(line.key, line.quantity + 1)}
                    className="px-3 py-1 font-bold text-espresso"
                    aria-label={`Increase ${line.name} quantity`}
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={() => remove(line.key)}
                  className="text-sm text-charcoal/50 hover:text-terracotta"
                >
                  Remove
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
        <label className="block text-sm font-semibold text-espresso" htmlFor="promo">
          Promo code
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="promo"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            placeholder="e.g. WELCOME10"
            className="flex-1 rounded-full border border-oat px-4 py-2 text-sm"
          />
        </div>
        <p className="mt-1 text-xs text-charcoal/50">Applied at checkout.</p>

        <div className="mt-6 space-y-1 border-t border-oat pt-4 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="font-semibold">{money(subtotal)}</span>
          </div>
          <div className="flex justify-between text-charcoal/60">
            <span>Discounts & tax</span>
            <span>calculated at checkout</span>
          </div>
        </div>

        <button
          onClick={() => navigate("/checkout", { state: { promoCode: promoCode.trim() } })}
          className="btn-3d mt-6 w-full rounded-full bg-terracotta px-6 py-3 font-semibold text-cream"
        >
          Proceed to Checkout
        </button>
      </div>
    </div>
  );
}
