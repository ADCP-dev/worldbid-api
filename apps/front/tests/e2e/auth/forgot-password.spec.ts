import { test, expect } from '@playwright/test';

test.describe('Forgot Password', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/forgot-password');
    await page.waitForLoadState('networkidle');
  });

  test('TC1: formulario de recuperación visible', async ({ page }) => {
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('TC2: enviar recuperación con email vacío muestra error', async ({ page }) => {
    if (await page.locator('button[type="submit"]').isVisible()) {
      await page.locator('button[type="submit"]').click();
      const feedback = page.locator('[data-sonner-toast], .text-error, [role="alert"]').first();
      await expect(feedback).toBeVisible({ timeout: 10000 });
    }
  });

  test('TC3: navegación a login desde forgot-password', async ({ page }) => {
    const loginLink = page.locator('a[href*="login"]').first();
    if (await loginLink.isVisible()) {
      await loginLink.click();
      await expect(page).toHaveURL(/\/login/);
    }
  });
});
