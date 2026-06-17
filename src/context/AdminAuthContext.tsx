import { createContext, ReactNode, useContext, useMemo, useState } from "react";
import { api, isAdminTokenValid, setToken } from "../lib/api";

interface AdminAuthValue {
  isAuthed: boolean;
  adminName: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthed, setIsAuthed] = useState(() => isAdminTokenValid());
  const [adminName, setAdminName] = useState<string | null>(null);

  const value = useMemo<AdminAuthValue>(
    () => ({
      isAuthed,
      adminName,
      login: async (email, password) => {
        const res = await api.post<{ token: string; name: string }>("/api/auth/login", {
          email,
          password,
        });
        setToken(res.token);
        setAdminName(res.name);
        setIsAuthed(true);
      },
      logout: () => {
        setToken(null);
        setIsAuthed(false);
        setAdminName(null);
      },
    }),
    [isAuthed, adminName]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used inside AdminAuthProvider");
  return ctx;
}
