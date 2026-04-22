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
  // coordinates. Scope to the canvas plane so filmstrip thumbnails
  // (which reuse the same element ids) don't trigger strict-mode
  // multi-match errors.
  const plane = page.getByTestId('slide-canvas-plane');
  await expect(plane.getByTestId('element-seed-title')).toBeVisible();
  await expect(plane.getByTestId('element-seed-title')).toHaveText('StageFlip.Slide');
  await expect(plane.getByTestId('element-seed-subtitle')).toBeVisible();
  await expect(plane.getByTestId('element-seed-subtitle')).toHaveText('Walking skeleton');
});

test('clicking a seeded element mounts the selection overlay + handles (T-123b)', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('slide-canvas-plane').getByTestId('element-seed-title').click();

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
  await page.getByTestId('slide-canvas-plane').getByTestId('element-seed-title').dblclick();

  await expect(page.getByTestId('inline-text-editor-seed-title')).toBeVisible();
  await expect(page.getByTestId('text-toolbar-seed-title')).toBeVisible();
  await expect(page.getByTestId('text-toolbar-bold-seed-title')).toBeVisible();
  await expect(page.getByTestId('text-toolbar-italic-seed-title')).toBeVisible();
  await expect(page.getByTestId('text-toolbar-underline-seed-title')).toBeVisible();
  await expect(page.getByTestId('text-toolbar-link-seed-title')).toBeVisible();
});

test('timeline panel renders with ruler + scrubber + readout (T-126)', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('timeline-panel')).toBeVisible();
  await expect(page.getByTestId('timeline-ruler')).toBeVisible();
  await expect(page.getByTestId('timeline-scrubber')).toBeVisible();
  await expect(page.getByTestId('timeline-readout')).toContainText('frame 0');
});

test('command palette opens via toolbar button + runs New slide (T-127)', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('command-palette')).toHaveCount(0);
  await page.getByTestId('palette-open').click();
  await expect(page.getByTestId('command-palette')).toBeVisible();

  // Filter + run "New slide" — doc gains a third slide.
  await expect(page.getByTestId('filmstrip-slide-slide-1')).toBeVisible();
  await page.getByTestId('command-palette-input').fill('new slide');
  await expect(page.getByTestId('command-palette-item-slide.new')).toBeVisible();
  await page.getByTestId('command-palette-item-slide.new').click();
  await expect(page.getByTestId('command-palette')).toHaveCount(0);
  // Third slide's id is generated; assert via rail item count.
  await expect(page.locator('[data-testid^="filmstrip-slide-"]')).toHaveCount(3);
});

test('filmstrip renders a thumbnail per slide; clicking swaps active (T-124)', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('filmstrip')).toBeVisible();

  await expect(page.getByTestId('filmstrip-slide-slide-0')).toBeVisible();
  await expect(page.getByTestId('filmstrip-slide-slide-1')).toBeVisible();

  await expect(page.getByTestId('filmstrip-slide-slide-0')).toHaveAttribute('data-active', 'true');
  await expect(page.getByTestId('slide-canvas')).toHaveAttribute('data-active-slide-id', 'slide-0');

  await page.getByTestId('filmstrip-slide-slide-1').click();
  await expect(page.getByTestId('filmstrip-slide-slide-1')).toHaveAttribute('data-active', 'true');
  await expect(page.getByTestId('slide-canvas')).toHaveAttribute('data-active-slide-id', 'slide-1');
});

test('clicking the mode toggle swaps the canvas for the slide player (T-123d)', async ({
  page,
}) => {
  await page.goto('/');
  const toggle = page.getByTestId('mode-toggle');
  await expect(toggle).toHaveAttribute('data-mode', 'edit');
  await expect(page.getByTestId('slide-canvas')).toBeVisible();

  await toggle.click();
  await expect(toggle).toHaveAttribute('data-mode', 'preview');
  await expect(page.getByTestId('slide-player')).toBeVisible();
  // Canvas is unmounted while previewing.
  await expect(page.getByTestId('slide-canvas')).toBeHidden();

  await toggle.click();
  await expect(toggle).toHaveAttribute('data-mode', 'edit');
  await expect(page.getByTestId('slide-canvas')).toBeVisible();
});

test('AI copilot opens via header toggle, submits a prompt, renders the Phase 7 placeholder (T-128)', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('ai-copilot')).toHaveCount(0);
  const toggle = page.getByTestId('copilot-toggle');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(page.getByTestId('ai-copilot')).toBeVisible();
  await expect(page.getByTestId('ai-message-system')).toBeVisible();

  const input = page.getByTestId('ai-copilot-input');
  await input.fill('Add a title slide');
  await page.getByTestId('ai-copilot-send').click();
  await expect(page.getByTestId('ai-message-user')).toHaveText('Add a title slide');
  // Assistant reply references Phase 7 because the route returns 501.
  await expect(page.getByTestId('ai-message-assistant')).toContainText('Phase 7');

  // Esc closes the sidebar.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('ai-copilot')).toHaveCount(0);
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
