import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import type { CartLine, MenuItem, SelectedAddon, SelectedOption } from "../types";

interface CartContextValue {
  lines: CartLine[];
  count: number;
  subtotal: number;
  add: (item: MenuItem, quantity: number, selectedOptions: SelectedOption[], addons?: SelectedAddon[], specialInstructions?: string) => void;
  updateQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  // How many more of a limited-stock item can still be added (null = unlimited).
  remainingFor: (item: MenuItem) => number | null;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "bean-avenue-cart";

function loadCart(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(loadCart);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* in-memory cart only */
    }
  }, [lines]);

  const value = useMemo<CartContextValue>(() => {
    const count = lines.reduce((s, l) => s + l.quantity, 0);
    const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
    return {
      lines,
      count,
      subtotal,
      add: (item, quantity, selectedOptions, addons = [], specialInstructions = "") => {
        const optKey = selectedOptions.map((o) => `${o.group}=${o.choice}`).join("|");
        const addonKey = addons.map((a) => `${a.addonId}x${a.quantity}`).join("|");
        const noteKey = specialInstructions.trim();
        // Same item + same customisation merges; any difference is a new line.
        const key = `${item.id}::${optKey}::${addonKey}::${noteKey}`;
        setLines((prev) => {
          // Limited-stock items (cold sandwiches, salads…) can never exceed what's
          // on hand — sum every line for this product and clamp the amount added.
          let qty = quantity;
          if (item.trackStock && typeof item.stockQty === "number") {
            const already = prev.reduce((s, l) => (l.menuItemId === item.id ? s + l.quantity : s), 0);
            qty = Math.min(quantity, Math.max(0, item.stockQty - already));
            if (qty <= 0) return prev;
          }
          const existing = prev.find((l) => l.key === key);
          if (existing) {
            return prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + qty } : l));
          }
          const unitPrice = item.price + selectedOptions.reduce((s, o) => s + o.priceDelta, 0) + addons.reduce((s, a) => s + a.price * a.quantity, 0);
          return [
            ...prev,
            {
              key,
              menuItemId: item.id,
              name: item.name,
              photo: item.photo,
              basePrice: item.price,
              unitPrice,
              quantity: qty,
              selectedOptions,
              addons,
              specialInstructions: noteKey,
            },
          ];
        });
      },
      updateQuantity: (key, quantity) =>
        setLines((prev) => (quantity <= 0 ? prev.filter((l) => l.key !== key) : prev.map((l) => (l.key === key ? { ...l, quantity } : l)))),
      remove: (key) => setLines((prev) => prev.filter((l) => l.key !== key)),
      clear: () => setLines([]),
      remainingFor: (item) => {
        if (!item.trackStock || typeof item.stockQty !== "number") return null;
        const already = lines.reduce((s, l) => (l.menuItemId === item.id ? s + l.quantity : s), 0);
        return Math.max(0, item.stockQty - already);
      },
    };
  }, [lines]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
