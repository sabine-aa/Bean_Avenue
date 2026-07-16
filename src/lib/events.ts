import type { EventItem } from "../types";

// Categories shared by events and the (upcoming) "Suggest an Event" form.
export const EVENT_CATEGORIES = ["Workshop", "Study Event", "Social Gathering", "Coffee Experience", "Games", "Business or Networking", "Other"] as const;

export type EventStatus = "OPEN" | "ALMOST_FULL" | "SOLD_OUT" | "COMPLETED" | "CANCELLED";

/** Derive an event's customer-facing status from its data. */
export function eventStatus(e: EventItem): EventStatus {
  if (e.isCancelled) return "CANCELLED";
  if (e.isCompleted || new Date(e.startTime).getTime() < Date.now()) return "COMPLETED";
  if (e.spots != null && e.spots <= 0) return "SOLD_OUT";
  if (e.spots != null) {
    // "Almost full" = within 20% of capacity (min 3 spots) when capacity is known.
    const threshold = e.maxSpots ? Math.max(3, Math.ceil(e.maxSpots * 0.2)) : 3;
    if (e.spots <= threshold) return "ALMOST_FULL";
  }
  return "OPEN";
}

/** Whether customers can still book this event. */
export const canBook = (s: EventStatus) => s === "OPEN" || s === "ALMOST_FULL";

// Label + badge styling per status, in Bean Avenue's palette.
export const STATUS_META: Record<EventStatus, { label: string; badge: string }> = {
  OPEN: { label: "Booking Open", badge: "bg-espresso text-cream" },
  ALMOST_FULL: { label: "Almost Full", badge: "bg-terracotta text-cream" },
  SOLD_OUT: { label: "Sold Out", badge: "bg-charcoal/70 text-cream" },
  COMPLETED: { label: "Completed", badge: "bg-oat text-charcoal/60" },
  CANCELLED: { label: "Cancelled", badge: "bg-terracotta-dark text-cream" },
};

/** "90 min" / "2 hours" / "1 hr 30 min" — null when not specified. */
export function formatDuration(mins: number | null): string | null {
  if (!mins || mins <= 0) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return h === 1 ? "1 hour" : `${h} hours`;
  return `${h} hr ${m} min`;
}

const WHATSAPP_BASE = "https://wa.me/96181185505";

/** WhatsApp booking link that pre-fills the booking message with the event name. */
export function whatsappBookingLink(eventName: string): string {
  const text = `Hello Bean Avenue, I would like to book a place for ${eventName}.`;
  return `${WHATSAPP_BASE}?text=${encodeURIComponent(text)}`;
}
