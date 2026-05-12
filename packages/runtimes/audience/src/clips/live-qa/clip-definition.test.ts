// packages/runtimes/audience/src/clips/live-qa/clip-definition.test.ts
// T-464 — Unit tests for `liveQAClipDefinition`. Verifies the kind
// discriminator, the propsSchema wiring, and the empty-state render
// path.

import type { ClipRenderContext } from '@stageflip/runtimes-contract';
import type { LiveQAClipProps } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';

import { LIVE_QA_KIND, liveQAClipDefinition } from './clip-definition.js';

const PROPS: LiveQAClipProps = {
  topic: 'Ask the speaker',
  allowUpvoting: true,
  moderationMode: 'open',
  maxLength: 500,
  topN: 100,
};

const CTX: ClipRenderContext<LiveQAClipProps> = {
  frame: 0,
  fps: 30,
  width: 800,
  height: 400,
  clipFrom: 0,
  clipDurationInFrames: 90,
  props: PROPS,
};

describe('liveQAClipDefinition', () => {
  it('declares kind === "live-qa"', () => {
    expect(liveQAClipDefinition.kind).toBe('live-qa');
    expect(LIVE_QA_KIND).toBe('live-qa');
  });

  it('exposes a propsSchema that accepts a valid props value', () => {
    const schema = liveQAClipDefinition.propsSchema;
    expect(schema).toBeDefined();
    const parsed = schema?.parse(PROPS);
    expect(parsed?.topic).toBe('Ask the speaker');
    expect(parsed?.maxLength).toBe(500);
  });

  it('propsSchema rejects malformed props (empty topic)', () => {
    const schema = liveQAClipDefinition.propsSchema;
    expect(() =>
      schema?.parse({
        topic: '',
        allowUpvoting: true,
        moderationMode: 'open',
        maxLength: 500,
        topN: 100,
      }),
    ).toThrow();
  });

  it('propsSchema rejects maxLength > 2000', () => {
    const schema = liveQAClipDefinition.propsSchema;
    expect(() =>
      schema?.parse({
        topic: 't',
        maxLength: 2001,
      }),
    ).toThrow();
  });

  it('propsSchema rejects topN > 500', () => {
    const schema = liveQAClipDefinition.propsSchema;
    expect(() =>
      schema?.parse({
        topic: 't',
        topN: 501,
      }),
    ).toThrow();
  });

  it('render returns a React tree for the empty-state', () => {
    const out = liveQAClipDefinition.render(CTX);
    expect(out).not.toBeNull();
    if (out === null) return;
    expect(out.type).toBe('div');
    expect((out.props as { 'data-stageflip-clip': string })['data-stageflip-clip']).toBe('live-qa');
  });

  it('render produces zero cards in the empty-state', () => {
    const out = liveQAClipDefinition.render(CTX);
    if (out === null) throw new Error('expected non-null render');
    const children = (out.props as { children: unknown[] }).children;
    const cards = (
      children as Array<{ props?: { 'data-role'?: string; children?: unknown[] } }>
    ).find((c) => c.props?.['data-role'] === 'cards');
    expect(cards?.props?.children).toHaveLength(0);
  });

  it('render emits "0 questions" total label in the empty-state', () => {
    const out = liveQAClipDefinition.render(CTX);
    if (out === null) throw new Error('expected non-null render');
    const children = (out.props as { children: unknown[] }).children;
    const total = (children as Array<{ props?: { 'data-role'?: string; children?: string } }>).find(
      (c) => c.props?.['data-role'] === 'total',
    );
    expect(total?.props?.children).toBe('0 questions');
  });
});
