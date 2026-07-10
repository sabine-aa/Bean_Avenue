const TOKEN_KEY = "bean-avenue-admin-token";
const CUSTOMER_TOKEN_KEY = "bean-avenue-customer-token";
const POS_TOKEN_KEY = "bean-avenue-pos-token";

// In dev the Vite proxy forwards /api to the local backend; in production the
// frontend (Cloudflare) calls the deployed API directly.
const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  (import.meta.env.DEV ? "" : "https://beanavenue-api.onrender.com");

/** Resolve a possibly-relative "/api/..." path (e.g. uploaded images) to an
 *  absolute URL against the API host. Full URLs and non-/api paths pass through. */
export const resolveApiUrl = (path: string): string =>
  path && path.startsWith("/api/") ? API_BASE + path : path;

function readToken(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeToken(key: string, token: string | null) {
  try {
    if (token) localStorage.setItem(key, token);
    else localStorage.removeItem(key);
  } catch {
    /* storage unavailable — session-only auth */
  }
}

export const getToken = () => readToken(TOKEN_KEY);
export const setToken = (token: string | null) => writeToken(TOKEN_KEY, token);
export const getCustomerToken = () => readToken(CUSTOMER_TOKEN_KEY);
export const setCustomerToken = (token: string | null) => writeToken(CUSTOMER_TOKEN_KEY, token);
export const getPosToken = () => readToken(POS_TOKEN_KEY);
export const setPosToken = (token: string | null) => writeToken(POS_TOKEN_KEY, token);

/** True if the JWT is missing or past its expiry (decoded client-side, no verify). */
function isExpired(token: string | null): boolean {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return typeof payload.exp === "number" && payload.exp * 1000 < Date.now();
  } catch {
    return false; // can't decode — let the server be the judge
  }
}

export const isAdminTokenValid = () => !isExpired(getToken());
export const isPosTokenValid = () => !isExpired(getPosToken());

// When an admin call comes back 401, the session is gone — clear it and bounce
// to the login screen (only from inside the admin area).
function handleAdminUnauthorized() {
  setToken(null);
  if (
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/admin") &&
    !window.location.pathname.includes("/admin/login")
  ) {
    window.location.assign("/admin/login");
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function makeRequest(tokenGetter: () => string | null, onUnauthorized?: () => void) {
  return async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = tokenGetter();
    const res = await fetch(API_BASE + path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
    if (!res.ok) {
      if (res.status === 401) onUnauthorized?.();
      let message = "Something went wrong.";
      try {
        const body = await res.json();
        message = body.error ?? message;
      } catch {
        /* non-JSON error body */
      }
      throw new ApiError(res.status, message);
    }
    return res.json();
  };
}

function makeApi(tokenGetter: () => string | null, onUnauthorized?: () => void) {
  const request = makeRequest(tokenGetter, onUnauthorized);
  return {
    get: <T>(path: string) => request<T>(path),
    post: <T>(path: string, body: unknown) =>
      request<T>(path, { method: "POST", body: JSON.stringify(body) }),
    patch: <T>(path: string, body: unknown) =>
      request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
    delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  };
}

// `api` carries the admin token (used by the public site too — it just sends no
// token when none is stored). `customerApi` carries the logged-in customer token.
export const api = makeApi(getToken, handleAdminUnauthorized);
export const customerApi = makeApi(getCustomerToken, () => setCustomerToken(null));
export const posApi = makeApi(getPosToken, () => setPosToken(null));

export const money = (n: number) => `$${n.toFixed(2)}`;

export const formatHour = (h: number) => {
  const hour = ((h % 24) + 24) % 24; // normalize so 24 → midnight, not "12 PM"
  const period = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:00 ${period}`;
};

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
