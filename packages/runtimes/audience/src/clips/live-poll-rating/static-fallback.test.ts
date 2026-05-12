// packages/runtimes/audience/src/clips/live-poll-rating/static-fallback.test.ts
// T-463 — Static-fallback tests for the `live-poll-rating` clip.
// Asserts:
//   - Pure-function determinism (same input → byte-equal React tree).
//   - `formatMeanLabel` handles `NaN` / totalVotes === 0 (no `NaN` literal).
//   - `formatTotalLabel` singular/plural.
//   - `meanHighlightIndex` round-half-to-even-style behaviour + clamping.
//   - The render emits one bar per score (length === scaleMax).
//   - Optional end-labels render when `labels` is supplied.

import { describe, expect, it } from 'vitest';

import {
  formatMeanLabel,
  formatTotalLabel,
  meanHighlightIndex,
  renderLivePollRatingStaticFallback,
} from './static-fallback.js';

const SNAPSHOT = {
  kind: 'live-poll-rating' as const,
  scoreCounts: [2, 3, 5, 7, 4],
  totalVotes: 21,
  mean: 3.38,
};

const CTX = {
  width: 800,
  height: 400,
  question: 'Rate the talk',
};

describe('formatMeanLabel', () => {
  it('uses one-decimal toFixed for non-NaN means', () => {
    expect(formatMeanLabel(3.38, 21)).toBe('Mean: 3.4');
    expect(formatMeanLabel(5.0, 1)).toBe('Mean: 5.0');
  });

  it('renders the em-dash for totalVotes === 0', () => {
    expect(formatMeanLabel(Number.NaN, 0)).toBe('Mean: —');
    // Defensive: even if a malformed snapshot supplies a number with totalVotes===0,
    // the em-dash wins because there is no statistical meaning.
    expect(formatMeanLabel(0, 0)).toBe('Mean: —');
  });

  it('renders the em-dash for explicit NaN', () => {
    expect(formatMeanLabel(Number.NaN, 5)).toBe('Mean: —');
  });

  it('never emits the literal "NaN" string', () => {
    expect(formatMeanLabel(Number.NaN, 0)).not.toContain('NaN');
    expect(formatMeanLabel(Number.NaN, 21)).not.toContain('NaN');
  });
});

describe('formatTotalLabel', () => {
  it('uses singular for exactly 1 vote', () => {
    expect(formatTotalLabel(1)).toBe('1 vote');
  });

  it('uses plural for 0 / >1 votes', () => {
    expect(formatTotalLabel(0)).toBe('0 votes');
    expect(formatTotalLabel(21)).toBe('21 votes');
  });
});

describe('meanHighlightIndex', () => {
  it('returns the zero-indexed bar at Math.round(mean) - 1', () => {
    expect(meanHighlightIndex(3.38, 5)).toBe(2); // round(3.38) === 3 → index 2
    expect(meanHighlightIndex(3.6, 5)).toBe(3); // round(3.6) === 4 → index 3
    expect(meanHighlightIndex(1.0, 5)).toBe(0); // round(1.0) === 1 → index 0
    expect(meanHighlightIndex(5.0, 5)).toBe(4); // round(5.0) === 5 → index 4
  });

  it('returns null for NaN', () => {
    expect(meanHighlightIndex(Number.NaN, 5)).toBeNull();
  });

  it('clamps out-of-range mean to null', () => {
    expect(meanHighlightIndex(0.4, 5)).toBeNull(); // round → 0 → idx -1
    expect(meanHighlightIndex(5.6, 5)).toBeNull(); // round → 6 → idx 5 ≥ scaleMax
  });
});

