// packages/runtimes/audience/src/clips/audience-ai-prompt/render-e2e.test.ts
// T-471 — §13 (CLAUDE.md "structural-extension specs require end-to-end
// render verification") evidence for the audience-ai-prompt clip family.
//
// This test mounts the clip's static-fallback path through the T-454
// `StaticFallbackRenderer` with three snapshots (one per phase) and
// asserts on observable DOM:
//   - **Final phase** (spec snapshot): `<video>` element with the
//     correct `data-cache-key` + `data-modality` + winner text + full
//     prompt feed + "3 prompts" total.
//   - **Voting phase**: no `<video>` / `<audio>` / `<img>`; full feed
//     present; root data-state = "voting".
//   - **Generation phase**: "Generating with AI…" placeholder present;
//     no asset element.
//
// **Verification posture per CLAUDE.md §13 option 1**: this is a
// real-render integration test driving the clip through the renderer
// with a known snapshot and asserting on observable DOM. The §13 anchor
// is that the generated-asset element is materialised in the DOM and
// carries the cacheKey — the structural extension being verified.

/**
 * @vitest-environment happy-dom
 */

import type { AudienceAiPromptAggregation } from '@stageflip/audience-contract';
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// React 19's `act(...)` requires opt-in flag in non-RTL test envs.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { staticFallbackRenderer } from '../../static-fallback.js';
import './index.js'; // side-effect: registers the clip

const PROMPTS = [
  { id: 'p1', text: 'A sunset over mountains', upvotes: 18 },
  { id: 'p2', text: 'A cat in space', upvotes: 12 },
  { id: 'p3', text: 'Northern lights', upvotes: 8 },
];

const FINAL_SNAPSHOT: AudienceAiPromptAggregation = {
  kind: 'audience-ai-prompt',
  prompts: PROMPTS,
  winnerPromptId: 'p1',
  generatedAssetCacheKey: 'cache://video/abc123',
};

const VOTING_SNAPSHOT: AudienceAiPromptAggregation = {
  kind: 'audience-ai-prompt',
  prompts: PROMPTS,
  winnerPromptId: null,
  generatedAssetCacheKey: null,
};

const GENERATING_SNAPSHOT: AudienceAiPromptAggregation = {
  kind: 'audience-ai-prompt',
  prompts: PROMPTS,
  winnerPromptId: 'p1',
  generatedAssetCacheKey: null,
};

let host: HTMLElement;
let root: Root;

beforeEach(() => {
  while (document.body.firstChild !== null) {
    document.body.removeChild(document.body.firstChild);
  }
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  while (document.body.firstChild !== null) {
    document.body.removeChild(document.body.firstChild);
  }
});

