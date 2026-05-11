import { test, expect } from '@playwright/test';

test.describe('Protected Routes', () => {
  test('TC1: /app/settings redirige a login sin autenticación', async ({ page }) => {
    await page.goto('/app/settings');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('TC2: home pública carga sin login', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // La home no debe redirigir a login
    await expect(page).not.toHaveURL(/\/login/);

    // Debe tener contenido (no página en blanco)
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});
