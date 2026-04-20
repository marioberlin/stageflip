// tests/e2e/smoke.spec.ts
// Playwright pipeline smoke test. Proves the config resolves, Chromium
// launches, and assertions work. No real app is involved — Phase 6 replaces
// this suite with editor-oriented E2E scenarios (T-136).

import { expect, test } from '@playwright/test';

test('pipeline smoke: data URL renders heading', async ({ page }) => {
  await page.goto('data:text/html,<h1>StageFlip</h1>');
  await expect(page.locator('h1')).toHaveText('StageFlip');
});

test('pipeline smoke: basic DOM assertion', async ({ page }) => {
  await page.setContent('<button id="go">Go</button><p data-testid="out"></p>');
  await page.locator('#go').click();
  // The button click is a no-op; assert the element exists and has expected text.
  await expect(page.locator('#go')).toHaveText('Go');
  await expect(page.locator('[data-testid=out]')).toBeEmpty();
});
