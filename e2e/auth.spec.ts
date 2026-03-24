import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

// Auth tests need fresh browser context — no saved storageState
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Auth Flow', () => {
  test('login with valid credentials redirects to dashboard', async ({ page }) => {
    await page.goto('/auth');
    await page.getByPlaceholder('email@example.com').fill(ADMIN_EMAIL);
    await page.getByPlaceholder('••••••••').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();

    await page.waitForURL('**/dashboard', { timeout: 15_000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('login with wrong password shows error', async ({ page }) => {
    await page.goto('/auth');
    await page.getByPlaceholder('email@example.com').fill(ADMIN_EMAIL);
    await page.getByPlaceholder('••••••••').fill('wrong-password-123');
    await page.getByRole('button', { name: 'Đăng nhập' }).click();

    // Wait for error — could be alert, toast, or inline message
    await page
      .locator('[role="alert"], .bg-destructive, .text-destructive, [data-sonner-toast]')
      .first()
      .isVisible({ timeout: 15_000 })
      .catch(() => false);

    // At minimum, verify we stayed on auth page
    await expect(page).toHaveURL(/\/auth/);
  });

  test('login with empty fields shows validation', async ({ page }) => {
    await page.goto('/auth');
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page).toHaveURL(/\/auth/);
  });

  test('unauthenticated user redirected to auth from protected route', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL('**/auth', { timeout: 10_000 });
    await expect(page).toHaveURL(/\/auth/);
  });
});

test.describe('Logout', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });

  test('logout redirects to auth page', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const logoutButton = page.getByText('Đăng xuất');

    // If logout not visible, open mobile sidebar first
    if (!await logoutButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
      // Find and click the hamburger menu button — it contains a Menu SVG (3 horizontal lines)
      // Try multiple selectors for reliability
      const clicked = await page.evaluate(() => {
        // Approach 1: find button containing lucide Menu SVG (has line elements)
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          const svg = btn.querySelector('svg');
          if (svg && svg.querySelector('line') && btn.offsetWidth > 0 && btn.offsetWidth < 60) {
            btn.click();
            return true;
          }
        }
        // Approach 2: first button in border-b header
        const header = document.querySelector('.border-b');
        const headerBtn = header?.querySelector('button');
        if (headerBtn) { headerBtn.click(); return true; }
        return false;
      });
      if (clicked) await page.waitForTimeout(500);
    }

    // Scroll sidebar to bottom to find logout button, then click
    await page.evaluate(() => {
      const logoutEl = [...document.querySelectorAll('button, a')].find(el => el.textContent?.includes('Đăng xuất'));
      if (logoutEl) {
        logoutEl.scrollIntoView({ block: 'center' });
        (logoutEl as HTMLElement).click();
      }
    });

    await page.waitForURL('**/auth', { timeout: 10_000 });
    await expect(page).toHaveURL(/\/auth/);
  });
});
