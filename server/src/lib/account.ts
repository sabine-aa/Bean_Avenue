import { signToken } from "../auth";
import { prisma } from "../db";
import { nextTierInfo } from "./helpers";
import { outBooking, outOrder } from "./serialize";

export const customerToken = (customerId: number) => signToken({ customerId, role: "customer" });

// The logged-in customer's full account, in the shape the frontend expects.
export async function accountResponse(customerId: number, extra: Record<string, unknown> = {}) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      transactions: { orderBy: { createdAt: "desc" }, take: 100 },
      redemptions: { orderBy: { createdAt: "desc" }, take: 50 },
      orders: { include: { items: true }, orderBy: { createdAt: "desc" }, take: 30 },
      bookings: { include: { room: true }, orderBy: { startTime: "desc" }, take: 30 },
    },
  });
  if (!customer) return null;
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    phoneVerified: customer.phoneVerified,
    email: customer.email,
    emailVerified: customer.emailVerified,
    birthday: customer.birthday,
    beanBalance: customer.beanBalance,
    lifetimeBeans: customer.lifetimeBeans,
    tier: customer.tier,
    nextTier: nextTierInfo(customer.lifetimeBeans),
    transactions: customer.transactions,
    redemptions: customer.redemptions,
    orders: customer.orders.map(outOrder),
    bookings: customer.bookings.map(outBooking),
    ...extra,
  };
}