describe('§13 render-e2e (T-471) — audience-ai-prompt', () => {
  it('final phase: drives the spec snapshot through staticFallbackRenderer + asserts on DOM', async () => {
    const result = staticFallbackRenderer.render({
      provenance: {
        provider: 'stub',
        sessionId: 's-1',
        snapshotFrame: 0,
        voterCountAtCapture: 38,
        capturedAt: '2026-05-12T00:00:00.000Z',
        snapshotPolicy: 'final',
        clipKind: 'audience-ai-prompt',
        aggregation: FINAL_SNAPSHOT,
      },
      context: {
        width: 800,
        height: 600,
        prompt: 'What should we generate next?',
        targetModality: 'video-gen',
      },
      emitLossFlag: () => {},
    });
    expect(result.state).toBe('rendered');
    if (result.state !== 'rendered') return;

    await act(async () => {
      root.render(result.output as React.ReactElement);
    });

    // ----- DOM assertion 1: root present with the final state -----
    const rootEl = host.querySelector(
      '[data-stageflip-clip="audience-ai-prompt"]',
    ) as HTMLElement | null;
    expect(rootEl).not.toBeNull();
    expect(rootEl?.getAttribute('data-state')).toBe('final');

    // ----- DOM assertion 2: phase marker -----
    const state = host.querySelector('[data-testid="aip-state"]');
    expect(state?.textContent).toBe('final');

    // ----- DOM assertion 3: winner banner with "A sunset over mountains" -----
    const winner = host.querySelector('[data-testid="aip-winner"]');
    expect(winner?.textContent).toBe('A sunset over mountains');

    // ----- DOM assertion 4: <video> element with the cacheKey attributes -----
    // This is the structural-extension §13 anchor: the generated asset
    // element is materialised in the DOM and addresses the cacheKey.
    const asset = host.querySelector('[data-testid="aip-asset"]') as HTMLElement | null;
    expect(asset).not.toBeNull();
    expect(asset?.tagName).toBe('VIDEO');
    expect(asset?.getAttribute('data-cache-key')).toBe('cache://video/abc123');
    expect(asset?.getAttribute('data-modality')).toBe('video-gen');
    expect(asset?.getAttribute('src')).toBe('cache://video/abc123');

    // ----- DOM assertion 5: full prompt feed (3 entries) -----
    expect(host.querySelector('[data-testid="aip-prompt-0"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="aip-prompt-1"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="aip-prompt-2"]')).not.toBeNull();

    // ----- DOM assertion 6: total label = "3 prompts" -----
    const total = host.querySelector('[data-testid="aip-total"]');
    expect(total?.textContent).toBe('3 prompts');
    expect(total?.getAttribute('data-total-prompts')).toBe('3');
  });

  it('voting phase: no asset element; full feed; state="voting"', async () => {
    const result = staticFallbackRenderer.render({
      provenance: {
        provider: 'stub',
        sessionId: 's-2',
        snapshotFrame: 0,
        voterCountAtCapture: 12,
        capturedAt: '2026-05-12T00:00:00.000Z',
        snapshotPolicy: 'final',
        clipKind: 'audience-ai-prompt',
        aggregation: VOTING_SNAPSHOT,
      },
      context: {
        width: 800,
        height: 600,
        prompt: 'What should we generate next?',
        targetModality: 'video-gen',
      },
      emitLossFlag: () => {},
    });
    if (result.state !== 'rendered') throw new Error('expected rendered');
    await act(async () => {
      root.render(result.output as React.ReactElement);
    });
    const rootEl = host.querySelector('[data-stageflip-clip="audience-ai-prompt"]');
    expect(rootEl?.getAttribute('data-state')).toBe('voting');
    expect(host.querySelector('[data-testid="aip-state"]')?.textContent).toBe('voting');
    // No asset element in any form.
    expect(host.querySelector('[data-testid="aip-asset"]')).toBeNull();
    expect(host.querySelectorAll('video, audio, img').length).toBe(0);
    // Feed still rendered.
    expect(host.querySelector('[data-testid="aip-prompt-0"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="aip-total"]')?.textContent).toBe('3 prompts');
  });

  it('generation phase: "Generating with AI…" placeholder; no asset element', async () => {
    const result = staticFallbackRenderer.render({
      provenance: {
        provider: 'stub',
        sessionId: 's-3',
        snapshotFrame: 0,
        voterCountAtCapture: 38,
        capturedAt: '2026-05-12T00:00:00.000Z',
        snapshotPolicy: 'final',
        clipKind: 'audience-ai-prompt',
        aggregation: GENERATING_SNAPSHOT,
      },
      context: {
        width: 800,
        height: 600,
        prompt: 'What should we generate next?',
        targetModality: 'video-gen',
      },
      emitLossFlag: () => {},
    });
    if (result.state !== 'rendered') throw new Error('expected rendered');
    await act(async () => {
      root.render(result.output as React.ReactElement);
    });
    const rootEl = host.querySelector('[data-stageflip-clip="audience-ai-prompt"]');
    expect(rootEl?.getAttribute('data-state')).toBe('generating');
    expect(host.querySelector('[data-testid="aip-state"]')?.textContent).toBe('generating');
    const placeholder = host.querySelector('[data-testid="aip-generating"]');
    expect(placeholder?.textContent).toContain('Generating with AI…');
    // Winner text shown.
    expect(host.querySelector('[data-testid="aip-winner"]')?.textContent).toBe(
      'A sunset over mountains',
    );
    // No asset element until the cacheKey arrives.
    expect(host.querySelector('[data-testid="aip-asset"]')).toBeNull();
    expect(host.querySelectorAll('video, audio, img').length).toBe(0);
  });
});
