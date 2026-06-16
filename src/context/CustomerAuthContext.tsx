import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { customerApi, getCustomerToken, setCustomerToken } from "../lib/api";
import type { LoyaltyAccount } from "../types";

interface AuthResponse {
  token: string;
  account: LoyaltyAccount;
}

interface CustomerAuthValue {
  account: LoyaltyAccount | null;
  loading: boolean;
  signup: (name: string, phone: string, password: string) => Promise<void>;
  login: (phone: string, password: string) => Promise<void>;
  updateProfile: (details: { name?: string; email?: string }) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const CustomerAuthContext = createContext<CustomerAuthValue | null>(null);

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<LoyaltyAccount | null>(null);
  const [loading, setLoading] = useState(() => Boolean(getCustomerToken()));

  const refresh = useCallback(async () => {
    if (!getCustomerToken()) return;
    try {
      setAccount(await customerApi.get<LoyaltyAccount>("/api/loyalty/me"));
    } catch {
      // Token invalid/expired — clear it.
      setCustomerToken(null);
      setAccount(null);
    }
  }, []);

  // Restore the session on first load if a token is stored.
  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const handleAuth = useCallback((res: AuthResponse) => {
    setCustomerToken(res.token);
    setAccount(res.account);
  }, []);

  const value = useMemo<CustomerAuthValue>(
    () => ({
      account,
      loading,
      signup: async (name, phone, password) => {
        handleAuth(await customerApi.post<AuthResponse>("/api/loyalty/signup", { name, phone, password }));
      },
      login: async (phone, password) => {
        handleAuth(await customerApi.post<AuthResponse>("/api/loyalty/login", { phone, password }));
      },
      updateProfile: async (details) => {
        setAccount(await customerApi.patch<LoyaltyAccount>("/api/loyalty/me", details));
      },
      logout: () => {
        setCustomerToken(null);
        setAccount(null);
      },
      refresh,
    }),
    [account, loading, handleAuth, refresh]
  );

  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>;
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error("useCustomerAuth must be used inside CustomerAuthProvider");
  return ctx;
}
