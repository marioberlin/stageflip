// packages/runtimes/audience/src/clips/live-poll-rating/clip-definition.test.ts
// T-463 — Unit tests for `livePollRatingClipDefinition`. Verifies the
// kind discriminator, the propsSchema wiring, and the empty-state
// render path.

import type { ClipRenderContext } from '@stageflip/runtimes-contract';
import type { LivePollRatingClipProps } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';

import { LIVE_POLL_RATING_KIND, livePollRatingClipDefinition } from './clip-definition.js';

const PROPS: LivePollRatingClipProps = {
  question: 'Rate the talk',
  scaleMin: 1,
  scaleMax: 5,
};

const CTX: ClipRenderContext<LivePollRatingClipProps> = {
  frame: 0,
  fps: 30,
  width: 800,
  height: 400,
  clipFrom: 0,
  clipDurationInFrames: 90,
  props: PROPS,
};

describe('livePollRatingClipDefinition', () => {
  it('declares kind === "live-poll-rating"', () => {
    expect(livePollRatingClipDefinition.kind).toBe('live-poll-rating');
    expect(LIVE_POLL_RATING_KIND).toBe('live-poll-rating');
  });

  it('exposes a propsSchema that accepts a valid props value', () => {
    const schema = livePollRatingClipDefinition.propsSchema;
    expect(schema).toBeDefined();
    const parsed = schema?.parse(PROPS);
    expect(parsed?.question).toBe('Rate the talk');
    expect(parsed?.scaleMax).toBe(5);
  });

  it('propsSchema rejects malformed props (empty question)', () => {
    const schema = livePollRatingClipDefinition.propsSchema;
    expect(() => schema?.parse({ question: '', scaleMin: 1, scaleMax: 5 })).toThrow();
  });

  it('propsSchema rejects scaleMin !== 1', () => {
    const schema = livePollRatingClipDefinition.propsSchema;
    expect(() => schema?.parse({ question: 'q', scaleMin: 0, scaleMax: 5 })).toThrow();
  });

  it('propsSchema rejects scaleMax > 10', () => {
    const schema = livePollRatingClipDefinition.propsSchema;
    expect(() => schema?.parse({ question: 'q', scaleMin: 1, scaleMax: 11 })).toThrow();
  });

  it('render returns a React tree for the empty-state', () => {
    const out = livePollRatingClipDefinition.render(CTX);
    expect(out).not.toBeNull();
    if (out === null) return;
    expect(out.type).toBe('div');
    expect((out.props as { 'data-stageflip-clip': string })['data-stageflip-clip']).toBe(
      'live-poll-rating',
    );
  });

  it('render produces scaleMax bars in the empty-state', () => {
    const out = livePollRatingClipDefinition.render(CTX);
    if (out === null) throw new Error('expected non-null render');
    const children = (out.props as { children: unknown[] }).children;
    const bars = (
      children as Array<{ props?: { 'data-role'?: string; children?: unknown[] } }>
    ).find((c) => c.props?.['data-role'] === 'bars');
    expect(bars?.props?.children).toHaveLength(5);
  });

  it('render emits "Mean: —" in the empty-state (totalVotes === 0)', () => {
    const out = livePollRatingClipDefinition.render(CTX);
    if (out === null) throw new Error('expected non-null render');
    const children = (out.props as { children: unknown[] }).children;
    const mean = (children as Array<{ props?: { 'data-role'?: string; children?: string } }>).find(
      (c) => c.props?.['data-role'] === 'mean-label',
    );
    expect(mean?.props?.children).toBe('Mean: —');
  });
});
