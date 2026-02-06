/**
 * Shared API client for E2E tests.
 * Uses API_URL and ADMIN_PASSWORD from env (root .env when run via run-e2e.sh).
 */

const API_URL = process.env.API_URL || 'http://localhost:8000';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || process.env.API_ADMIN_PASSWORD || '123';

async function apiFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  return res;
}

async function getAdminToken() {
  const res = await apiFetch('/api/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password: ADMIN_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Admin login failed: ${res.status}`);
  const body = await res.json();
  return body.token;
}

function apiFetchWithAuth(token) {
  return (path, options = {}) =>
    apiFetch(path, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });
}

export { API_URL, ADMIN_PASSWORD, apiFetch, getAdminToken, apiFetchWithAuth };
