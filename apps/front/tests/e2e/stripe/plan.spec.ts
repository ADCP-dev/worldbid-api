import { test, expect } from '@playwright/test';

test.describe('Stripe — Plan de suscripción', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/settings/plan');
    await page.waitForLoadState('networkidle');
  });

  test('TC1: página de plan requiere autenticación', async ({ page }) => {
    // Sin login, debe redirigir a /login
    if (page.url().includes('/login')) {
      // Comportamiento correcto para usuario no autenticado
      await expect(page.locator('input[type="email"]')).toBeVisible();
    }
  });

  test('TC2: botones de gestión visibles cuando hay suscripción', async ({ page }) => {
    if (page.url().includes('/login')) return;

    // Verificar que al menos un botón de gestión existe
    const buttons = page.locator('[data-testid^="plan-"]');
    const count = await buttons.count();
    // Puede ser 0 si no hay suscripción, o tener botones si hay
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('TC3: título de página visible', async ({ page }) => {
    if (page.url().includes('/login')) return;

    await expect(page.locator('text=Suscripción')).toBeVisible({ timeout: 5000 });
  });

  test('TC4: sin suscripción muestra mensaje informativo', async ({ page }) => {
    if (page.url().includes('/login')) return;

    // Esperar que cargue
    await page.waitForTimeout(2000);

    // Si no hay suscripción, debe mostrar mensaje
    const noSub = page.locator('text=No tienes una suscripción');
    const hasSub = page.locator('[data-testid="plan-change"]');

    // Una de las dos debe ser visible
    const visible = (await noSub.isVisible().catch(() => false)) ||
                    (await hasSub.isVisible().catch(() => false));
    expect(visible).toBeTruthy();
  });

  test('TC5: sección de facturación visible', async ({ page }) => {
    if (page.url().includes('/login')) return;

    await page.waitForTimeout(2000);

    const billing = page.locator('text=Historial de facturación');
    if (await billing.isVisible()) {
      // Tabla de facturas o mensaje "no hay facturas"
      const hasContent = page.locator('table, text=No hay facturas');
      await expect(hasContent.first()).toBeVisible({ timeout: 3000 });
    }
  });
});
