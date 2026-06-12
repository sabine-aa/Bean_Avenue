import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import type { CartLine, MenuItem, SelectedOption } from "../types";

interface CartContextValue {
  lines: CartLine[];
  count: number;
  subtotal: number;
  add: (item: MenuItem, quantity: number, selectedOptions: SelectedOption[]) => void;
  updateQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
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
      add: (item, quantity, selectedOptions) => {
        const key = `${item.id}::${selectedOptions.map((o) => `${o.group}=${o.choice}`).join("|")}`;
        setLines((prev) => {
          const existing = prev.find((l) => l.key === key);
          if (existing) {
            return prev.map((l) =>
              l.key === key ? { ...l, quantity: l.quantity + quantity } : l
            );
          }
          const unitPrice =
            item.price + selectedOptions.reduce((s, o) => s + o.priceDelta, 0);
          return [
            ...prev,
            {
              key,
              menuItemId: item.id,
              name: item.name,
              photo: item.photo,
              basePrice: item.price,
              unitPrice,
              quantity,
              selectedOptions,
            },
          ];
        });
      },
      updateQuantity: (key, quantity) =>
        setLines((prev) =>
          quantity <= 0
            ? prev.filter((l) => l.key !== key)
            : prev.map((l) => (l.key === key ? { ...l, quantity } : l))
        ),
      remove: (key) => setLines((prev) => prev.filter((l) => l.key !== key)),
      clear: () => setLines([]),
    };
  }, [lines]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
