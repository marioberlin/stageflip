// packages/runtimes/audience/src/clips/word-cloud/render-e2e.test.ts
// T-467 — §13 (CLAUDE.md "structural-extension specs require end-to-end
// render verification") evidence for the word-cloud clip family.
//
// This test mounts the clip's static-fallback path through the T-454
// `StaticFallbackRenderer` with the spec snapshot (5 weighted words)
// and asserts on observable DOM (per spec):
//   - five spans rendered in weight-desc order;
//   - max-weight span ("design", weight 12) has font-size 50px;
//   - min-weight span ("video", weight 3) has font-size 23px
//     (14 + (3/12) * 36);
//   - intermediate spans scale linearly;
//   - total label reads "18 submissions";
//   - each span carries `data-word` + `data-weight` attributes;
//   - DOM-level pixel-bucket proxies: non-zero font sizes + non-blank
//     panel chrome.
//
// **Verification posture per CLAUDE.md §13 option 1**: this is a
// real-render integration test driving the clip through the renderer
// with a known snapshot and asserting on observable DOM.

/**
 * @vitest-environment happy-dom
 */

import type { WordCloudAggregation } from '@stageflip/audience-contract';
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// React 19's `act(...)` requires opt-in flag in non-RTL test envs.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { staticFallbackRenderer } from '../../static-fallback.js';
import './index.js'; // side-effect: registers the clip

const SNAPSHOT: WordCloudAggregation = {
  kind: 'word-cloud',
  words: [
    { word: 'design', weight: 12 },
    { word: 'react', weight: 9 },
    { word: 'rust', weight: 7 },
    { word: 'audio', weight: 4 },
    { word: 'video', weight: 3 },
  ],
  totalSubmissions: 18,
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

describe('§13 render-e2e (T-467) — word-cloud', () => {
  it('drives the clip through staticFallbackRenderer + asserts on DOM', async () => {
    const result = staticFallbackRenderer.render({
      provenance: {
        provider: 'stub',
        sessionId: 's-1',
        snapshotFrame: 0,
        voterCountAtCapture: 18,
        capturedAt: '2026-05-12T00:00:00.000Z',
        snapshotPolicy: 'final',
        clipKind: 'word-cloud',
        aggregation: SNAPSHOT,
      },
      context: {
        width: 800,
        height: 600,
      },
      emitLossFlag: () => {},
    });
    expect(result.state).toBe('rendered');
    if (result.state !== 'rendered') return;

    await act(async () => {
      root.render(result.output as React.ReactElement);
    });

    // ----- DOM assertion 1: five spans present in weight-desc order -----
    const spans = Array.from(
      host.querySelectorAll('[data-testid^="word-cloud-word-"]'),
    ) as HTMLElement[];
    expect(spans).toHaveLength(5);
    expect(spans[0]?.getAttribute('data-word')).toBe('design');
    expect(spans[1]?.getAttribute('data-word')).toBe('react');
    expect(spans[2]?.getAttribute('data-word')).toBe('rust');
    expect(spans[3]?.getAttribute('data-word')).toBe('audio');
    expect(spans[4]?.getAttribute('data-word')).toBe('video');

    // ----- DOM assertion 2: data-weight attributes carry the integer weight -----
    expect(spans[0]?.getAttribute('data-weight')).toBe('12');
    expect(spans[1]?.getAttribute('data-weight')).toBe('9');
    expect(spans[2]?.getAttribute('data-weight')).toBe('7');
    expect(spans[3]?.getAttribute('data-weight')).toBe('4');
    expect(spans[4]?.getAttribute('data-weight')).toBe('3');

    // ----- DOM assertion 3: span text matches the word verbatim -----
    expect(spans[0]?.textContent).toBe('design');
    expect(spans[1]?.textContent).toBe('react');
    expect(spans[2]?.textContent).toBe('rust');
    expect(spans[3]?.textContent).toBe('audio');
    expect(spans[4]?.textContent).toBe('video');

    // ----- DOM assertion 4: font-size proportionality -----
    // max-weight (12) → 14 + (12/12) * 36 = 50px.
    expect(spans[0]?.style.fontSize).toBe('50px');
    // weight 9 → 14 + (9/12) * 36 = 41px.
    expect(spans[1]?.style.fontSize).toBe('41px');
    // weight 7 → 14 + (7/12) * 36 = 35px.
    expect(spans[2]?.style.fontSize).toBe('35px');
    // weight 4 → 14 + (4/12) * 36 = 26px.
    expect(spans[3]?.style.fontSize).toBe('26px');
    // weight 3 → 14 + (3/12) * 36 = 23px.
    expect(spans[4]?.style.fontSize).toBe('23px');

    // ----- DOM assertion 5: total submissions label -----
    const total = host.querySelector('[data-testid="word-cloud-total"]');
    expect(total?.textContent).toBe('18 submissions');
    expect(total?.getAttribute('data-total-submissions')).toBe('18');

    // ----- §13 pixel-bucket proxy: every span has non-zero font size -----
    let nonBlankSpans = 0;
    for (const s of spans) {
      const fs = s.style.fontSize;
      // Parse "23px" → 23; any positive number counts.
      const px = Number.parseFloat(fs);
      if (Number.isFinite(px) && px > 0) nonBlankSpans += 1;
    }
    expect(nonBlankSpans).toBe(5);

    // ----- §13 pixel-bucket proxy: root has non-default chrome -----
    const rootEl = host.querySelector('[data-stageflip-clip="word-cloud"]') as HTMLElement | null;
    expect(rootEl).not.toBeNull();
    expect(rootEl?.style.getPropertyValue('background').length).toBeGreaterThan(0);
    expect(rootEl?.style.getPropertyValue('color').length).toBeGreaterThan(0);
  });

  it('renders the optional prompt above the cloud when supplied', async () => {
    const result = staticFallbackRenderer.render({
      provenance: {
        provider: 'stub',
        sessionId: 's-2',
        snapshotFrame: 0,
        voterCountAtCapture: 18,
        capturedAt: '2026-05-12T00:00:00.000Z',
        snapshotPolicy: 'final',
        clipKind: 'word-cloud',
        aggregation: SNAPSHOT,
      },
      context: { width: 400, height: 400, prompt: 'Describe today' },
      emitLossFlag: () => {},
    });
    if (result.state !== 'rendered') throw new Error('expected rendered');
    await act(async () => {
      root.render(result.output as React.ReactElement);
    });
    const prompt = host.querySelector('[data-testid="word-cloud-prompt"]');
    expect(prompt?.textContent).toBe('Describe today');
  });

  it('idle shape: empty words renders the "Waiting…" placeholder', async () => {
    const result = staticFallbackRenderer.render({
      provenance: {
        provider: 'stub',
        sessionId: 's-3',
        snapshotFrame: 0,
        voterCountAtCapture: 0,
        capturedAt: '2026-05-12T00:00:00.000Z',
        snapshotPolicy: 'final',
        clipKind: 'word-cloud',
        aggregation: {
          kind: 'word-cloud',
          words: [],
          totalSubmissions: 0,
        },
      },
      context: { width: 400, height: 200 },
      emitLossFlag: () => {},
    });
    if (result.state !== 'rendered') throw new Error('expected rendered');
    await act(async () => {
      root.render(result.output as React.ReactElement);
    });
    const rootEl = host.querySelector('[data-stageflip-clip="word-cloud"]');
    expect(rootEl?.getAttribute('data-state')).toBe('waiting');
    const waiting = host.querySelector('[data-testid="word-cloud-waiting"]');
    expect(waiting?.textContent).toBe('Waiting for submissions…');
  });
});
