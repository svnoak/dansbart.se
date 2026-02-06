/**
 * E2E frontend tests: main app (Vue) at /.
 */

import { test, expect } from '@playwright/test';

test.describe('Main app (/)', () => {
  test('homepage loads without uncaught console errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await page.waitForLoadState('networkidle').catch(() => {});
    expect(errors).toEqual([]);
  });

  test('main app content is present', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const app = page.locator('#app').first();
    await expect(app).toBeVisible({ timeout: 10000 });
  });

  test('no critical API request failures', async ({ page }) => {
    const failed = [];
    page.on('requestfailed', (req) => {
      const url = req.url();
      if (url.includes('/api/')) failed.push({ url, failure: req.failure()?.errorText });
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle').catch(() => {});
    const critical = failed.filter(
      (f) => f.failure && !f.failure.includes('canceled') && !f.failure.includes('aborted')
    );
    expect(critical).toEqual([]);
  });

  test('discovery or main content loads', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    // Nav or main area visible
    const navOrMain = page.locator('nav, main, [role="main"], .container').first();
    await expect(navOrMain).toBeVisible({ timeout: 15000 });
  });
});
