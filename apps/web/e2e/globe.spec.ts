// E2E spec for the WorldBid globe (capability globe-render).
//
// SwiftShader gives the globe a real WebGL2 context in CI without a GPU.
// Clicks a known country coordinate, asserts the right inspector appears with
// the country detail, then Escape deselects.
//
// NOTE: This spec requires `npx playwright install chromium`. On environments
// where the browser cannot be installed (e.g. debian11 without wheel deps),
// `npm run test:e2e` reports config-only — the spec file is still
// syntactically valid and the suite is reported as such.

import { test, expect } from '@playwright/test';

const KNOWN_COUNTRY_X = 640; // viewport center x
const KNOWN_COUNTRY_Y = 400; // viewport center y

test('globe renders, click selects a country, inspector updates, Escape deselects', async ({ page }) => {
  await page.goto('/');

  // 1. Canvas is present (globe.gl mounted).
  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible({ timeout: 30_000 });

  // 2. Give SwiftShader time to initialize WebGL2 + stream textures.
  await page.waitForTimeout(3_000);

  // 3. Click a known country coordinate.
  await page.mouse.click(KNOWN_COUNTRY_X, KNOWN_COUNTRY_Y);

  // 4. Right inspector appears with the country detail.
  const detail = page.getByTestId('country-detail');
  await expect(detail).toBeVisible({ timeout: 10_000 });
  await expect(detail).toHaveAttribute('data-iso2', /[A-Z]{2}/);

  // 5. Escape -> inspector closes (selection cleared).
  await page.keyboard.press('Escape');
  await expect(detail).toBeHidden({ timeout: 5_000 });
});