// apps/stageflip-slide/e2e/walking-skeleton.spec.ts
// Smoke spec: the Next.js app boots, mounts <EditorShell>, renders the
// slide canvas with its seeded elements, and the agent stub returns
// the documented 501. If this spec goes red, T-121 family + T-122 +
// T-123a has broken at the integration boundary.

import { expect, test } from '@playwright/test';

test('app renders the editor shell + slide canvas with seeded elements', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('editor-app')).toBeVisible();
  await expect(page.getByTestId('editor-header')).toContainText('Walking skeleton');

  const canvas = page.getByTestId('slide-canvas');
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('data-active-slide-id', 'slide-0');

  // Seeded elements are rendered into the canvas plane at canvas-space
  // coordinates. Asserting visibility + text content is enough to prove
  // the atom → canvas pipeline is wired.
  await expect(page.getByTestId('element-seed-title')).toBeVisible();
  await expect(page.getByTestId('element-seed-title')).toHaveText('StageFlip.Slide');
  await expect(page.getByTestId('element-seed-subtitle')).toBeVisible();
  await expect(page.getByTestId('element-seed-subtitle')).toHaveText('Walking skeleton');
});

test('clicking a seeded element mounts the selection overlay + handles (T-123b)', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('element-seed-title').click();

  const overlay = page.getByTestId('selection-overlay-seed-title');
  await expect(overlay).toBeVisible();
  await expect(page.getByTestId('selection-handle-top-left-seed-title')).toBeVisible();
  await expect(page.getByTestId('selection-handle-bottom-right-seed-title')).toBeVisible();
  await expect(page.getByTestId('selection-rotate-seed-title')).toBeVisible();
});

test('double-clicking a text element opens the inline editor + toolbar (T-123c)', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('element-seed-title').dblclick();

  await expect(page.getByTestId('inline-text-editor-seed-title')).toBeVisible();
  await expect(page.getByTestId('text-toolbar-seed-title')).toBeVisible();
  await expect(page.getByTestId('text-toolbar-bold-seed-title')).toBeVisible();
  await expect(page.getByTestId('text-toolbar-italic-seed-title')).toBeVisible();
  await expect(page.getByTestId('text-toolbar-underline-seed-title')).toBeVisible();
  await expect(page.getByTestId('text-toolbar-link-seed-title')).toBeVisible();
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
