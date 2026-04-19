import type { Page } from '@playwright/test';

/**
 * Mocks all backend API calls so tests can run without a live backend.
 * /api/users/me returns 401 (unauthenticated by default).
 */
export async function mockUnauthenticated(page: Page) {
  await page.route('/api/users/me', (route) =>
    route.fulfill({ status: 401, body: '' }),
  );
  await mockPublicApis(page);
}

/**
 * Mocks /api/users/me as an authenticated USER and public APIs.
 */
export async function mockAuthenticated(page: Page, user = { id: '1', username: 'testuser', role: 'USER' }) {
  await page.route('/api/users/me', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) }),
  );
  await mockPublicApis(page);
}

async function mockPublicApis(page: Page) {
  await page.route('/api/stats', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ totalTracks: 1234, coveragePercent: 80, lastAdded: '2025-01-15T12:00:00Z' }),
    }),
  );

  await page.route('/api/discovery/by-style', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
  );

  await page.route('/api/artists**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], total: 0 }) }),
  );

  await page.route('/api/albums**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], total: 0 }) }),
  );

  await page.route('/api/tracks**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], total: 0 }) }),
  );

  await page.route('/api/styles**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
  );

  await page.route('/api/discovery**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
  );

  await page.route('/api/analytics**', (route) =>
    route.fulfill({ status: 204, body: '' }),
  );
}
