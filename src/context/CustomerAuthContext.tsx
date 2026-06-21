import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { customerApi, getCustomerToken, setCustomerToken } from "../lib/api";
import type { LoyaltyAccount } from "../types";

export type AuthChannel = "phone" | "email";

export interface OtpTarget {
  channel: AuthChannel;
  phone?: string;
  countryCode?: string;
  email?: string;
}

interface OtpRequestResult {
  resendInSeconds?: number;
  expiresInSeconds?: number;
  devCode?: string; // dev only — lets you test without a real SMS/email provider
}

interface CustomerAuthValue {
  account: LoyaltyAccount | null;
  loading: boolean;
  requestOtp: (target: OtpTarget) => Promise<OtpRequestResult>;
  verifyOtp: (target: OtpTarget, code: string) => Promise<void>;
  linkRequest: (target: OtpTarget) => Promise<OtpRequestResult>;
  linkVerify: (target: OtpTarget, code: string) => Promise<void>;
  updateProfile: (details: { name?: string; birthday?: string }) => Promise<void>;
  claimBirthday: () => Promise<void>;
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
      setCustomerToken(null);
      setAccount(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const value = useMemo<CustomerAuthValue>(
    () => ({
      account,
      loading,
      requestOtp: (target) => customerApi.post<OtpRequestResult>("/api/auth/otp/request", target),
      verifyOtp: async (target, code) => {
        const res = await customerApi.post<{ token: string; account: LoyaltyAccount }>(
          "/api/auth/otp/verify",
          { ...target, code }
        );
        setCustomerToken(res.token);
        setAccount(res.account);
      },
      linkRequest: (target) => customerApi.post<OtpRequestResult>("/api/auth/link/request", target),
      linkVerify: async (target, code) => {
        setAccount(await customerApi.post<LoyaltyAccount>("/api/auth/link/verify", { ...target, code }));
      },
      updateProfile: async (details) => {
        setAccount(await customerApi.patch<LoyaltyAccount>("/api/loyalty/me", details));
      },
      claimBirthday: async () => {
        setAccount(await customerApi.post<LoyaltyAccount>("/api/loyalty/birthday/claim", {}));
      },
      logout: () => {
        setCustomerToken(null);
        setAccount(null);
      },
      refresh,
    }),
    [account, loading, refresh]
  );

  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>;
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error("useCustomerAuth must be used inside CustomerAuthProvider");
  return ctx;
}
