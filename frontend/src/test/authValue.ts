import { vi } from 'vitest';
import type { AuthContextValue, AuthUser } from '@/auth/types';

export function authValue(overrides?: Partial<AuthContextValue>): AuthContextValue {
  return {
    isAuthenticated: false,
    isLoading: false,
    user: null,
    login: vi.fn(),
    logout: vi.fn(),
    ...overrides,
  };
}

export function loggedInAuthValue(
  user: Partial<AuthUser>,
  overrides?: Partial<AuthContextValue>,
): AuthContextValue {
  return authValue({
    isAuthenticated: true,
    user: {
      id: 'u1',
      username: 'user1',
      role: 'USER',
      ...user,
    },
    ...overrides,
  });
}
