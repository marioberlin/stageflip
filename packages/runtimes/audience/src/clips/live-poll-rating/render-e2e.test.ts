// packages/runtimes/audience/src/clips/live-poll-rating/render-e2e.test.ts
// T-463 — §13 (CLAUDE.md "structural-extension specs require end-to-end
// render verification") evidence for the live-poll-rating clip family.
//
// This test mounts the clip's static-fallback path through the T-454
// `StaticFallbackRenderer` with a known snapshot and asserts on
// observable DOM (per spec):
//   - five bar elements present;
//   - the bar at index 2 (score 3, since round(3.38) === 3) carries
//     `data-highlight="mean"`;
//   - the mean label reads "Mean: 3.4";
//   - the total label reads "21 votes";
//   - histogram heights are normalised to the mode (bar 3, score 4 with
//     count 7, is the tallest);
//   - non-blank rendered output — bar fills carry non-default tinted-blue
//     background colours (DOM-level pixel-bucket proxies per the T-348b
//     non-blank pattern).
// Plus a separate case for `totalVotes === 0` rendering "Mean: —" with
// no `NaN` literal in the DOM.
//
// **Verification posture per CLAUDE.md §13 option 1**: this is a
// real-render integration test driving the clip through the renderer
// with a known snapshot and asserting on observable DOM. This is the
// §13 evidence T-460 deferred (option 3) for the live-poll-rating
// variant. Pixel-bucket-style verification is approximated via inline-
// style + DOM inspection (no Playwright at the runtime test layer); a
// full PNG-based assertion is documented as out-of-scope and gated on
// the cross-cluster T-476 parity-fixture work.

/**
 * @vitest-environment happy-dom
 */

import type { LivePollRatingAggregation } from '@stageflip/audience-contract';
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// React 19's `act(...)` requires opt-in flag in non-RTL test envs.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { staticFallbackRenderer } from '../../static-fallback.js';
import './index.js'; // side-effect: registers the clip

