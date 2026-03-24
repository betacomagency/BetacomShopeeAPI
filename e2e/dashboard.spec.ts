import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test('dashboard loads with content cards', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Dashboard should display — shop data or connect prompt
    const hasQuickActions = await page.getByText(/thao tác nhanh/i).isVisible().catch(() => false);
    const hasOverview = await page.getByText(/tổng quan/i).first().isVisible().catch(() => false);
    const hasConnectPrompt = await page.getByText(/kết nối shop|bắt đầu/i).isVisible().catch(() => false);

    expect(hasQuickActions || hasOverview || hasConnectPrompt).toBeTruthy();
  });

  test('quick action navigates to products', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Quick actions are in "Thao tác nhanh" — buttons or links with product icon
    const quickActionSection = page.getByText('Thao tác nhanh');
    await expect(quickActionSection).toBeVisible({ timeout: 5_000 });

    // Click the "Sản phẩm" quick action button/link
    const productAction = page.locator('a[href*="products"], button:has-text("Sản phẩm")').last();
    await productAction.click();
    await expect(page).toHaveURL(/\/products/);
  });

  test('quick action navigates to flash sale', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const flashSaleAction = page.locator('a[href*="flash-sale"], button:has-text("Flash Sale")').last();
    await flashSaleAction.click();
    await expect(page).toHaveURL(/\/flash-sale/);
  });
});
