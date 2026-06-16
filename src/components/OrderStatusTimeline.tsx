import type { OrderStatus } from "../types";
import { ORDER_FLOW, ORDER_STATUS_META, statusStep } from "../lib/orderStatus";

// Step-by-step pickup timeline. `compact` renders a slim progress bar for cards.
export function OrderStatusTimeline({
  status,
  compact = false,
}: {
  status: OrderStatus;
  compact?: boolean;
}) {
  if (status === "CANCELLED") {
    return (
      <div className="rounded-xl bg-terracotta/10 px-4 py-2 text-sm font-semibold text-terracotta-dark">
        ✖️ This order was cancelled.
      </div>
    );
  }

  const current = statusStep(status);

  if (compact) {
    const pct = (current / (ORDER_FLOW.length - 1)) * 100;
    return (
      <div>
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-espresso">
            {ORDER_STATUS_META[status].icon} {ORDER_STATUS_META[status].label}
          </span>
          <span className="text-charcoal/50">
            Step {current + 1} of {ORDER_FLOW.length}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-oat">
          <div
            className="h-full rounded-full bg-sage transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <ol className="flex items-start">
      {ORDER_FLOW.map((step, i) => {
        const done = i < current;
        const active = i === current;
        const meta = ORDER_STATUS_META[step];
        return (
          <li key={step} className="relative flex flex-1 flex-col items-center text-center">
            {/* connector to previous step */}
            {i > 0 && (
              <span
                className={`absolute right-1/2 top-4 h-1 w-full -translate-y-1/2 ${
                  i <= current ? "bg-sage" : "bg-oat"
                }`}
                aria-hidden
              />
            )}
            <span
              className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition ${
                done
                  ? "bg-sage text-cream"
                  : active
                    ? "bg-espresso text-cream ring-4 ring-sage/30"
                    : "bg-oat text-charcoal/40"
              }`}
            >
              {done ? "✓" : meta.icon}
            </span>
            <span
              className={`mt-2 text-xs font-semibold ${
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
