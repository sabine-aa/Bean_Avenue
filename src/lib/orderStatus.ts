import type { OrderStatus } from "../types";

// The linear pickup flow. CANCELLED sits outside the flow.
export const ORDER_FLOW: OrderStatus[] = ["NEW", "PREPARING", "READY", "PICKED_UP"];

export interface StatusMeta {
  label: string;
  description: string;
  badge: string; // tailwind classes for a status pill
  icon: string;
}

export const ORDER_STATUS_META: Record<OrderStatus, StatusMeta> = {
  NEW: {
    label: "Order Received",
    description: "We've got your order.",
    badge: "bg-terracotta/15 text-terracotta-dark",
    icon: "📝",
  },
  PREPARING: {
    label: "Preparing",
    description: "The barista is on it.",
    badge: "bg-oat text-mocha",
    icon: "☕",
  },
  READY: {
    label: "Ready for Pickup",
    description: "Come grab it at the counter!",
    badge: "bg-sage/25 text-sage-dark",
    icon: "✅",
  },
  PICKED_UP: {
    label: "Completed",
    description: "Enjoy! Thanks for visiting.",
    badge: "bg-espresso/10 text-espresso",
    icon: "🎉",
  },
  CANCELLED: {
    label: "Cancelled",
    description: "This order was cancelled.",
    badge: "bg-terracotta/15 text-terracotta-dark",
    icon: "✖️",
  },
};

export const statusLabel = (s: OrderStatus): string => ORDER_STATUS_META[s]?.label ?? s;

/** Index of a status in the flow, or -1 for CANCELLED / unknown. */
export const statusStep = (s: OrderStatus): number => ORDER_FLOW.indexOf(s);

/** Friendly estimated pickup time per status (none once completed/cancelled). */
export const PICKUP_ESTIMATE: Partial<Record<OrderStatus, string>> = {
  NEW: "15–20 minutes",
  PREPARING: "10–15 minutes",
  READY: "Ready now — come on over!",
};
