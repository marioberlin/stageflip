// packages/runtimes/audience/src/clips/word-cloud/static-fallback.test.ts
// T-467 — Static-fallback tests for the `word-cloud` clip. Asserts:
//   - Pure-function determinism (same input → byte-equal React tree).
//   - `formatSubmissionsLabel` singular/plural.
//   - `fontSizeForWeight` range + zero-divisor edge case.
//   - Cloud routing emits one span per `words` entry; sorted desc.
//   - Spans carry `data-word` + `data-weight` data attributes.
//   - Prompt rendered above the cloud when supplied.
//   - Empty-words renders the "Waiting…" placeholder.

import { describe, expect, it } from 'vitest';

import {
  fontSizeForWeight,
  formatSubmissionsLabel,
  renderWordCloudStaticFallback,
} from './static-fallback.js';

const FULL_SNAPSHOT = {
  kind: 'word-cloud' as const,
  words: [
    { word: 'design', weight: 12 },
    { word: 'react', weight: 9 },
    { word: 'rust', weight: 7 },
    { word: 'audio', weight: 4 },
    { word: 'video', weight: 3 },
  ],
  totalSubmissions: 18,
};

const CTX = {
  width: 800,
  height: 400,
};

describe('formatSubmissionsLabel', () => {
  it('uses singular for exactly 1 submission', () => {
    expect(formatSubmissionsLabel(1)).toBe('1 submission');
  });

  it('uses plural for 0 / >1 submissions', () => {
    expect(formatSubmissionsLabel(0)).toBe('0 submissions');
    expect(formatSubmissionsLabel(18)).toBe('18 submissions');
  });
});

describe('fontSizeForWeight', () => {
  it('maps max-weight to MIN + RANGE (50px)', () => {
    expect(fontSizeForWeight(12, 12)).toBe(50);
  });

  it('maps zero-weight to MIN (14px)', () => {
    expect(fontSizeForWeight(0, 12)).toBe(14);
  });

  it('scales linearly between MIN and MAX', () => {
    // 14 + (3 / 12) * 36 = 23
    expect(fontSizeForWeight(3, 12)).toBe(23);
  });

  it('falls back to MIN_FONT_SIZE_PX on a zero divisor', () => {
    expect(fontSizeForWeight(0, 0)).toBe(14);
    expect(fontSizeForWeight(5, 0)).toBe(14);
  });
});

describe('renderWordCloudStaticFallback — aggregated shape', () => {
  it('returns a ReactElement marked as the word-cloud root', () => {
    const out = renderWordCloudStaticFallback({
      snapshot: FULL_SNAPSHOT,
      context: CTX,
    });
    expect(out.type).toBe('div');
    expect((out.props as { 'data-stageflip-clip': string })['data-stageflip-clip']).toBe(
      'word-cloud',
    );
    expect((out.props as { 'data-state': string })['data-state']).toBe('aggregated');
  });

  it('is deterministic — same input produces structurally-equal trees', () => {
    const a = renderWordCloudStaticFallback({ snapshot: FULL_SNAPSHOT, context: CTX });
    const b = renderWordCloudStaticFallback({ snapshot: FULL_SNAPSHOT, context: CTX });
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it('sorts words by weight desc even if the snapshot is unsorted', () => {
    const out = renderWordCloudStaticFallback({
      snapshot: {
        kind: 'word-cloud',
        words: [
          { word: 'low', weight: 1 },
          { word: 'high', weight: 10 },
          { word: 'mid', weight: 5 },
        ],
        totalSubmissions: 16,
      },
      context: CTX,
    });
    // Locate the cloud child + verify its spans in order.
    const children = (out.props as { children: unknown[] }).children;
    type SpanLike = { type?: unknown; props?: { 'data-word'?: string; children?: unknown[] } };
    const cloud = (
      children as Array<{ props?: { 'data-role'?: string; children?: unknown[] } }>
    ).find((c) => c?.props?.['data-role'] === 'cloud');
    expect(cloud).toBeDefined();
    const spans = cloud?.props?.children as SpanLike[];
    expect(spans?.[0]?.props?.['data-word']).toBe('high');
    expect(spans?.[1]?.props?.['data-word']).toBe('mid');
    expect(spans?.[2]?.props?.['data-word']).toBe('low');
  });

  it('renders the optional prompt when supplied', () => {
    const out = renderWordCloudStaticFallback({
      snapshot: FULL_SNAPSHOT,
      context: { ...CTX, prompt: 'Describe today' },
    });
    const children = (out.props as { children: Array<{ type?: unknown }> }).children;
    const hasPrompt = children.some((c) => (c as { type?: unknown }).type === 'h3');
    expect(hasPrompt).toBe(true);
  });

  it('omits the prompt node when no prompt is supplied', () => {
    const out = renderWordCloudStaticFallback({
      snapshot: FULL_SNAPSHOT,
      context: CTX,
    });
    const children = (out.props as { children: Array<{ type?: unknown }> }).children;
    const hasPrompt = children.some((c) => (c as { type?: unknown }).type === 'h3');
    expect(hasPrompt).toBe(false);
  });
});

describe('renderWordCloudStaticFallback — idle shape', () => {
  it('renders the "Waiting…" placeholder when words is empty', () => {
    const out = renderWordCloudStaticFallback({
      snapshot: {
        kind: 'word-cloud',
        words: [],
        totalSubmissions: 0,
      },
      context: CTX,
    });
    expect((out.props as { 'data-state': string })['data-state']).toBe('waiting');
  });
});
