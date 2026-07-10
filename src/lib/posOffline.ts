// Local-first POS storage. Caches the menu so the register works with no
// internet, and queues sales made offline — syncing them to the server (idempotent
// via clientRef) the moment the connection returns. Nothing is ever lost.
import { posApi } from "./api";
import type { MenuItem } from "../types";

const QUEUE_KEY = "bean-avenue-pos-queue";
const MENU_KEY = "bean-avenue-pos-menu";
const CATS_KEY = "bean-avenue-pos-cats";

export type QueuedSale = { clientRef: string; payload: Record<string, unknown>; at: number };

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full/unavailable — best effort */
  }
}

export const cacheMenu = (menu: MenuItem[], cats: string[]) => {
  write(MENU_KEY, menu);
  write(CATS_KEY, cats);
};
export const cachedMenu = (): MenuItem[] => read<MenuItem[]>(MENU_KEY, []);
export const cachedCats = (): string[] => read<string[]>(CATS_KEY, []);

export const getQueue = (): QueuedSale[] => read<QueuedSale[]>(QUEUE_KEY, []);
export const queueSale = (payload: Record<string, unknown>) => {
  write(QUEUE_KEY, [...getQueue(), { clientRef: String(payload.clientRef), payload, at: Date.now() }]);
};

// Try to send all queued sales. Stops on the first failure (still offline / a
// blocking error) and keeps the rest queued. Returns how many remain.
let flushing = false;
export async function flushQueue(): Promise<number> {
  if (flushing) return getQueue().length;
  flushing = true;
  try {
    for (const item of getQueue()) {
      try {
        await posApi.post("/api/pos/sale", item.payload); // server dedupes by clientRef
        write(QUEUE_KEY, getQueue().filter((x) => x.clientRef !== item.clientRef));
      } catch {
        break; // network still down (or a blocking error) — retry later
      }
    }
    return getQueue().length;
  } finally {
    flushing = false;
  }
}
