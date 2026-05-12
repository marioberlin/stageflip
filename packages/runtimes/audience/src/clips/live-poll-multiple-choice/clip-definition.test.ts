// packages/runtimes/audience/src/clips/live-poll-multiple-choice/clip-definition.test.ts
// T-461 — Unit tests for `livePollMultipleChoiceClipDefinition`. Verifies
// the kind discriminator, the propsSchema wiring, and the empty-state
// render path.

import type { ClipRenderContext } from '@stageflip/runtimes-contract';
import type { LivePollMultipleChoiceClipProps } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';

import {
  LIVE_POLL_MULTIPLE_CHOICE_KIND,
  livePollMultipleChoiceClipDefinition,
} from './clip-definition.js';

const PROPS: LivePollMultipleChoiceClipProps = {
  question: 'Pick one',
  options: ['A', 'B', 'C'],
};

const CTX: ClipRenderContext<LivePollMultipleChoiceClipProps> = {
  frame: 0,
  fps: 30,
  width: 800,
  height: 400,
  clipFrom: 0,
  clipDurationInFrames: 90,
  props: PROPS,
};

describe('livePollMultipleChoiceClipDefinition', () => {
  it('declares kind === "live-poll-multiple-choice"', () => {
    expect(livePollMultipleChoiceClipDefinition.kind).toBe('live-poll-multiple-choice');
    expect(LIVE_POLL_MULTIPLE_CHOICE_KIND).toBe('live-poll-multiple-choice');
  });

  it('exposes a propsSchema that accepts a valid props value', () => {
    const schema = livePollMultipleChoiceClipDefinition.propsSchema;
    expect(schema).toBeDefined();
    const parsed = schema?.parse(PROPS);
    expect(parsed?.question).toBe('Pick one');
  });

  it('propsSchema rejects malformed props (1 option)', () => {
    const schema = livePollMultipleChoiceClipDefinition.propsSchema;
    expect(() => schema?.parse({ question: 'q', options: ['only'] })).toThrow();
  });

  it('render returns a React tree for the empty-state', () => {
    const out = livePollMultipleChoiceClipDefinition.render(CTX);
    expect(out).not.toBeNull();
    if (out === null) return;
    expect(out.type).toBe('div');
    expect((out.props as { 'data-stageflip-clip': string })['data-stageflip-clip']).toBe(
      'live-poll-multiple-choice',
    );
  });

  it('render produces one bar per option in props', () => {
    const out = livePollMultipleChoiceClipDefinition.render(CTX);
    if (out === null) throw new Error('expected non-null render');
    const children = (out.props as { children: unknown[] }).children;
    const bars = (
      children as Array<{ props?: { 'data-role'?: string; children?: unknown[] } }>
    ).find((c) => c.props?.['data-role'] === 'bars');
    expect(bars?.props?.children).toHaveLength(PROPS.options.length);
  });
});
