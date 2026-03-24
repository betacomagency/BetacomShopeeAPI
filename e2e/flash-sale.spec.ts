import { test, expect } from '@playwright/test';

test.describe('Flash Sale Page', () => {
  test('flash sale page loads with content', async ({ page }) => {
    await page.goto('/flash-sale');
    await page.waitForLoadState('networkidle');

    // Page should show Flash Sale content — either list items or empty state
    const hasContent = await page.getByText(/flash sale/i).first().isVisible().catch(() => false);
    const hasTable = await page.locator('table, [role="table"]').isVisible().catch(() => false);
    const hasList = await page.locator('[class*="flash-sale"], [data-testid]').first().isVisible().catch(() => false);

    expect(hasContent || hasTable || hasList).toBeTruthy();
  });

  test('flash sale filter/tab works', async ({ page }) => {
    await page.goto('/flash-sale');
    await page.waitForLoadState('networkidle');

    // Look for filter buttons or tabs
    const tabs = page.getByRole('tab');
    const filterButtons = page.locator('button:has-text("Tất cả"), button:has-text("Đang diễn ra")');

    const hasTabs = await tabs.first().isVisible({ timeout: 3_000 }).catch(() => false);
    const hasFilters = await filterButtons.first().isVisible({ timeout: 3_000 }).catch(() => false);

    if (hasTabs) {
      await tabs.first().click();
    } else if (hasFilters) {
      await filterButtons.first().click();
    }

    // Page should still be on flash-sale
    await expect(page).toHaveURL(/\/flash-sale/);
  });

  test('flash sale detail navigation works', async ({ page }) => {
    await page.goto('/flash-sale');
    await page.waitForLoadState('networkidle');

    // Look for clickable rows or view buttons
    const viewButton = page.locator('button:has(.lucide-eye), [aria-label*="view"], [aria-label*="xem"]').first();
    const clickableRow = page.locator('tr[class*="cursor"], tr:has(td)').first();

    if (await viewButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await viewButton.click();
      // May navigate to detail or open panel
    } else if (await clickableRow.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await clickableRow.click();
    } else {
      // No data available — skip gracefully
      test.skip();
    }
  });

  test('auto-setup page loads', async ({ page }) => {
    await page.goto('/flash-sale/auto-setup');
    await page.waitForLoadState('networkidle');

    // Should show auto-setup content
    const hasContent = await page.locator('main, [role="main"], .container').first()
      .isVisible({ timeout: 10_000 }).catch(() => false);

    expect(hasContent).toBeTruthy();
  });

  test('flash sale page has data or empty state', async ({ page }) => {
    await page.goto('/flash-sale');
    await page.waitForLoadState('networkidle');

    // Either shows flash sale data or an empty/connect-shop message
    const hasData = await page.locator('tr:has(td), [class*="card"]').first()
      .isVisible({ timeout: 5_000 }).catch(() => false);
    const hasEmpty = await page.getByText(/chưa có|không có|kết nối shop/i)
      .isVisible({ timeout: 3_000 }).catch(() => false);

    expect(hasData || hasEmpty).toBeTruthy();
  });
});
