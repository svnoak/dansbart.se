/**
 * E2E frontend tests: admin app at /admin/
 * Requires SPRING_PROFILES_ACTIVE=local (auth bypassed — no OIDC redirect).
 */

import { test, expect } from '@playwright/test';

test.describe('Admin app (/admin/)', () => {
  test('admin page loads without uncaught console errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/admin/');
    await page.waitForLoadState('networkidle').catch(() => {});
    expect(errors).toEqual([]);
  });

  test('admin library page is accessible in local profile', async ({ page }) => {
    await page.goto('/admin/library');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});
