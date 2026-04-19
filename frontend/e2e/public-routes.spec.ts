import { test, expect } from '@playwright/test';
import { mockUnauthenticated } from './helpers';

/**
 * Verifies that public pages load correctly for unauthenticated users and do NOT
 * redirect to /login. This guards against regressions where API changes or
 * accidental route wrapping causes public pages to require authentication.
 */

test.beforeEach(async ({ page }) => {
  await mockUnauthenticated(page);
});

test('home page loads without redirecting to login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'Bibliotek' })).toBeVisible();
});

test('search page loads without redirecting to login', async ({ page }) => {
  await page.goto('/search');
  await expect(page).toHaveURL('/search');
  await expect(page).not.toHaveURL(/\/login/);
});

test('artists page loads without redirecting to login', async ({ page }) => {
  await page.goto('/artists');
  await expect(page).toHaveURL('/artists');
  await expect(page).not.toHaveURL(/\/login/);
});

test('albums page loads without redirecting to login', async ({ page }) => {
  await page.goto('/albums');
  await expect(page).toHaveURL('/albums');
  await expect(page).not.toHaveURL(/\/login/);
});

test('classify page loads without redirecting to login', async ({ page }) => {
  await page.goto('/classify');
  await expect(page).toHaveURL('/classify');
  await expect(page).not.toHaveURL(/\/login/);
});

test('about page loads without redirecting to login', async ({ page }) => {
  await page.goto('/about');
  await expect(page).toHaveURL('/about');
  await expect(page).not.toHaveURL(/\/login/);
});

test('login page is accessible', async ({ page }) => {
  await page.goto('/login');
  await expect(page).toHaveURL('/login');
});

test('home page shows stats when api responds', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('1\u00a0234')).toBeVisible();
  await expect(page.getByText('låtar')).toBeVisible();
});