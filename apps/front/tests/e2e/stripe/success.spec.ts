import { test, expect } from '@playwright/test';

test.describe('Stripe — Página de éxito', () => {
  test('TC1: página de éxito renderiza correctamente', async ({ page }) => {
    await page.goto('/success?session_id=cs_test_123');
    await page.waitForLoadState('networkidle');

    // Debe mostrar mensaje de éxito
    await expect(page.locator('text=¡Pago exitoso!')).toBeVisible({ timeout: 5000 });

    // Debe mostrar el session ID
    await expect(page.locator('text=cs_test_123').first()).toBeVisible();

    // Botón para ir a suscripción
    const link = page.locator('a[href*="plan"]');
    await expect(link).toBeVisible();
    await expect(link).toHaveText(/suscripción/i);
  });

  test('TC2: enlace redirige a la página de plan', async ({ page }) => {
    await page.goto('/success?session_id=cs_test_123');
    await page.waitForLoadState('networkidle');

    const link = page.locator('a[href*="plan"]');
    await link.click();
    // Debe redirigir a plan (o a login si no autenticado)
    await expect(page).toHaveURL(/\/(plan|login)/, { timeout: 10000 });
  });
});
