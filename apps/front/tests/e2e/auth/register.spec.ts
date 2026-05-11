import { test, expect } from '@playwright/test';

test.describe('Register', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('form', { timeout: 10000 });
  });

  test('TC1: formulario de registro visible con campos requeridos', async ({ page }) => {
    await expect(page.locator('input[type="text"]').first()).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('TC2: navegación a login desde registro', async ({ page }) => {
    const loginLink = page.locator('a[href*="login"]').first();
    await expect(loginLink).toBeVisible();
    await loginLink.click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('TC3: registro fallido con email inválido', async ({ page }) => {
    await page.locator('input[type="text"]').first().fill('Test');
    await page.locator('input[type="email"]').fill('no-es-email');
    await page.locator('input[type="password"]').first().fill('123');
    await page.locator('button[type="submit"]').click();

    const feedback = page.locator('[data-sonner-toast], .text-error, [role="alert"]').first();
    await expect(feedback).toBeVisible({ timeout: 10000 });
  });
});
