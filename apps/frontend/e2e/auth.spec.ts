import { test, expect } from '@playwright/test';

/**
 * Smoke test for the critical authentication flow.
 * Requires a running backend with seed data (admin@uni.kz / Admin123!).
 *
 * Uses the demo-credentials quick-fill button to avoid hand-typing passwords
 * and to verify that helper still works end-to-end.
 */
test.describe('Auth flow', () => {
  test('login page renders + form validation rejects empty submit', async ({ page }) => {
    await page.goto('/login');

    // Hero copy is in lp.welcomeBack — verify the page mounted by anchoring on
    // brand text which is part of every render path.
    await expect(page.getByText(/UniLMS/).first()).toBeVisible();

    // Submit with empty fields — Zod should refuse and show inline error
    await page.getByRole('button', { name: /access|sign in|enter/i }).click();
    await expect(page.getByText(/email is required|valid email/i).first()).toBeVisible({ timeout: 2000 });
  });

  test('login page rejects too-short password', async ({ page }) => {
    await page.goto('/login');

    await page.locator('#email').fill('admin@uni.kz');
    await page.locator('#pw').fill('short'); // < 8 chars
    await page.getByRole('button', { name: /access|sign in|enter/i }).click();

    await expect(page.getByText(/at least 8/i).first()).toBeVisible({ timeout: 2000 });
  });

  test('admin login via demo credentials → lands on dashboard', async ({ page }) => {
    await page.goto('/login');

    // Use the admin demo-credentials button. If seed didn't run, this test
    // legitimately fails — that is a real bug worth surfacing.
    const adminButton = page.locator('button:has-text("admin@uni.kz")');
    await adminButton.click();
    await page.getByRole('button', { name: /access|sign in|enter/i }).click();

    await page.waitForURL('**/dashboard', { timeout: 10_000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
