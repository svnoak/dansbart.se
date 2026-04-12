/**
 * Unified HTTP client used by all Orval-generated API calls.
 *
 * Authentication is handled via the BFF pattern:
 *   - The Spring backend manages the OIDC session and issues an httpOnly SESSION cookie
 *   - `credentials: 'include'` ensures the cookie is sent on every request automatically
 *   - No tokens are ever stored or read in JavaScript
 *
 * CSRF protection uses the double-submit cookie pattern:
 *   - Spring sets a readable XSRF-TOKEN cookie
 *   - This client reads it and sends X-XSRF-TOKEN on all mutating requests
 */
export const httpClient = async <T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> => {
  const headers = new Headers(init?.headers);
  headers.set('X-Trace-Id', crypto.randomUUID());

  const method = (init?.method ?? 'GET').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) headers.set('X-XSRF-TOKEN', csrfToken);
  }

  const res = await fetch(input, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (res.status === 401 || res.status === 403) {
    window.location.href = '/login';
    return {} as T;
  }

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }

  const body = [204, 205, 304].includes(res.status) ? null : await res.text();
  return (body ? JSON.parse(body) : {}) as T;
};

/**
 * Raw fetch variant for API calls that need manual response handling.
 * Includes the session cookie and CSRF token automatically.
 * Use this where you need access to `res.ok`, status codes, or streaming.
 */
export function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set('X-Trace-Id', crypto.randomUUID());

  const method = (init?.method ?? 'GET').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) headers.set('X-XSRF-TOKEN', csrfToken);
  }

  return fetch(input, { ...init, headers, credentials: 'include' }).then((res) => {
    if (res.status === 401 || res.status === 403) {
      window.location.href = '/login';
    }
    return res;
  });
}

function getCsrfToken(): string | null {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith('XSRF-TOKEN='));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}
