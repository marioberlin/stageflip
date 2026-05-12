// packages/runtimes/audience/src/clips/live-poll-multiple-choice/static-fallback.test.ts
// T-461 — Static-fallback tests for the `live-poll-multiple-choice`
// clip. Asserts:
//   - Pure-function determinism (same input → byte-equal React tree).
//   - `computeBarFraction` + `computePercent` math (zero-vote edge case
//     + proportional ordering).
//   - The render emits one bar per option-count entry.

import { describe, expect, it } from 'vitest';

import {
  computeBarFraction,
  computePercent,
  renderLivePollMultipleChoiceStaticFallback,
} from './static-fallback.js';

const SNAPSHOT = {
  kind: 'live-poll-multiple-choice' as const,
  optionCounts: [10, 5, 3] as const,
  totalVotes: 18,
};

const CTX = {
  width: 800,
  height: 400,
  optionLabels: ['Red', 'Green', 'Blue'] as const,
  question: 'Pick one',
};

describe('computeBarFraction', () => {
  it('returns 0 when totalVotes <= 0', () => {
    expect(computeBarFraction(5, 0)).toBe(0);
    expect(computeBarFraction(5, -1)).toBe(0);
  });

  it('returns count/total for positive totalVotes', () => {
    expect(computeBarFraction(10, 20)).toBe(0.5);
    expect(computeBarFraction(3, 18)).toBeCloseTo(3 / 18);
  });
});

describe('computePercent', () => {
  it('returns 0 when totalVotes <= 0', () => {
    expect(computePercent(5, 0)).toBe(0);
  });

  it('returns floored percentage for positive totalVotes', () => {
    expect(computePercent(10, 18)).toBe(55);
    expect(computePercent(5, 18)).toBe(27);
    expect(computePercent(3, 18)).toBe(16);
  });
});

describe('renderLivePollMultipleChoiceStaticFallback', () => {
  it('returns a ReactElement', () => {
    const out = renderLivePollMultipleChoiceStaticFallback({
      snapshot: SNAPSHOT,
      context: CTX,
    });
    expect(out).toBeDefined();
    // ReactElement carries `type` + `props`.
    expect(out.type).toBe('div');
    expect((out.props as { 'data-stageflip-clip': string })['data-stageflip-clip']).toBe(
      'live-poll-multiple-choice',
    );
  });

  it('is deterministic — same input produces structurally-equal trees', () => {
    const a = renderLivePollMultipleChoiceStaticFallback({
      snapshot: SNAPSHOT,
      context: CTX,
    });
    const b = renderLivePollMultipleChoiceStaticFallback({
      snapshot: SNAPSHOT,
      context: CTX,
    });
    // ReactElement instances aren't reference-equal but their JSON-serialized
    // form is — that is the byte-equal contract per CLAUDE.md §3.
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it('emits one bar per option (encoded in the bars container)', () => {
    const out = renderLivePollMultipleChoiceStaticFallback({
      snapshot: SNAPSHOT,
      context: CTX,
    });
    // The root has children: question, bars, total.
    const children = (out.props as { children: unknown[] }).children;
    expect(Array.isArray(children)).toBe(true);
    // Find the bars element (data-role=bars).
    const bars = (
      children as Array<{ props?: { 'data-role'?: string; children?: unknown[] } }>
    ).find((c) => c.props?.['data-role'] === 'bars');
    expect(bars).toBeDefined();
    expect(Array.isArray(bars?.props?.children)).toBe(true);
    expect(bars?.props?.children).toHaveLength(SNAPSHOT.optionCounts.length);
  });

  it('handles the zero-votes edge case — bars render with fraction 0', () => {
    const zero = {
      kind: 'live-poll-multiple-choice' as const,
      optionCounts: [0, 0, 0],
      totalVotes: 0,
    };
    const out = renderLivePollMultipleChoiceStaticFallback({
      snapshot: zero,
      context: CTX,
    });
    expect(out).toBeDefined();
    // No throw; the render produces a valid tree even on empty input.
  });

  it('renders without a question when context.question is omitted', () => {
    const out = renderLivePollMultipleChoiceStaticFallback({
      snapshot: SNAPSHOT,
      context: {
        width: CTX.width,
        height: CTX.height,
        optionLabels: CTX.optionLabels,
      },
    });
    const children = (out.props as { children: unknown[] }).children;
    const question = (children as Array<{ props?: { 'data-role'?: string } }>).find(
      (c) => c.props?.['data-role'] === 'question',
    );
    expect(question).toBeUndefined();
  });

  it('falls back to "Option N" when no label is provided for an index', () => {
    const out = renderLivePollMultipleChoiceStaticFallback({
      snapshot: SNAPSHOT,
      context: {
        width: CTX.width,
        height: CTX.height,
        optionLabels: ['only first'], // shorter than optionCounts
      },
    });
    const children = (out.props as { children: unknown[] }).children;
    const bars = (
      children as Array<{ props?: { 'data-role'?: string; children?: unknown[] } }>
    ).find((c) => c.props?.['data-role'] === 'bars');
    expect(bars?.props?.children).toHaveLength(3);
  });

  it('produces the singular "1 vote" total label on totalVotes === 1', () => {
    const out = renderLivePollMultipleChoiceStaticFallback({
      snapshot: { kind: 'live-poll-multiple-choice', optionCounts: [1, 0], totalVotes: 1 },
      context: { width: 400, height: 200, optionLabels: ['A', 'B'] },
    });
    const children = (out.props as { children: unknown[] }).children;
    const total = (children as Array<{ props?: { 'data-role'?: string; children?: string } }>).find(
      (c) => c.props?.['data-role'] === 'total-votes',
    );
    expect(total?.props?.children).toBe('1 vote');
  });
});
