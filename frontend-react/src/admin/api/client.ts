const TOKEN_KEY = 'dansbart-admin-token';

/**
 * Auth-aware fetch wrapper for admin API calls.
 * Injects Authorization header and handles 401 auto-logout.
 */
export function adminFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers }).then((res) => {
    if (res.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = '/admin/login';
    }
    return res;
  });
}

/**
 * Returns RequestInit with auth headers for use with generated API client.
 */
export function adminRequestOptions(extra?: RequestInit): RequestInit {
  const token = localStorage.getItem(TOKEN_KEY);
  return {
    ...extra,
    headers: {
      ...(extra?.headers as Record<string, string> | undefined),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
}
