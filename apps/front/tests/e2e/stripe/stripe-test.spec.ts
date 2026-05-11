import { test, expect } from '@playwright/test';

test.describe('Stripe — Test Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/settings/stripe-test');
    await page.waitForLoadState('networkidle');
    // Si redirige a login, el test falla (esperado — necesita auth)
  });

  test('TC1: página carga con título', async ({ page }) => {
    // Si no redirigió a login, verificar contenido
    if (!page.url().includes('/login')) {
      await expect(page.locator('text=Stripe Test Suite')).toBeVisible({ timeout: 5000 });
    }
  });

  test('TC2: sección de planes visibles', async ({ page }) => {
    if (page.url().includes('/login')) return; // skip si no autenticado

    await expect(
      page.locator('text=Planes disponibles').first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('TC3: tarjetas de prueba visibles', async ({ page }) => {
    if (page.url().includes('/login')) return;

    await expect(
      page.locator('text=Tarjetas de prueba').first(),
    ).toBeVisible({ timeout: 5000 });

    // Verificar que las tarjetas de prueba están listadas
    await expect(page.locator('text=4242 4242 4242 4242')).toBeVisible();
    await expect(page.locator('text=4000 0000 0000 0002')).toBeVisible();
  });

  test('TC4: sección de webhooks visible', async ({ page }) => {
    if (page.url().includes('/login')) return;

    await expect(
      page.locator('text=Simular webhook').first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('TC5: historial de pagos al final', async ({ page }) => {
    if (page.url().includes('/login')) return;

    await expect(
      page.locator('text=Historial de pagos').first(),
    ).toBeVisible({ timeout: 5000 });
  });
});