describe('renderLivePollRatingStaticFallback', () => {
  it('returns a ReactElement', () => {
    const out = renderLivePollRatingStaticFallback({
      snapshot: SNAPSHOT,
      context: CTX,
    });
    expect(out).toBeDefined();
    expect(out.type).toBe('div');
    expect((out.props as { 'data-stageflip-clip': string })['data-stageflip-clip']).toBe(
      'live-poll-rating',
    );
  });

  it('is deterministic — same input produces structurally-equal trees', () => {
    const a = renderLivePollRatingStaticFallback({ snapshot: SNAPSHOT, context: CTX });
    const b = renderLivePollRatingStaticFallback({ snapshot: SNAPSHOT, context: CTX });
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it('emits one bar per score (encoded in the bars container)', () => {
    const out = renderLivePollRatingStaticFallback({ snapshot: SNAPSHOT, context: CTX });
    const children = (out.props as { children: unknown[] }).children;
    const bars = (
      children as Array<{ props?: { 'data-role'?: string; children?: unknown[] } }>
    ).find((c) => c.props?.['data-role'] === 'bars');
    expect(bars).toBeDefined();
    expect(Array.isArray(bars?.props?.children)).toBe(true);
    expect(bars?.props?.children).toHaveLength(SNAPSHOT.scoreCounts.length);
  });

  it('emits the highlighted-mean attribute on the rounded-mean bar', () => {
    const out = renderLivePollRatingStaticFallback({ snapshot: SNAPSHOT, context: CTX });
    const children = (out.props as { children: unknown[] }).children;
    const bars = (
      children as Array<{ props?: { 'data-role'?: string; children?: unknown[] } }>
    ).find((c) => c.props?.['data-role'] === 'bars');
    const barList = bars?.props?.children as Array<{
      props?: { 'data-bar-index'?: number; 'data-highlight'?: string };
    }>;
    // Mean === 3.38; round → 3; zero-indexed bar 2.
    const highlighted = barList.filter((b) => b.props?.['data-highlight'] === 'mean');
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0]?.props?.['data-bar-index']).toBe(2);
  });

  it('emits NO highlight bar when totalVotes === 0 (NaN mean)', () => {
    const empty = {
      kind: 'live-poll-rating' as const,
      scoreCounts: [0, 0, 0, 0, 0],
      totalVotes: 0,
      mean: Number.NaN,
    };
    const out = renderLivePollRatingStaticFallback({ snapshot: empty, context: CTX });
    const children = (out.props as { children: unknown[] }).children;
    const bars = (
      children as Array<{ props?: { 'data-role'?: string; children?: unknown[] } }>
    ).find((c) => c.props?.['data-role'] === 'bars');
    const barList = bars?.props?.children as Array<{
      props?: { 'data-highlight'?: string };
    }>;
    const highlighted = barList.filter((b) => b.props?.['data-highlight'] === 'mean');
    expect(highlighted).toHaveLength(0);
  });

  it('renders "Mean: —" when totalVotes === 0', () => {
    const empty = {
      kind: 'live-poll-rating' as const,
      scoreCounts: [0, 0, 0, 0, 0],
      totalVotes: 0,
      mean: Number.NaN,
    };
    const out = renderLivePollRatingStaticFallback({ snapshot: empty, context: CTX });
    const children = (out.props as { children: unknown[] }).children;
    const mean = (children as Array<{ props?: { 'data-role'?: string; children?: string } }>).find(
      (c) => c.props?.['data-role'] === 'mean-label',
    );
    expect(mean?.props?.children).toBe('Mean: —');
  });

  it('renders "Mean: 3.4" for the spec snapshot', () => {
    const out = renderLivePollRatingStaticFallback({ snapshot: SNAPSHOT, context: CTX });
    const children = (out.props as { children: unknown[] }).children;
    const mean = (children as Array<{ props?: { 'data-role'?: string; children?: string } }>).find(
      (c) => c.props?.['data-role'] === 'mean-label',
    );
    expect(mean?.props?.children).toBe('Mean: 3.4');
  });

  it('renders the total label as "21 votes"', () => {
    const out = renderLivePollRatingStaticFallback({ snapshot: SNAPSHOT, context: CTX });
    const children = (out.props as { children: unknown[] }).children;
    const total = (children as Array<{ props?: { 'data-role'?: string; children?: string } }>).find(
      (c) => c.props?.['data-role'] === 'total-votes',
    );
    expect(total?.props?.children).toBe('21 votes');
  });

  it('renders end labels when context.labels is supplied', () => {
    const out = renderLivePollRatingStaticFallback({
      snapshot: SNAPSHOT,
      context: { ...CTX, labels: ['Strongly disagree', 'Strongly agree'] },
    });
    const children = (out.props as { children: unknown[] }).children;
    const endLabels = (
      children as Array<{ props?: { 'data-role'?: string; children?: unknown } }>
    ).find((c) => c.props?.['data-role'] === 'end-labels');
    expect(endLabels).toBeDefined();
  });

  it('omits end labels when context.labels is omitted', () => {
    const out = renderLivePollRatingStaticFallback({ snapshot: SNAPSHOT, context: CTX });
    const children = (out.props as { children: unknown[] }).children;
    const endLabels = (children as Array<{ props?: { 'data-role'?: string } }>).find(
      (c) => c.props?.['data-role'] === 'end-labels',
    );
    expect(endLabels).toBeUndefined();
  });

  it('renders without a question when context.question is omitted', () => {
    const out = renderLivePollRatingStaticFallback({
      snapshot: SNAPSHOT,
      context: { width: CTX.width, height: CTX.height },
    });
    const children = (out.props as { children: unknown[] }).children;
    const question = (children as Array<{ props?: { 'data-role'?: string } }>).find(
      (c) => c.props?.['data-role'] === 'question',
    );
    expect(question).toBeUndefined();
  });

  it('normalises bar heights to the mode (max scoreCount) — bar with mode count is tallest', () => {
    const out = renderLivePollRatingStaticFallback({ snapshot: SNAPSHOT, context: CTX });
    const children = (out.props as { children: unknown[] }).children;
    const bars = (
      children as Array<{ props?: { 'data-role'?: string; children?: unknown[] } }>
    ).find((c) => c.props?.['data-role'] === 'bars');
    const barList = bars?.props?.children as Array<{
      props?: { 'data-bar-count'?: number; children?: unknown };
    }>;
    // Mode index in [2, 3, 5, 7, 4] is index 3 (count === 7).
    expect(barList[3]?.props?.['data-bar-count']).toBe(7);
  });
});
