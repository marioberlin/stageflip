// apps/stageflip-slide/e2e/walking-skeleton.spec.ts
// Smoke spec: the Next.js skeleton boots, mounts <EditorShell>, renders
// a blank canvas, and the agent execute route returns the documented
// 501. If this spec goes red, T-121 family + T-122 scaffold has broken
// at the integration boundary.

import { expect, test } from '@playwright/test';

test('walking skeleton renders the editor app + blank canvas', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('editor-app')).toBeVisible();
  await expect(page.getByTestId('editor-header')).toContainText('Walking skeleton');
  const canvas = page.getByTestId('blank-canvas');
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('data-active-slide-id', 'slide-0');
});

test('agent execute stub returns a structured 501', async ({ request }) => {
  const response = await request.post('/api/agent/execute', {
    data: { tool: 'noop', args: {} },
  });
  expect(response.status()).toBe(501);
  const body = (await response.json()) as { error: string; phase: string };
  expect(body.error).toBe('not_implemented');
  expect(body.phase).toBe('phase-7');
});

test('agent execute stub rejects GET with 405', async ({ request }) => {
  const response = await request.get('/api/agent/execute');
  expect(response.status()).toBe(405);
});
