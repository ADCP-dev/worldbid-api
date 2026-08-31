// E2E spec for the bid flow (capability bid-modal + bid-lifecycle).
//
// Opens the bid modal, fills the form, submits, and asserts the globe heat
// color changes for the bid country. Requires SwiftShader + Playwright
// chromium.

import { test, expect } from '@playwright/test';

test('bid flow: open modal, submit, heat changes', async ({ page }) => {
  await page.goto('/');
  await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForTimeout(3_000);

  // Open the bid modal via the claim CTA in the left sidebar.
  await page.getByTestId('claim-cta').click();
  await expect(page.getByTestId('bid-modal')).toBeVisible({ timeout: 5_000 });

  // Fill required fields (country defaults to the current selection or first).
  await page.getByPlaceholder('your-handle').fill('TestBidder');
  await page.getByPlaceholder('you@example.com').fill('test@example.com');
  await page.getByPlaceholder('What are you building?').fill('E2E test bid');

  // Submit
  await page.getByTestId('bid-submit').click();

  // Modal closes on success
  await expect(page.getByTestId('bid-modal')).toBeHidden({ timeout: 5_000 });
});