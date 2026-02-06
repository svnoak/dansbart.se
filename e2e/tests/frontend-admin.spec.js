/**
 * E2E frontend tests: admin app at /admin/ (login + panel).
 */

import { test, expect } from '@playwright/test';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || process.env.API_ADMIN_PASSWORD || '123';

test.describe('Admin app (/admin/)', () => {
  test('admin page loads without uncaught console errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/admin/');
    await page.waitForLoadState('networkidle').catch(() => {});
    expect(errors).toEqual([]);
  });

  test('shows login form when not authenticated', async ({ page }) => {
    await page.goto('/admin/');
    await page.waitForLoadState('domcontentloaded');
    await page.getByPlaceholder('Admin password').waitFor({ state: 'visible', timeout: 15000 });
    await expect(page.getByPlaceholder('Admin password')).toBeVisible();
  });

  test('password login succeeds and shows admin panel', async ({ page }) => {
    await page.goto('/admin/');
    await page.waitForLoadState('domcontentloaded');
    await page.getByPlaceholder('Admin password').waitFor({ state: 'visible', timeout: 15000 });
    await page.getByPlaceholder('Admin password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /Sign in/ }).click();

    const adminPanel = page.locator('#admin-panel');
    await adminPanel.waitFor({ state: 'visible', timeout: 15000 });
    await expect(adminPanel).toBeVisible();
  });

  test('admin panel has ingest section after login', async ({ page }) => {
    await page.goto('/admin/');
    await page.waitForLoadState('domcontentloaded');
    await page.getByPlaceholder('Admin password').waitFor({ state: 'visible', timeout: 15000 });
    await page.getByPlaceholder('Admin password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /Sign in/ }).click();
    const adminPanel = page.locator('#admin-panel');
    await adminPanel.waitFor({ state: 'visible', timeout: 15000 });

    await page.getByRole('button', { name: /Ingest/ }).click();

    const ingestHeading = page.getByText('Ingest Spotify Content');
    await ingestHeading.waitFor({ state: 'visible', timeout: 15000 });
    await expect(ingestHeading).toBeVisible();
  });
});
