import type { Fulfillment, OrderStatus } from "../types";
import { flowFor, normalizeStatus, statusMeta, statusStep } from "../lib/orderStatus";

// Step-by-step order timeline (pickup or delivery). `compact` renders a slim
// progress bar for cards.
export function OrderStatusTimeline({
  status,
  fulfillment = "PICKUP",
  compact = false,
}: {
  status: OrderStatus;
  fulfillment?: Fulfillment;
  compact?: boolean;
}) {
  const normalized = normalizeStatus(status);

  if (normalized === "CANCELLED") {
    return (
      <div className="rounded-xl bg-terracotta/10 px-4 py-2 text-sm font-semibold text-terracotta-dark">
        ✖️ This order was cancelled.
      </div>
    );
  }
  if (normalized === "AWAITING_PAYMENT") {
    return (
      <div className="rounded-xl bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-700">
        💳 Awaiting payment — complete payment to confirm this order.
      </div>
    );
  }

  const flow = flowFor(fulfillment);
  const current = statusStep(normalized, fulfillment);

  if (compact) {
    const pct = current >= 0 ? (current / (flow.length - 1)) * 100 : 0;
    const meta = statusMeta(normalized);
    return (
      <div>
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-espresso">
            {meta.icon} {meta.label}
          </span>
          <span className="text-charcoal/50">
            Step {Math.max(current + 1, 1)} of {flow.length}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-oat">
          <div className="h-full rounded-full bg-sage transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }

  return (
    <ol className="flex items-start">
      {flow.map((step, i) => {
        const done = i < current;
        const active = i === current;
        const meta = statusMeta(step);
        return (
          <li key={step} className="relative flex flex-1 flex-col items-center text-center">
            {i > 0 && (
              <span
                className={`absolute right-1/2 top-4 h-1 w-full -translate-y-1/2 ${i <= current ? "bg-sage" : "bg-oat"}`}
                aria-hidden
              />
            )}
            <span
              className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition ${
                done ? "bg-sage text-cream" : active ? "bg-espresso text-cream ring-4 ring-sage/30" : "bg-oat text-charcoal/40"
              }`}
            >
              {done ? "✓" : meta.icon}
            </span>
            <span
              className={`mt-2 text-[11px] font-semibold leading-tight ${
                active ? "text-espresso" : done ? "text-sage-dark" : "text-charcoal/40"
              }`}
            >
              {meta.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
