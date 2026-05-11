import { test, expect } from '@playwright/test';

test.describe('Login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="login-email"]', { timeout: 10000 });
  });

  test('TC1: login exitoso con credenciales válidas', async ({ page }) => {
    await page.locator('[data-testid="login-email"]').fill('admin@example.com');
    await page.locator('[data-testid="login-password"]').fill('secret');
    await page.locator('[data-testid="login-submit"]').click();

    // Esperar redirección fuera de /login
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 15000,
    });
    expect(page.url()).not.toContain('/login');
  });

  test('TC2: login fallido con credenciales inválidas', async ({ page }) => {
    await page.locator('[data-testid="login-email"]').fill('fake@test.com');
    await page.locator('[data-testid="login-password"]').fill('wrongpass');
    await page.locator('[data-testid="login-submit"]').click();

    // Esperar feedback de error
    const errorIndicator = page.locator('[data-sonner-toast]').first();
    await expect(errorIndicator).toBeVisible({ timeout: 10000 });

    // Seguir en login
    await expect(page).toHaveURL(/\/login/);
  });

  test('TC3: validación de campos vacíos', async ({ page }) => {
    await page.locator('[data-testid="login-submit"]').click();

    const errorIndicator = page.locator('[data-sonner-toast]').first();
    await expect(errorIndicator).toBeVisible({ timeout: 10000 });
  });

  test('TC4: navegación a registro desde login', async ({ page }) => {
    const registerLink = page.locator('a[href*="register"]').first();
    await expect(registerLink).toBeVisible();
    await registerLink.click();
    await expect(page).toHaveURL(/\/register/);
  });
});
