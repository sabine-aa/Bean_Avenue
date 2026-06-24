import { prisma } from "../db";

type NotificationType = "ORDER" | "BOOKING" | "REWARD" | "VOUCHER" | "POINTS" | "PAYMENT" | "DELIVERY";

/**
 * Save an in-website notification for a customer. No-op for guest actions
 * (customerId null/undefined) so guest orders never error.
 */
export async function notify(
  customerId: number | null | undefined,
  data: { type: NotificationType; title: string; message: string; link?: string }
) {
  if (!customerId) return;
  try {
    await prisma.notification.create({ data: { customerId, ...data } });
  } catch (err) {
    // A failed notification should never break the action that triggered it.
    console.error("notify failed:", err);
  }
}
