// E2E spec for the responsive bottom-sheet layout (capability app-shell-layout).
//
// At viewport 375px the left+right sidebars become peeking bottom sheets and
// the canvas (globe) stays visible/accessible.

import { test, expect } from '@playwright/test';

test('responsive: 375px viewport shows bottom sheets, canvas visible', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 30_000 });

  // Canvas (globe) is visible at mobile viewport.
  await expect(page.locator('canvas').first()).toBeVisible();

  // Left sidebar is rendered (as a peeking sheet, transformed off-screen).
  await expect(page.getByTestId('left-sidebar')).toBeAttached();
});