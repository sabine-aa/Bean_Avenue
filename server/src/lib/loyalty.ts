import { prisma } from "../db";
import { earnBeans, tierFor } from "./helpers";

// Loyalty rules tied to the order/payment lifecycle (spec §13):
//   • Beans are awarded only AFTER an order is paid (online) or completed (cash).
//   • Cancelling or fully refunding an order removes the beans it earned.
//   • An applied reward voucher is returned (reusable) when its order is undone.
//   • Every adjustment is logged and guarded so it can never happen twice.

/** Credit the beans an order earns. Idempotent via Order.beansAwarded. */
export async function awardOrderBeans(orderId: number): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.beansAwarded || order.beansReversed) return;
  await prisma.order.update({ where: { id: orderId }, data: { beansAwarded: true } });
  if (order.customerId && order.beansEarned > 0) {
    await earnBeans(order.customerId, order.beansEarned, "Order", order.number);
  }
}

/**
 * Reverse the loyalty effects of an order that was cancelled or fully refunded.
 * Idempotent via Order.beansReversed. Removes awarded beans (never below zero)
 * and returns any applied reward voucher to ACTIVE so it can be used again.
 */
export async function reverseOrderBeans(orderId: number): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.beansReversed) return;

  await prisma.$transaction(async (tx) => {
    // Re-read inside the transaction to keep the guard atomic.
    const fresh = await tx.order.findUnique({ where: { id: orderId } });
    if (!fresh || fresh.beansReversed) return;
    await tx.order.update({ where: { id: orderId }, data: { beansReversed: true } });

    // Remove the beans we credited (only if they were actually awarded).
    if (fresh.beansAwarded && fresh.customerId && fresh.beansEarned > 0) {
      const customer = await tx.customer.findUnique({ where: { id: fresh.customerId } });
      if (customer) {
        const remove = Math.min(fresh.beansEarned, customer.beanBalance);
        const lifetimeBeans = Math.max(0, customer.lifetimeBeans - fresh.beansEarned);
        const balanceAfter = customer.beanBalance - remove;
        await tx.customer.update({
          where: { id: customer.id },
          data: { beanBalance: balanceAfter, lifetimeBeans, tier: tierFor(lifetimeBeans) },
        });
        await tx.loyaltyTransaction.create({
          data: {
            customerId: customer.id,
            type: "ADJUST",
            amount: -remove,
            balanceAfter,
            source: "Order reversal",
            refId: fresh.number,
            note: `Beans removed — order ${fresh.number} cancelled/refunded`,
          },
        });
      }
    }

    // Return an applied reward voucher so the customer can reuse it.
    if (fresh.loyaltyRedemptionCode) {
      await tx.redemption.updateMany({
        where: { code: fresh.loyaltyRedemptionCode, status: "CLAIMED" },
        data: { status: "ACTIVE", claimedAt: null },
      });
    }
  });
}
