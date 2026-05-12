// packages/runtimes/audience/src/clips/live-poll-open-text/static-fallback.test.ts
// T-462 — Static-fallback tests for the `live-poll-open-text` clip.
// Asserts:
//   - Pure-function determinism (same input → byte-equal React tree).
//   - `sortEntriesByCountDesc` defensive ordering (stable for ties).
//   - `formatTotalLabel` + `formatCountLabel` singular/plural.
//   - The render emits one row per entry.

import { describe, expect, it } from 'vitest';

import {
  formatCountLabel,
  formatTotalLabel,
  renderLivePollOpenTextStaticFallback,
  sortEntriesByCountDesc,
} from './static-fallback.js';

const SNAPSHOT = {
  kind: 'live-poll-open-text' as const,
  entries: [
    { text: 'great talk', count: 5 },
    { text: 'more demos!', count: 3 },
    { text: 'love the q&a', count: 2 },
  ] as const,
  totalVotes: 10,
};

const CTX = {
  width: 800,
  height: 400,
  question: 'What did you think?',
};

describe('sortEntriesByCountDesc', () => {
  it('returns a new array (does not mutate input)', () => {
    const input = [
      { text: 'a', count: 1 },
      { text: 'b', count: 2 },
    ];
    const out = sortEntriesByCountDesc(input);
    expect(out).not.toBe(input);
    expect(input[0]?.count).toBe(1); // input untouched
  });

  it('sorts by count descending', () => {
    const out = sortEntriesByCountDesc([
      { text: 'a', count: 1 },
      { text: 'b', count: 5 },
      { text: 'c', count: 3 },
    ]);
    expect(out.map((e) => e.count)).toEqual([5, 3, 1]);
  });

  it('is stable for ties (preserves insertion order on equal counts)', () => {
    const out = sortEntriesByCountDesc([
      { text: 'first-of-2', count: 2 },
      { text: 'second-of-2', count: 2 },
      { text: 'first-of-5', count: 5 },
    ]);
    expect(out.map((e) => e.text)).toEqual(['first-of-5', 'first-of-2', 'second-of-2']);
  });
});

describe('formatTotalLabel', () => {
  it('uses singular for exactly 1 response', () => {
    expect(formatTotalLabel(1)).toBe('1 response');
  });

  it('uses plural for 0 responses', () => {
    expect(formatTotalLabel(0)).toBe('0 responses');
  });

  it('uses plural for >1 responses', () => {
    expect(formatTotalLabel(10)).toBe('10 responses');
  });
});

describe('formatCountLabel', () => {
  it('uses singular for exactly 1 vote', () => {
    expect(formatCountLabel(1)).toBe('1 vote');
  });

  it('uses plural for 0 / >1 votes', () => {
    expect(formatCountLabel(0)).toBe('0 votes');
    expect(formatCountLabel(7)).toBe('7 votes');
  });
});

describe('renderLivePollOpenTextStaticFallback', () => {
  it('returns a ReactElement', () => {
    const out = renderLivePollOpenTextStaticFallback({
      snapshot: SNAPSHOT,
      context: CTX,
    });
    expect(out).toBeDefined();
    expect(out.type).toBe('div');
    expect((out.props as { 'data-stageflip-clip': string })['data-stageflip-clip']).toBe(
      'live-poll-open-text',
    );
  });

  it('is deterministic — same input produces structurally-equal trees', () => {
    const a = renderLivePollOpenTextStaticFallback({ snapshot: SNAPSHOT, context: CTX });
    const b = renderLivePollOpenTextStaticFallback({ snapshot: SNAPSHOT, context: CTX });
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it('emits one row per entry (encoded in the rows container)', () => {
    const out = renderLivePollOpenTextStaticFallback({ snapshot: SNAPSHOT, context: CTX });
    const children = (out.props as { children: unknown[] }).children;
    expect(Array.isArray(children)).toBe(true);
    const rows = (
      children as Array<{ props?: { 'data-role'?: string; children?: unknown[] } }>
    ).find((c) => c.props?.['data-role'] === 'rows');
    expect(rows).toBeDefined();
    expect(Array.isArray(rows?.props?.children)).toBe(true);
    expect(rows?.props?.children).toHaveLength(SNAPSHOT.entries.length);
  });

  it('handles the empty-entries edge case — renders without throwing', () => {
    const empty = {
      kind: 'live-poll-open-text' as const,
      entries: [],
      totalVotes: 0,
    };
    const out = renderLivePollOpenTextStaticFallback({ snapshot: empty, context: CTX });
    expect(out).toBeDefined();
    const children = (out.props as { children: unknown[] }).children;
    const rows = (
      children as Array<{ props?: { 'data-role'?: string; children?: unknown[] } }>
    ).find((c) => c.props?.['data-role'] === 'rows');
    expect(rows?.props?.children).toHaveLength(0);
  });

  it('renders without a question when context.question is omitted', () => {
    const out = renderLivePollOpenTextStaticFallback({
      snapshot: SNAPSHOT,
      context: { width: CTX.width, height: CTX.height },
    });
    const children = (out.props as { children: unknown[] }).children;
    const question = (children as Array<{ props?: { 'data-role'?: string } }>).find(
      (c) => c.props?.['data-role'] === 'question',
    );
    expect(question).toBeUndefined();
  });

  it('produces the singular "1 response" total label on totalVotes === 1', () => {
    const out = renderLivePollOpenTextStaticFallback({
      snapshot: {
        kind: 'live-poll-open-text',
        entries: [{ text: 'lone vote', count: 1 }],
        totalVotes: 1,
      },
      context: { width: 400, height: 200 },
    });
    const children = (out.props as { children: unknown[] }).children;
    const total = (children as Array<{ props?: { 'data-role'?: string; children?: string } }>).find(
      (c) => c.props?.['data-role'] === 'total-responses',
    );
    expect(total?.props?.children).toBe('1 response');
  });

  it('defensively re-sorts unsorted entries by count desc', () => {
    const unsorted = {
      kind: 'live-poll-open-text' as const,
      entries: [
        { text: 'low', count: 1 },
        { text: 'high', count: 9 },
        { text: 'mid', count: 5 },
      ],
      totalVotes: 15,
    };
    const out = renderLivePollOpenTextStaticFallback({
      snapshot: unsorted,
      context: CTX,
    });
    const children = (out.props as { children: unknown[] }).children;
    const rows = (
      children as Array<{ props?: { 'data-role'?: string; children?: unknown[] } }>
    ).find((c) => c.props?.['data-role'] === 'rows');
    const rowList = rows?.props?.children as Array<{
      props?: { 'data-row-count'?: number; children?: unknown[] };
    }>;
    // Should be ordered 9, 5, 1 even though the input was 1, 9, 5.
    expect(rowList[0]?.props?.['data-row-count']).toBe(9);
    expect(rowList[1]?.props?.['data-row-count']).toBe(5);
    expect(rowList[2]?.props?.['data-row-count']).toBe(1);
  });
});
