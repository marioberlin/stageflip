// packages/runtimes/audience/src/clips/leaderboard/clip-definition.test.ts
// T-466 — Unit tests for `leaderboardClipDefinition`. Verifies the kind
// discriminator, the propsSchema wiring, and the empty-state render
// path (which routes to the "Waiting for participants…" placeholder).

import type { ClipRenderContext } from '@stageflip/runtimes-contract';
import type { LeaderboardClipProps } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';

import { LEADERBOARD_KIND, leaderboardClipDefinition } from './clip-definition.js';

const PROPS: LeaderboardClipProps = {
  quizId: 'quiz-1',
  topN: 10,
};

const CTX: ClipRenderContext<LeaderboardClipProps> = {
  frame: 0,
  fps: 30,
  width: 800,
  height: 400,
  clipFrom: 0,
  clipDurationInFrames: 90,
  props: PROPS,
};

describe('leaderboardClipDefinition', () => {
  it('declares kind === "leaderboard"', () => {
    expect(leaderboardClipDefinition.kind).toBe('leaderboard');
    expect(LEADERBOARD_KIND).toBe('leaderboard');
  });

  it('exposes a propsSchema that accepts a valid props value', () => {
    const schema = leaderboardClipDefinition.propsSchema;
    expect(schema).toBeDefined();
    const parsed = schema?.parse(PROPS);
    expect(parsed?.quizId).toBe('quiz-1');
    expect(parsed?.topN).toBe(10);
  });

  it('propsSchema rejects empty quizId', () => {
    const schema = leaderboardClipDefinition.propsSchema;
    expect(() => schema?.parse({ quizId: '' })).toThrow();
  });

  it('propsSchema rejects topN > 100', () => {
    const schema = leaderboardClipDefinition.propsSchema;
    expect(() => schema?.parse({ quizId: 'q', topN: 101 })).toThrow();
  });

  it('propsSchema rejects topN === 0', () => {
    const schema = leaderboardClipDefinition.propsSchema;
    expect(() => schema?.parse({ quizId: 'q', topN: 0 })).toThrow();
  });

  it('render returns a React tree (the "Waiting…" placeholder for empty state)', () => {
    const out = leaderboardClipDefinition.render(CTX);
    expect(out).not.toBeNull();
    if (out === null) return;
    expect(out.type).toBe('div');
    expect((out.props as { 'data-stageflip-clip': string })['data-stageflip-clip']).toBe(
      'leaderboard',
    );
    expect((out.props as { 'data-state': string })['data-state']).toBe('waiting');
  });
});
