import { useCallback, useEffect, useState } from 'react';
import { assistantApi } from '../services/assistantApi';
import type { AuthUser } from '../types';

/** Current account (a guest account is created on first visit). */
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setUser((await assistantApi.me()).user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = async (username: string, password: string) => setUser((await assistantApi.login(username, password)).user);
  const register = async (username: string, password: string, displayName?: string) => setUser((await assistantApi.register(username, password, displayName)).user);
  const logout = async () => {
    await assistantApi.logout();
    await refresh();
  };

  return { user, loading, login, register, logout, refresh };
}