const SNAPSHOT: LivePollRatingAggregation = {
  kind: 'live-poll-rating',
  scoreCounts: [2, 3, 5, 7, 4],
  totalVotes: 21,
  mean: 3.38,
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

describe('§13 render-e2e (T-463) — live-poll-rating', () => {
  it('drives the clip through staticFallbackRenderer + asserts on DOM', async () => {
    const result = staticFallbackRenderer.render({
      provenance: {
        provider: 'stub',
        sessionId: 's-1',
        snapshotFrame: 0,
        voterCountAtCapture: 21,
        capturedAt: '2026-05-12T00:00:00.000Z',
        snapshotPolicy: 'final',
        clipKind: 'live-poll-rating',
        aggregation: SNAPSHOT,
      },
      context: {
        width: 800,
        height: 400,
        question: 'Rate the talk',
      },
      emitLossFlag: () => {},
    });
    expect(result.state).toBe('rendered');
    if (result.state !== 'rendered') return;

    await act(async () => {
      root.render(result.output as React.ReactElement);
    });

    // ----- DOM assertion 1: five bar elements present -----
    const bars = host.querySelectorAll('[data-testid^="live-poll-rating-bar-"]');
    const barList = Array.from(bars);
    expect(barList).toHaveLength(5);

    // ----- DOM assertion 2: bar 2 (score 3) is the highlighted mean bar -----
    // round(3.38) === 3 → zero-indexed bar 2.
    const highlighted = barList.filter((b) => b.getAttribute('data-highlight') === 'mean');
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0]?.getAttribute('data-bar-index')).toBe('2');
    expect(highlighted[0]?.getAttribute('data-bar-score')).toBe('3');

    // ----- DOM assertion 3: mean label reads "Mean: 3.4" -----
    const mean = host.querySelector('[data-testid="live-poll-rating-mean"]');
    expect(mean).not.toBeNull();
    expect(mean?.textContent).toBe('Mean: 3.4');

    // ----- DOM assertion 4: total label reads "21 votes" -----
    const total = host.querySelector('[data-testid="live-poll-rating-total"]');
    expect(total).not.toBeNull();
    expect(total?.textContent).toBe('21 votes');

    // ----- DOM assertion 5: histogram heights proportional to mode -----
    // Mode is bar index 3 (count === 7); inspect inline-style heights to
    // confirm bar 3 has the maximum non-zero pixel height. The bar fills
    // carry the height — read from the rendered DOM rather than from the
    // React-tree style prop directly so we exercise the real pipeline.
    const fills = host.querySelectorAll('[data-testid^="live-poll-rating-fill-"]');
    expect(fills.length).toBe(5);
    const heights = Array.from(fills).map((f) => {
      const h = (f as HTMLElement).style.height;
      return Number.parseInt(h.replace('px', ''), 10);
    });
    // Bar 3 is the mode (count 7) and must have the maximum height.
    const maxH = Math.max(...heights);
    expect(heights[3]).toBe(maxH);
    expect(heights[3]).toBeGreaterThan(0);
    // Strict descending invariant only between the bar pairs that follow
    // the count ordering [2, 3, 5, 7, 4]: heights[3] > heights[2] > heights[1]
    // > heights[0]; heights[4] is between [2] and [3].
    expect(heights[3]).toBeGreaterThan(heights[2] ?? 0);
    expect(heights[2]).toBeGreaterThan(heights[1] ?? 0);
    expect(heights[1]).toBeGreaterThan(heights[0] ?? 0);

    // ----- §13 pixel-bucket proxy: non-blank rendered output -----
    // Each bar fill carries a non-default background colour (tinted blue
    // for non-highlight bars, deeper accent for the highlight bar). DOM-
    // level proxies for "non-blank pixels" — see file header for the
    // deferral note on a Playwright-based PNG bucket count.
    let nonBlankFills = 0;
    for (const f of Array.from(fills)) {
      const style = (f as HTMLElement).style;
      const bg = style.getPropertyValue('background');
      if (bg.length > 0) nonBlankFills += 1;
    }
    expect(nonBlankFills).toBe(5);

    // The highlighted bar's background should differ from the non-highlight
    // bars (per the highlight-accent rule).
    const highlightedFill = highlighted[0]?.querySelector('[data-role="bar-fill"]') as HTMLElement;
    const nonHighlightedFill = barList[0]?.querySelector('[data-role="bar-fill"]') as HTMLElement;
    expect(highlightedFill?.style.background).not.toBe(nonHighlightedFill?.style.background);
  });

  it('renders "Mean: —" with no NaN literal when totalVotes === 0', async () => {
    const result = staticFallbackRenderer.render({
      provenance: {
        provider: 'stub',
        sessionId: 's-2',
        snapshotFrame: 0,
        voterCountAtCapture: 0,
        capturedAt: '2026-05-12T00:00:00.000Z',
        snapshotPolicy: 'final',
        clipKind: 'live-poll-rating',
        aggregation: {
          kind: 'live-poll-rating',
          scoreCounts: [0, 0, 0, 0, 0],
          totalVotes: 0,
          mean: Number.NaN,
        },
      },
      context: {
        width: 400,
        height: 200,
        question: 'Rate it (no votes yet)',
      },
      emitLossFlag: () => {},
    });
    if (result.state !== 'rendered') throw new Error('expected rendered');
    await act(async () => {
      root.render(result.output as React.ReactElement);
    });
    const mean = host.querySelector('[data-testid="live-poll-rating-mean"]');
    expect(mean?.textContent).toBe('Mean: —');
    // Defensive — the literal "NaN" must not appear anywhere in the
    // rendered DOM (no React-side coercion of a number to a string).
    expect(host.textContent).not.toContain('NaN');

    // No bar should carry the highlight when there are no votes.
    const highlighted = host.querySelectorAll('[data-highlight="mean"]');
    expect(highlighted.length).toBe(0);
  });

  it('renders the question label when context.question is supplied', async () => {
    const result = staticFallbackRenderer.render({
      provenance: {
        provider: 'stub',
        sessionId: 's-3',
        snapshotFrame: 0,
        voterCountAtCapture: 1,
        capturedAt: '2026-05-12T00:00:00.000Z',
        snapshotPolicy: 'final',
        clipKind: 'live-poll-rating',
        aggregation: {
          kind: 'live-poll-rating',
          scoreCounts: [0, 0, 1, 0, 0],
          totalVotes: 1,
          mean: 3,
        },
      },
      context: {
        width: 400,
        height: 200,
        question: 'Are you sure?',
      },
      emitLossFlag: () => {},
    });
    if (result.state !== 'rendered') throw new Error('expected rendered');
    await act(async () => {
      root.render(result.output as React.ReactElement);
    });
    const q = host.querySelector('[data-testid="live-poll-rating-question"]');
    expect(q?.textContent).toBe('Are you sure?');
  });
});
