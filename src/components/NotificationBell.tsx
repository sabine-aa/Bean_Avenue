import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../context/NotificationsContext";
import { formatDateTime } from "../lib/api";
import type { AppNotification } from "../types";
import { BellIcon } from "./icons";

const ICON: Record<string, string> = {
  ORDER: "🛍",
  BOOKING: "🚪",
  REWARD: "🎁",
  VOUCHER: "🎟",
  POINTS: "🫘",
  PAYMENT: "💳",
  DELIVERY: "🛵",
};

export function NotificationBell() {
  const { items, unread, markRead, markAllRead } = useNotifications();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function openNotification(n: AppNotification) {
    if (!n.isRead) markRead(n.id);
    if (n.link) {
      setOpen(false);
      navigate(n.link);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-espresso hover:bg-oat relative rounded-full p-2 transition"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <BellIcon className="h-5 w-5" />
        {unread > 0 && (
          <span className="bg-terracotta text-cream absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="border-oat absolute right-0 z-50 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-2xl border bg-white shadow-xl">
          <div className="border-oat flex items-center justify-between border-b px-4 py-2.5">
            <p className="text-espresso font-semibold">Notifications</p>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-terracotta text-xs font-semibold hover:underline">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="text-charcoal/50 px-4 py-8 text-center text-sm">No notifications yet.</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openNotification(n)}
                  className={`border-oat/60 hover:bg-oat/30 flex w-full gap-3 border-b px-4 py-3 text-left transition ${n.isRead ? "" : "bg-sage/5"}`}
                >
                  <span className="text-lg leading-none">{ICON[n.type] ?? "🔔"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={`text-sm ${n.isRead ? "text-charcoal font-medium" : "text-espresso font-bold"}`}>{n.title}</span>
                      {!n.isRead && <span className="bg-terracotta h-2 w-2 shrink-0 rounded-full" />}
                    </span>
                    <span className="text-charcoal/70 mt-0.5 block text-xs">{n.message}</span>
                    <span className="text-charcoal/40 mt-0.5 block text-[11px]">{formatDateTime(n.createdAt)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
