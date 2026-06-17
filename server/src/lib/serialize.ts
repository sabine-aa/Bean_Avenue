// SQLite has no JSON column type, so array/object fields are stored as JSON
// strings. These helpers convert DB rows into the shape the frontend expects
// (parsed arrays) on the way out, and stringify on the way in.

export function parseArr(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export const toJson = (value: unknown): string => JSON.stringify(value ?? []);

export function outMenuItem<T extends Record<string, unknown>>(m: T) {
  return { ...m, options: parseArr(m.options), tags: parseArr(m.tags) };
}

export function outRoom<T extends Record<string, unknown>>(r: T) {
  return {
    ...r,
    amenities: parseArr(r.amenities),
    rules: parseArr(r.rules),
    images: parseArr(r.images),
  };
}

export function outOrder<T extends { items?: Record<string, unknown>[] }>(o: T) {
  return {
    ...o,
    items: (o.items ?? []).map((i) => ({
      ...i,
      selectedOptions: parseArr(i.selectedOptions),
      addons: parseArr(i.addons),
    })),
  };
}

export function outBooking<T extends { room?: Record<string, unknown> | null }>(b: T) {
  return { ...b, room: b.room ? outRoom(b.room) : b.room };
}
