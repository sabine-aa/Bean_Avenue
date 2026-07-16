// Single source of truth for advancing an order through its lifecycle. Used by
// BOTH the admin Orders screen and the POS online-orders panel so a website order
// behaves identically no matter where staff act on it — same validation, loyalty,
// stock restore, activity log, and customer notification.
import { prisma } from "../db";
import { logActivity } from "./activity";
import { reverseForOrder } from "./consumption";
import { awardOrderBeans, reverseOrderBeans } from "./loyalty";
import { notify } from "./notify";
import { outOrder } from "./serialize";

// Customer-friendly notification text per order status (pickup + delivery stages).
export const ORDER_NOTIFICATIONS: Record<string, { title: string; message: (n: string) => string }> = {
  RECEIVED: { title: "Order received", message: (n) => `We got your order ${n}. We'll keep you posted.` },
  ACCEPTED: { title: "Order accepted", message: (n) => `Order ${n} has been accepted.` },
  PREPARING: { title: "Preparing your order", message: (n) => `Your order ${n} is being prepared.` },
  READY_FOR_PICKUP: { title: "Ready for pickup", message: (n) => `Order ${n} is ready for pickup.` },
  READY_FOR_DELIVERY: { title: "Ready for delivery", message: (n) => `Order ${n} is packed and ready for delivery.` },
  OUT_FOR_DELIVERY: { title: "Out for delivery", message: (n) => `Your order ${n} is out for delivery.` },
  DELIVERED: { title: "Delivered", message: (n) => `Order ${n} has been delivered. Enjoy! ☕` },
  COMPLETED: { title: "Order completed", message: (n) => `Order ${n} is complete. Enjoy! ☕` },
  CANCELLED: { title: "Order cancelled", message: (n) => `Order ${n} was cancelled.` },
};

// Allowed status sets per fulfillment type.
export const PICKUP_STATUSES = ["AWAITING_PAYMENT", "RECEIVED", "ACCEPTED", "PREPARING", "READY_FOR_PICKUP", "COMPLETED", "CANCELLED"];
export const DELIVERY_STATUSES = ["AWAITING_PAYMENT", "RECEIVED", "ACCEPTED", "PREPARING", "READY_FOR_DELIVERY", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"];
export const DONE_STATUSES = ["DELIVERED", "COMPLETED"];

export type StatusResult = { ok: true; order: ReturnType<typeof outOrder> } | { ok: false; code: number; error: string };

/** Advance an order to `status`. Returns the serialized order or a coded error. */
export async function applyOrderStatus(id: number, status: string, opts: { reason?: string; actor: string }): Promise<StatusResult> {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return { ok: false, code: 404, error: "Order not found." };

  const allowed = order.fulfillment === "DELIVERY" ? DELIVERY_STATUSES : PICKUP_STATUSES;
  if (!allowed.includes(status)) return { ok: false, code: 400, error: `Invalid status for a ${order.fulfillment.toLowerCase()} order.` };
  if (status === "CANCELLED" && !String(opts.reason ?? "").trim()) return { ok: false, code: 400, error: "A reason is required to cancel an order." };
  const reason = status === "CANCELLED" ? String(opts.reason).trim() : null;

  // Cash/Whish orders become collected (and confirmed) once completed/delivered.
  const cashSettled = DONE_STATUSES.includes(status) && order.paymentMethod !== "ONLINE" && order.paymentStatus === "CASH_DUE";

  const updated = await prisma.order.update({
    where: { id },
    data: {
      status,
      ...(status === "CANCELLED" ? { cancelReason: reason, cancelledBy: opts.actor } : {}),
      ...(cashSettled ? { paymentStatus: "CASH_COLLECTED" } : {}),
    },
    include: { items: true },
  });

  // Loyalty: award on completion; reverse on cancel. Stock restored on cancel. All idempotent.
  if (DONE_STATUSES.includes(status)) await awardOrderBeans(id);
  if (status === "CANCELLED") {
    await reverseOrderBeans(id);
    await reverseForOrder(id);
  }

  await logActivity(opts.actor, "STATUS_CHANGE", `Order ${order.number} → ${status}${reason ? ` (${reason})` : ""}`, "order", order.number);

  const meta = ORDER_NOTIFICATIONS[status];
  if (meta && updated.customerId) {
    await notify(updated.customerId, {
      type: status.includes("DELIVER") ? "DELIVERY" : "ORDER",
      title: meta.title,
      message: status === "CANCELLED" && reason ? `${meta.message(updated.number)} Reason: ${reason}` : meta.message(updated.number),
      link: `/order-success/${updated.number}`,
    });
  }
  return { ok: true, order: outOrder(updated) };
}
