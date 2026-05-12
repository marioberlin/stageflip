// apps/audience-join/e2e/voter-flow.spec.ts
// T-456 — Playwright smoke for the voter landing page. Stubs the
// apps/api `/v1/audience/sessions/:id/join` response via `page.route`
// so the spec runs without the real backend. Asserts the connection
// banner reaches a terminal state (the in-app stub provider closes
// gracefully → the banner shows "disconnected").

import { expect, test } from '@playwright/test';

test('index page renders the join form', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('audience-join-index')).toBeVisible();
  await expect(page.getByTestId('join-form')).toBeVisible();
  await expect(page.getByTestId('join-form-session-id')).toBeVisible();
  await expect(page.getByTestId('join-form-submit')).toBeVisible();
});

test('voter route mints a token via /v1/audience/sessions/:id/join then surfaces connection state', async ({
  page,
}) => {
  await page.route('**/v1/audience/sessions/*/join', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ voterToken: 'tok-stub', sessionId: 'demo-session' }),
    });
  });

  await page.goto('/demo-session');
  await expect(page.getByTestId('voter-app')).toBeVisible();
  // The in-app stub provider closes the iterator gracefully, so the
  // banner ends up in `disconnected` after the join succeeds.
  const banner = page.getByTestId('connection-status-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toHaveAttribute('data-state', 'disconnected', { timeout: 10_000 });
});
