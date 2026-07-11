import type { Fulfillment, OrderStatus } from "../types";

// Legacy statuses (from before delivery existed) map onto the new vocabulary so
// old orders still render correctly.
const LEGACY_ALIAS: Record<string, OrderStatus> = {
  NEW: "RECEIVED",
  READY: "READY_FOR_PICKUP",
  PICKED_UP: "COMPLETED",
};

export const normalizeStatus = (s: OrderStatus | string): OrderStatus =>
  (LEGACY_ALIAS[s as string] ?? s) as OrderStatus;

// The linear flows. CANCELLED / AWAITING_PAYMENT sit outside the flow.
export const PICKUP_FLOW: OrderStatus[] = ["RECEIVED", "ACCEPTED", "PREPARING", "READY_FOR_PICKUP", "COMPLETED"];
export const DELIVERY_FLOW: OrderStatus[] = ["RECEIVED", "ACCEPTED", "PREPARING", "READY_FOR_DELIVERY", "OUT_FOR_DELIVERY", "DELIVERED"];

export const flowFor = (f: Fulfillment): OrderStatus[] => (f === "DELIVERY" ? DELIVERY_FLOW : PICKUP_FLOW);

export interface StatusMeta {
  label: string;
  description: string;
  badge: string; // tailwind classes for a status pill
  icon: string;
}

export const ORDER_STATUS_META: Record<OrderStatus, StatusMeta> = {
  AWAITING_PAYMENT: {
    label: "Awaiting Payment",
    description: "Complete payment to confirm your order.",
    badge: "bg-amber-100 text-amber-700",
    icon: "💳",
  },
  RECEIVED: {
    label: "Order Received",
    description: "We've got your order.",
    badge: "bg-terracotta/15 text-terracotta-dark",
    icon: "📝",
  },
  ACCEPTED: {
    label: "Accepted",
    description: "Your order has been accepted.",
    badge: "bg-oat text-mocha",
    icon: "👍",
  },
  PREPARING: {
    label: "Preparing",
    description: "The barista is on it.",
    badge: "bg-oat text-mocha",
    icon: "☕",
  },
  READY_FOR_PICKUP: {
    label: "Ready for Pickup",
    description: "Come grab it at the counter!",
    badge: "bg-sage/25 text-sage-dark",
    icon: "✅",
  },
  READY_FOR_DELIVERY: {
    label: "Ready for Delivery",
    description: "Packed and waiting for a driver.",
    badge: "bg-sage/25 text-sage-dark",
    icon: "📦",
  },
  OUT_FOR_DELIVERY: {
    label: "Out for Delivery",
    description: "Your order is on its way.",
    badge: "bg-blue-100 text-blue-700",
    icon: "🛵",
  },
  DELIVERED: {
    label: "Delivered",
    description: "Delivered. Enjoy! Thanks for ordering.",
    badge: "bg-espresso/10 text-espresso",
    icon: "🎉",
  },
  COMPLETED: {
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
  // legacy (aliased on display, but kept here so direct lookups never crash)
  NEW: { label: "Order Received", description: "We've got your order.", badge: "bg-terracotta/15 text-terracotta-dark", icon: "📝" },
  READY: { label: "Ready for Pickup", description: "Come grab it at the counter!", badge: "bg-sage/25 text-sage-dark", icon: "✅" },
  PICKED_UP: { label: "Completed", description: "Enjoy! Thanks for visiting.", badge: "bg-espresso/10 text-espresso", icon: "🎉" },
};

export const statusMeta = (s: OrderStatus | string): StatusMeta =>
  ORDER_STATUS_META[normalizeStatus(s)] ?? ORDER_STATUS_META.RECEIVED;

export const statusLabel = (s: OrderStatus | string): string => statusMeta(s).label;

/** Index of a status within its fulfillment flow, or -1 when outside it. */
export const statusStep = (s: OrderStatus | string, f: Fulfillment): number =>
  flowFor(f).indexOf(normalizeStatus(s));

/** True once the order has reached a terminal (done/cancelled) state. */
export const isTerminal = (s: OrderStatus | string): boolean =>
  ["COMPLETED", "DELIVERED", "CANCELLED"].includes(normalizeStatus(s));

/** Friendly time estimate per status. */
export function timeEstimate(s: OrderStatus | string, f: Fulfillment): string | null {
  const status = normalizeStatus(s);
  if (f === "DELIVERY") {
    const map: Partial<Record<OrderStatus, string>> = {
      RECEIVED: "Being confirmed",
      ACCEPTED: "Preparing soon",
      PREPARING: "20–30 minutes",
      READY_FOR_DELIVERY: "Waiting for a driver",
      OUT_FOR_DELIVERY: "On the way — almost there!",
    };
    return map[status] ?? null;
  }
  const map: Partial<Record<OrderStatus, string>> = {
    RECEIVED: "15–20 minutes",
    ACCEPTED: "15–20 minutes",
    PREPARING: "10–15 minutes",
    READY_FOR_PICKUP: "Ready now — come on over!",
  };
  return map[status] ?? null;
}

// ---- Payment status display ----
export const PAYMENT_STATUS_META: Record<string, { label: string; badge: string }> = {
  PENDING: { label: "Payment pending", badge: "bg-amber-100 text-amber-700" },
  PAID: { label: "Paid", badge: "bg-green-100 text-green-700" },
  FAILED: { label: "Payment failed", badge: "bg-terracotta/15 text-terracotta-dark" },
  CANCELLED: { label: "Cancelled", badge: "bg-gray-100 text-gray-600" },
  REFUNDED: { label: "Refunded", badge: "bg-blue-100 text-blue-700" },
  PARTIALLY_REFUNDED: { label: "Partially refunded", badge: "bg-blue-100 text-blue-700" },
  CASH_DUE: { label: "Cash due", badge: "bg-amber-100 text-amber-700" },
  CASH_COLLECTED: { label: "Cash collected", badge: "bg-green-100 text-green-700" },
};

export const paymentStatusMeta = (s: string) =>
  PAYMENT_STATUS_META[s] ?? { label: s, badge: "bg-gray-100 text-gray-600" };

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  ONLINE: "Card (online)",
  WHISH: "Whish",
  CASH_ON_DELIVERY: "Cash on delivery",
  CASH_AT_PICKUP: "Cash at pickup",
};
