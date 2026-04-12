import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthContextValue, AuthUser } from './types';
import { AuthContext } from './context';

function getCsrfToken(): string | null {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith('XSRF-TOKEN='));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/users/me', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setUser({ id: data.id, username: data.username, role: data.role ?? 'USER' });
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(() => {
    window.location.href = '/sso/initiate';
  }, []);

  const logout = useCallback(async () => {
    const csrfToken = getCsrfToken();
    await fetch('/logout', {
      method: 'POST',
      credentials: 'include',
      headers: csrfToken ? { 'X-XSRF-TOKEN': csrfToken } : {},
    }).catch(() => {});
    window.location.href = '/';
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: !!user,
      isLoading,
      user,
      login,
      logout,
    }),
    [user, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
