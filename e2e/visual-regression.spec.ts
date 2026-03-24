import { test, expect } from '@playwright/test';

test.describe('Visual Regression — Desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('auth page screenshot', async ({ page }) => {
    // Fresh context for auth page
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('auth-desktop.png', {
      fullPage: true,
    });
  });

  test('dashboard screenshot', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_000);
    await expect(page).toHaveScreenshot('dashboard-desktop.png', {
      fullPage: true,
      mask: [
        page.locator('time'),
        page.locator('[data-testid="timestamp"]'),
      ],
    });
  });

  test('flash sale page screenshot', async ({ page }) => {
    await page.goto('/flash-sale');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_000);
    await expect(page).toHaveScreenshot('flash-sale-desktop.png', {
      fullPage: true,
    });
  });

  test('settings profile screenshot', async ({ page }) => {
    await page.goto('/settings/profile');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_000);
    await expect(page).toHaveScreenshot('settings-profile-desktop.png', {
      fullPage: true,
    });
  });
});

test.describe('Visual Regression — Mobile', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('auth page mobile screenshot', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('auth-mobile.png', { fullPage: true });
  });

  test('dashboard mobile screenshot', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_000);
    await expect(page).toHaveScreenshot('dashboard-mobile.png', {
      fullPage: true,
      mask: [page.locator('time')],
    });
  });
});
