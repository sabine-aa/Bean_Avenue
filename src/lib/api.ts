const TOKEN_KEY = "bean-avenue-admin-token";
const CUSTOMER_TOKEN_KEY = "bean-avenue-customer-token";

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

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function makeRequest(tokenGetter: () => string | null) {
  return async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = tokenGetter();
    const res = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
    if (!res.ok) {
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

function makeApi(tokenGetter: () => string | null) {
  const request = makeRequest(tokenGetter);
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
export const api = makeApi(getToken);
export const customerApi = makeApi(getCustomerToken);

export const money = (n: number) => `$${n.toFixed(2)}`;

export const formatHour = (h: number) => {
  const period = h >= 12 ? "PM" : "AM";
  const display = h % 12 === 0 ? 12 : h % 12;
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
