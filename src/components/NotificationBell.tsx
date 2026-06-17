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
        className="relative rounded-full p-2 text-espresso transition hover:bg-oat"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <BellIcon className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-terracotta px-1 text-[10px] font-bold text-cream">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-2xl border border-oat bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-oat px-4 py-2.5">
            <p className="font-semibold text-espresso">Notifications</p>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs font-semibold text-terracotta hover:underline">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-charcoal/50">No notifications yet.</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openNotification(n)}
                  className={`flex w-full gap-3 border-b border-oat/60 px-4 py-3 text-left transition hover:bg-oat/30 ${
                    n.isRead ? "" : "bg-sage/5"
                  }`}
                >
                  <span className="text-lg leading-none">{ICON[n.type] ?? "🔔"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={`text-sm ${n.isRead ? "font-medium text-charcoal" : "font-bold text-espresso"}`}>
                        {n.title}
                      </span>
                      {!n.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-terracotta" />}
                    </span>
                    <span className="mt-0.5 block text-xs text-charcoal/70">{n.message}</span>
                    <span className="mt-0.5 block text-[11px] text-charcoal/40">
                      {formatDateTime(n.createdAt)}
                    </span>
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
