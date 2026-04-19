import { test, expect } from '@playwright/test';
import { mockUnauthenticated, mockAuthenticated } from './helpers';

/**
 * Verifies that protected routes correctly redirect unauthenticated users to /login,
 * and that authenticated users can access them.
 */

test.describe('unauthenticated access', () => {
  test.beforeEach(async ({ page }) => {
    await mockUnauthenticated(page);
  });

  test('playlists page redirects to login', async ({ page }) => {
    await page.goto('/playlists');
    await expect(page).toHaveURL('/login');
  });
});

test.describe('authenticated access', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticated(page);
  });

  test('authenticated user can access playlists page', async ({ page }) => {
    await page.route('/api/playlists**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
    );
    await page.goto('/playlists');
    await expect(page).toHaveURL('/playlists');
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('authenticated user sees home page without login prompt', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/');
    await expect(page).not.toHaveURL(/\/login/);
  });
});