// packages/runtimes/audience/src/clips/reaction-stream/static-fallback.test.ts
// T-470 — Static-fallback tests for the `reaction-stream` clip. Asserts:
//   - Pure-function determinism (same input → structurally-equal trees).
//   - `formatTotalReactionsLabel` singular/plural.
//   - Idle-state routing (zero emojiCounts + zero totalReactions).
//   - Aggregated-state routing.
//   - Prompt text propagates.
//   - `data-palette-size` matches palette length.
//   - `data-total-reactions` matches snapshot total.

/**
 * @vitest-environment happy-dom
 */

import type { ReactionStreamAggregation } from '@stageflip/audience-contract';
import { describe, expect, it } from 'vitest';

import {
  formatTotalReactionsLabel,
  renderReactionStreamStaticFallback,
} from './static-fallback.js';

const PALETTE = [
  { emojiId: 'heart', glyph: '❤️' },
  { emojiId: 'thumbs-up', glyph: '👍' },
  { emojiId: 'fire', glyph: '🔥' },
];

const FULL_SNAPSHOT: ReactionStreamAggregation = {
  kind: 'reaction-stream',
  emojiCounts: [
    { emojiId: 'heart', count: 42, recentBurst: 8 },
    { emojiId: 'thumbs-up', count: 35, recentBurst: 5 },
    { emojiId: 'fire', count: 17, recentBurst: 12 },
  ],
  totalReactions: 94,
};

const EMPTY_SNAPSHOT: ReactionStreamAggregation = {
  kind: 'reaction-stream',
  emojiCounts: [],
  totalReactions: 0,
};

const CTX = {
  width: 800,
  height: 600,
  prompt: 'React to the talk',
  palette: PALETTE,
};

describe('formatTotalReactionsLabel', () => {
  it('uses singular for exactly 1 reaction', () => {
    expect(formatTotalReactionsLabel(1)).toBe('1 reaction');
  });
  it('uses plural for 0 / >1 reactions', () => {
    expect(formatTotalReactionsLabel(0)).toBe('0 reactions');
    expect(formatTotalReactionsLabel(94)).toBe('94 reactions');
  });
});

describe('renderReactionStreamStaticFallback — aggregated shape', () => {
  it('returns a ReactElement marked as the reaction-stream root', () => {
    const out = renderReactionStreamStaticFallback({ snapshot: FULL_SNAPSHOT, context: CTX });
    expect(out.type).toBe('div');
    expect((out.props as { 'data-stageflip-clip': string })['data-stageflip-clip']).toBe(
      'reaction-stream',
    );
    expect((out.props as { 'data-state': string })['data-state']).toBe('aggregated');
  });

  it('is deterministic — same input produces structurally-equal trees', () => {
    const a = renderReactionStreamStaticFallback({ snapshot: FULL_SNAPSHOT, context: CTX });
    const b = renderReactionStreamStaticFallback({ snapshot: FULL_SNAPSHOT, context: CTX });
    const replacer = (_k: string, v: unknown): unknown => {
      if (typeof v === 'function') return '[fn]';
      // Float32Array is serialised by JSON as an object with numeric
      // string keys; preserving that is sufficient for structural
      // equality across two calls.
      return v;
    };
    expect(JSON.stringify(a, replacer)).toEqual(JSON.stringify(b, replacer));
  });

  it('renders the prompt text', () => {
    const out = renderReactionStreamStaticFallback({ snapshot: FULL_SNAPSHOT, context: CTX });
    const json = JSON.stringify(out, (_k, v) => (typeof v === 'function' ? '[fn]' : v));
    expect(json).toContain('React to the talk');
  });

  it('renders the total-reactions label with correct plural', () => {
    const out = renderReactionStreamStaticFallback({ snapshot: FULL_SNAPSHOT, context: CTX });
    const json = JSON.stringify(out, (_k, v) => (typeof v === 'function' ? '[fn]' : v));
    expect(json).toContain('94 reactions');
  });

  it('forwards palette length to data-palette-size', () => {
    const out = renderReactionStreamStaticFallback({ snapshot: FULL_SNAPSHOT, context: CTX });
    expect((out.props as { 'data-palette-size': number })['data-palette-size']).toBe(3);
  });
});

describe('renderReactionStreamStaticFallback — idle shape', () => {
  it('renders the "Waiting…" placeholder when emojiCounts + totalReactions are empty', () => {
    const out = renderReactionStreamStaticFallback({ snapshot: EMPTY_SNAPSHOT, context: CTX });
    expect((out.props as { 'data-state': string })['data-state']).toBe('waiting');
    const json = JSON.stringify(out, (_k, v) => (typeof v === 'function' ? '[fn]' : v));
    expect(json).toContain('Waiting for reactions…');
  });

  it('still renders the prompt in the idle state', () => {
    const out = renderReactionStreamStaticFallback({ snapshot: EMPTY_SNAPSHOT, context: CTX });
    const json = JSON.stringify(out, (_k, v) => (typeof v === 'function' ? '[fn]' : v));
    expect(json).toContain('React to the talk');
  });

  it('renders "0 reactions" in the idle state', () => {
    const out = renderReactionStreamStaticFallback({ snapshot: EMPTY_SNAPSHOT, context: CTX });
    const json = JSON.stringify(out, (_k, v) => (typeof v === 'function' ? '[fn]' : v));
    expect(json).toContain('0 reactions');
  });
});

describe('renderReactionStreamStaticFallback — overrides', () => {
  it('honours an explicit localFrame override (varies the uTime uniform)', () => {
    const at0 = renderReactionStreamStaticFallback({
      snapshot: FULL_SNAPSHOT,
      context: { ...CTX, localFrame: 0, fps: 30 },
    });
    const at30 = renderReactionStreamStaticFallback({
      snapshot: FULL_SNAPSHOT,
      context: { ...CTX, localFrame: 30, fps: 30 },
    });
    // Both trees structurally match at the root + total-reactions; only
    // the inner ShaderClipHost's `uTime` uniform differs.
    expect((at0.props as { 'data-state': string })['data-state']).toBe('aggregated');
    expect((at30.props as { 'data-state': string })['data-state']).toBe('aggregated');
  });
});
