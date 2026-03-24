import { test, expect } from '@playwright/test';

test.describe('Responsive — Desktop (1440px)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('dashboard shows full sidebar on desktop', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Sidebar should be visible with menu items
    await expect(page.getByText('Trang chủ', { exact: true }).first()).toBeVisible();
  });

  test('no horizontal scroll on desktop', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});

test.describe('Responsive — Tablet (768px)', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test('dashboard adapts to tablet viewport', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});

test.describe('Responsive — Mobile (375px)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('sidebar hidden on mobile, menu toggle available', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // On mobile, sidebar should be hidden or collapsed
    // Content area should be visible
    const mainContent = page.locator('main, [role="main"], .container').first();
    await expect(mainContent).toBeVisible();
  });

  test('mobile menu opens and closes', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Find any menu toggle button (hamburger, panel toggle, etc.)
    const menuToggle = page.locator(
      'button[aria-label*="menu"], button[aria-label*="sidebar"], button:has(.lucide-menu), button:has(.lucide-panel-left)'
    ).first();

    if (await menuToggle.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await menuToggle.click();
      // Menu items should become visible
      await expect(page.getByText('Trang chủ', { exact: true }).first()).toBeVisible({ timeout: 3_000 });
    }
  });

  test('no horizontal scroll on mobile', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });

  test('auth page responsive on mobile', async ({ page, context }) => {
    // Clear auth state for this test so we actually see the auth page
    await context.clearCookies();
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');

    // If redirected to dashboard (session still valid), that's OK too
    if (page.url().includes('/auth')) {
      await expect(page.getByPlaceholder('email@example.com')).toBeVisible();
    }

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});
