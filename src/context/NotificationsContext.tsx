import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { customerApi, getCustomerToken } from "../lib/api";
import type { AppNotification } from "../types";
import { useCustomerAuth } from "./CustomerAuthContext";

interface NotificationsValue {
  items: AppNotification[];
  unread: number;
  refresh: () => Promise<void>;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { account } = useCustomerAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    if (!getCustomerToken()) {
      setItems([]);
      setUnread(0);
      return;
    }
    try {
      const res = await customerApi.get<{ items: AppNotification[]; unread: number }>("/api/notifications");
      setItems(res.items);
      setUnread(res.unread);
    } catch {
      /* ignore — keep what we have */
    }
  }, []);

  // Poll while logged in so new notifications appear without a refresh.
  useEffect(() => {
    if (!account) {
      setItems([]);
      setUnread(0);
      return;
    }
    refresh();
    const id = setInterval(refresh, 25_000);
    return () => clearInterval(id);
  }, [account, refresh]);

  const markRead = useCallback(
    async (id: number) => {
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setUnread((u) => Math.max(0, u - 1));
      try {
        await customerApi.post(`/api/notifications/${id}/read`, {});
      } catch {
        refresh();
      }
    },
    [refresh],
  );

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
    try {
      await customerApi.post("/api/notifications/read-all", {});
    } catch {
      refresh();
    }
  }, [refresh]);

  const value = useMemo<NotificationsValue>(() => ({ items, unread, refresh, markRead, markAllRead }), [items, unread, refresh, markRead, markAllRead]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used inside NotificationsProvider");
  return ctx;
}
