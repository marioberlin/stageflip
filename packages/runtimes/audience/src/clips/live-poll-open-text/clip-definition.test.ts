// packages/runtimes/audience/src/clips/live-poll-open-text/clip-definition.test.ts
// T-462 — Unit tests for `livePollOpenTextClipDefinition`. Verifies the
// kind discriminator, the propsSchema wiring, and the empty-state
// render path.

import type { ClipRenderContext } from '@stageflip/runtimes-contract';
import type { LivePollOpenTextClipProps } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';

import { LIVE_POLL_OPEN_TEXT_KIND, livePollOpenTextClipDefinition } from './clip-definition.js';

const PROPS: LivePollOpenTextClipProps = {
  question: 'What did you think?',
  maxLength: 280,
};

const CTX: ClipRenderContext<LivePollOpenTextClipProps> = {
  frame: 0,
  fps: 30,
  width: 800,
  height: 400,
  clipFrom: 0,
  clipDurationInFrames: 90,
  props: PROPS,
};

describe('livePollOpenTextClipDefinition', () => {
  it('declares kind === "live-poll-open-text"', () => {
    expect(livePollOpenTextClipDefinition.kind).toBe('live-poll-open-text');
    expect(LIVE_POLL_OPEN_TEXT_KIND).toBe('live-poll-open-text');
  });

  it('exposes a propsSchema that accepts a valid props value', () => {
    const schema = livePollOpenTextClipDefinition.propsSchema;
    expect(schema).toBeDefined();
    const parsed = schema?.parse(PROPS);
    expect(parsed?.question).toBe('What did you think?');
  });

  it('propsSchema rejects malformed props (empty question)', () => {
    const schema = livePollOpenTextClipDefinition.propsSchema;
    expect(() => schema?.parse({ question: '', maxLength: 280 })).toThrow();
  });

  it('propsSchema applies the default maxLength', () => {
    const schema = livePollOpenTextClipDefinition.propsSchema;
    const parsed = schema?.parse({ question: 'q' });
    expect(parsed?.maxLength).toBe(280);
  });

  it('render returns a React tree for the empty-state', () => {
    const out = livePollOpenTextClipDefinition.render(CTX);
    expect(out).not.toBeNull();
    if (out === null) return;
    expect(out.type).toBe('div');
    expect((out.props as { 'data-stageflip-clip': string })['data-stageflip-clip']).toBe(
      'live-poll-open-text',
    );
  });

  it('render produces zero rows for the empty-state', () => {
    const out = livePollOpenTextClipDefinition.render(CTX);
    if (out === null) throw new Error('expected non-null render');
    const children = (out.props as { children: unknown[] }).children;
    const rows = (
      children as Array<{ props?: { 'data-role'?: string; children?: unknown[] } }>
    ).find((c) => c.props?.['data-role'] === 'rows');
    expect(rows?.props?.children).toHaveLength(0);
  });
});
