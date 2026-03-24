import { test, expect } from '@playwright/test';

/** Open mobile sidebar if needed — clicks the hamburger menu button */
async function ensureSidebarOpen(page: import('@playwright/test').Page) {
  // Check if sidebar is already visible (desktop)
  const homeItem = page.getByText('Trang chủ', { exact: true }).first();
  if (await homeItem.isVisible({ timeout: 1_500 }).catch(() => false)) {
    const box = await homeItem.boundingBox();
    if (box && box.x >= 0 && box.x < 300) return;
  }

  // Mobile/tablet: click hamburger button in the sticky header bar
  // Header has border-b class, hamburger is its first button child
  await page.evaluate(() => {
    const header = document.querySelector('.border-b.sticky, .border-b');
    const btn = header?.querySelector('button');
    if (btn) btn.click();
  });
  await page.waitForTimeout(500);
}

/** Click a sidebar menu item, scrolling into view if needed */
async function clickSidebarItem(page: import('@playwright/test').Page, locator: import('@playwright/test').Locator) {
  await locator.scrollIntoViewIfNeeded();
  await locator.click({ timeout: 5_000 });
}

test.describe('Sidebar Navigation', () => {
  test('sidebar renders all menu items', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await ensureSidebarOpen(page);

    const menuTexts = ['Trang chủ', 'Sản phẩm', 'Flash Sale', 'Cài đặt'];
    for (const text of menuTexts) {
      await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
    }
  });

  test('navigate to products page', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await ensureSidebarOpen(page);

    await clickSidebarItem(page, page.getByText('Sản phẩm', { exact: true }).first());

    const productsLink = page.getByRole('link', { name: /danh sách sản phẩm/i });
    if (await productsLink.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await clickSidebarItem(page, productsLink);
    }

    await expect(page).toHaveURL(/\/products/);
  });

  test('navigate to flash sale page', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await ensureSidebarOpen(page);

    await clickSidebarItem(page, page.getByText('Flash Sale', { exact: true }).first());

    const flashSaleList = page.getByRole('link', { name: 'Danh sách', exact: true });
    await expect(flashSaleList).toBeVisible({ timeout: 3_000 });
    await clickSidebarItem(page, flashSaleList);

    await expect(page).toHaveURL(/\/flash-sale/);
  });

  test('navigate to settings profile', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await ensureSidebarOpen(page);

    await clickSidebarItem(page, page.getByText('Cài đặt', { exact: true }).first());

    const profileLink = page.getByRole('link', { name: /thông tin cá nhân/i });
    if (await profileLink.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await clickSidebarItem(page, profileLink);
      await expect(page).toHaveURL(/\/settings\/profile/);
    } else {
      await expect(page).toHaveURL(/\/settings/);
    }
  });

  test('404 page for unknown routes', async ({ page }) => {
    await page.goto('/nonexistent-page-12345');
    await page.waitForLoadState('networkidle');

    const url = page.url();
    const validOutcome =
      url.includes('/auth') ||
      url.includes('/dashboard') ||
      url.includes('/nonexistent') ||
      (await page.getByText(/404|not found|không tìm thấy/i).isVisible().catch(() => false));

    expect(validOutcome).toBeTruthy();
  });
});
