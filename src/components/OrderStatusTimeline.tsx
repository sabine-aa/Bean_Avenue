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
    return <div className="bg-terracotta/10 text-terracotta-dark rounded-xl px-4 py-2 text-sm font-semibold">✖️ This order was cancelled.</div>;
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
          <span className="text-espresso font-semibold">
            {meta.icon} {meta.label}
          </span>
          <span className="text-charcoal/50">
            Step {Math.max(current + 1, 1)} of {flow.length}
          </span>
        </div>
        <div className="bg-oat mt-1.5 h-1.5 overflow-hidden rounded-full">
          <div className="bg-sage h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
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
            {i > 0 && <span className={`absolute top-4 right-1/2 h-1 w-full -translate-y-1/2 ${i <= current ? "bg-sage" : "bg-oat"}`} aria-hidden />}
            <span
              className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition ${
                done ? "bg-sage text-cream" : active ? "bg-espresso text-cream ring-sage/30 ring-4" : "bg-oat text-charcoal/40"
              }`}
            >
              {done ? "✓" : meta.icon}
            </span>
            <span className={`mt-2 text-[11px] leading-tight font-semibold ${active ? "text-espresso" : done ? "text-sage-dark" : "text-charcoal/40"}`}>
              {meta.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
