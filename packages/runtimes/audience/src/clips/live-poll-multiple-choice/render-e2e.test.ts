// packages/runtimes/audience/src/clips/live-poll-multiple-choice/render-e2e.test.ts
// T-461 — §13 (CLAUDE.md "structural-extension specs require end-to-end
// render verification") evidence for the live-poll-multiple-choice
// clip family.
//
// This test mounts the clip's static-fallback path through the T-454
// `StaticFallbackRenderer` with a known snapshot and asserts on
// observable DOM (per spec):
//   - three bar elements present;
//   - bar 0 width fraction >= bar 1 width fraction >= bar 2 width fraction
//     (proportional ordering — bar 0 widest);
//   - the total label reads "18 votes";
//   - the rendered output is NOT blank — the bar fill elements have
//     non-default width attributes encoded in their inline style + a
//     non-default background color is set.
//
// **Verification posture per CLAUDE.md §13 option 1**: this is a
// real-render integration test driving the clip through the renderer
// with a known snapshot and asserting on observable DOM. This is the
// §13 evidence T-460 deferred (option 3) for the live-poll-multiple-
// choice variant. Pixel-bucket-style verification is approximated via
// computed-style + DOM inspection (no Playwright at the runtime test
// layer); a full PNG-based assertion is documented as out-of-scope and
// gated on the cross-cluster T-476 parity-fixture work.

/**
 * @vitest-environment happy-dom
 */

import type { LivePollMultipleChoiceAggregation } from '@stageflip/audience-contract';
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// React 19's `act(...)` requires opt-in flag in non-RTL test envs.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { staticFallbackRenderer } from '../../static-fallback.js';
import './index.js'; // side-effect: registers the clip

const SNAPSHOT: LivePollMultipleChoiceAggregation = {
  kind: 'live-poll-multiple-choice',
  optionCounts: [10, 5, 3],
  totalVotes: 18,
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

describe('§13 render-e2e (T-461) — live-poll-multiple-choice', () => {
  it('drives the clip through staticFallbackRenderer + asserts on DOM', async () => {
    const result = staticFallbackRenderer.render({
      provenance: {
        provider: 'stub',
        sessionId: 's-1',
        snapshotFrame: 0,
        voterCountAtCapture: 18,
        capturedAt: '2026-05-12T00:00:00.000Z',
        snapshotPolicy: 'final',
        clipKind: 'live-poll-multiple-choice',
        aggregation: SNAPSHOT,
      },
      context: {
        width: 800,
        height: 400,
        optionLabels: ['Red', 'Green', 'Blue'],
        question: 'Pick a colour',
      },
      emitLossFlag: () => {},
    });
    expect(result.state).toBe('rendered');
    if (result.state !== 'rendered') return;

    await act(async () => {
      root.render(result.output as React.ReactElement);
    });

    // ----- DOM assertion 1: three bar elements present -----
    const bars = host.querySelectorAll('[data-testid^="live-poll-mc-bar-"]');
    // Each bar wrapper is data-testid live-poll-mc-bar-N AND each fill is
    // live-poll-mc-bar-fill-N — filter to the wrappers (no '-fill-' suffix).
    const wrappers = Array.from(bars).filter((el) =>
      /^live-poll-mc-bar-\d+$/.test(el.getAttribute('data-testid') ?? ''),
    );
    expect(wrappers).toHaveLength(3);

    // ----- DOM assertion 2: proportional ordering -----
    const fractions = wrappers.map((w) =>
      Number.parseFloat(w.getAttribute('data-bar-fraction') ?? '0'),
    );
    expect(fractions[0]).toBeGreaterThanOrEqual(fractions[1] ?? 0);
    expect(fractions[1]).toBeGreaterThanOrEqual(fractions[2] ?? 0);
    expect(fractions[0]).toBeGreaterThan(0);

    // ----- DOM assertion 3: total label reads "18 votes" -----
    const total = host.querySelector('[data-testid="live-poll-mc-total"]');
    expect(total).not.toBeNull();
    expect(total?.textContent).toBe('18 votes');

    // ----- §13 pixel-bucket proxy: non-blank rendered output -----
    // The bar fill elements carry inline `width` (a non-zero CSS percent)
    // AND `background` (a non-default color). DOM-level proxies for
    // "non-blank pixels" — see file header for the deferral note on a
    // Playwright-based PNG bucket count.
    const fills = host.querySelectorAll('[data-testid^="live-poll-mc-bar-fill-"]');
    expect(fills.length).toBe(3);
    let nonBlankFills = 0;
    for (const fill of Array.from(fills)) {
      const style = (fill as HTMLElement).style;
      // The first bar (10/18 ≈ 55.5%) has non-zero width.
      const widthCss = style.getPropertyValue('width');
      const bg = style.getPropertyValue('background');
      const widthPct = Number.parseFloat(widthCss.replace('%', ''));
      if (widthPct > 0 && bg.length > 0) nonBlankFills += 1;
    }
    // 18 / 3 buckets — at least one bar with real width + a non-default
    // background colour. Per the T-348b non-blank gate pattern: at least
    // one non-background "pixel cluster" present.
    expect(nonBlankFills).toBeGreaterThan(0);

    // ----- DOM assertion 4: each bar shows its option label -----
    const labels = Array.from(host.querySelectorAll('[data-role="option-label"]')).map((el) =>
      (el.textContent ?? '').trim(),
    );
    expect(labels).toEqual(['Red', 'Green', 'Blue']);
  });

  it('renders the question label when context.question is supplied', async () => {
    const result = staticFallbackRenderer.render({
      provenance: {
        provider: 'stub',
        sessionId: 's-2',
        snapshotFrame: 0,
        voterCountAtCapture: 1,
        capturedAt: '2026-05-12T00:00:00.000Z',
        snapshotPolicy: 'final',
        clipKind: 'live-poll-multiple-choice',
        aggregation: {
          kind: 'live-poll-multiple-choice',
          optionCounts: [1, 0],
          totalVotes: 1,
        },
      },
      context: {
        width: 400,
        height: 200,
        optionLabels: ['Yes', 'No'],
        question: 'Are you sure?',
      },
      emitLossFlag: () => {},
    });
    if (result.state !== 'rendered') throw new Error('expected rendered');
    await act(async () => {
      root.render(result.output as React.ReactElement);
    });
    const q = host.querySelector('[data-testid="live-poll-mc-question"]');
    expect(q?.textContent).toBe('Are you sure?');
  });
});
