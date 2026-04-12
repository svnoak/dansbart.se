/**
 * Shared API client for E2E tests.
 * Runs against a Spring instance with SPRING_PROFILES_ACTIVE=local (no auth required).
 */

const API_URL = process.env.API_URL || 'http://localhost:8000';

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

export { API_URL, apiFetch };
