import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/services';
import { setUnauthorizedHandler } from '../api/http';
import type { User } from '../types';

interface AuthCtx { user: User | null; loading: boolean; isAdmin: boolean; login: (e: string, p: string) => Promise<void>; logout: () => Promise<void>; setUser: (u: User) => void }
const Ctx = createContext<AuthCtx>(null!);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  useEffect(() => {
    setUnauthorizedHandler(() => { setUser(null); qc.clear(); });
    authApi.me().then((r) => setUser(r.user)).catch(() => setUser(null)).finally(() => setLoading(false));
  }, [qc]);

  const value = useMemo<AuthCtx>(() => ({
    user, loading, isAdmin: user?.role === 'admin', setUser,
    login: async (email, password) => { qc.clear(); setUser((await authApi.login(email, password)).user); },
    logout: async () => { await authApi.logout().catch(() => undefined); qc.clear(); setUser(null); },
  }), [user, loading, qc]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
