// packages/runtimes/audience/src/clips/live-quiz/clip-definition.test.ts
// T-465 — Unit tests for `liveQuizClipDefinition`. Verifies the kind
// discriminator, the propsSchema wiring, and the empty-state render
// path (which routes to the "Waiting for next question…" placeholder).

import type { ClipRenderContext } from '@stageflip/runtimes-contract';
import type { LiveQuizClipProps } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';

import { LIVE_QUIZ_KIND, liveQuizClipDefinition } from './clip-definition.js';

const PROPS: LiveQuizClipProps = {
  questions: [
    {
      id: 'q1',
      text: 'Capital of France?',
      options: ['London', 'Paris', 'Berlin', 'Madrid'],
      correctOptionIndex: 1,
    },
  ],
};

const CTX: ClipRenderContext<LiveQuizClipProps> = {
  frame: 0,
  fps: 30,
  width: 800,
  height: 400,
  clipFrom: 0,
  clipDurationInFrames: 90,
  props: PROPS,
};

describe('liveQuizClipDefinition', () => {
  it('declares kind === "live-quiz"', () => {
    expect(liveQuizClipDefinition.kind).toBe('live-quiz');
    expect(LIVE_QUIZ_KIND).toBe('live-quiz');
  });

  it('exposes a propsSchema that accepts a valid props value', () => {
    const schema = liveQuizClipDefinition.propsSchema;
    expect(schema).toBeDefined();
    const parsed = schema?.parse(PROPS);
    expect(parsed?.questions).toHaveLength(1);
    expect(parsed?.questions[0]?.correctOptionIndex).toBe(1);
  });

  it('propsSchema rejects empty questions array', () => {
    const schema = liveQuizClipDefinition.propsSchema;
    expect(() => schema?.parse({ questions: [] })).toThrow();
  });

  it('propsSchema rejects correctOptionIndex out of range', () => {
    const schema = liveQuizClipDefinition.propsSchema;
    expect(() =>
      schema?.parse({
        questions: [
          {
            id: 'q1',
            text: 't',
            options: ['a', 'b'],
            correctOptionIndex: 3,
          },
        ],
      }),
    ).toThrow();
  });

  it('propsSchema rejects > 6 options', () => {
    const schema = liveQuizClipDefinition.propsSchema;
    expect(() =>
      schema?.parse({
        questions: [
          {
            id: 'q1',
            text: 't',
            options: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
            correctOptionIndex: 0,
          },
        ],
      }),
    ).toThrow();
  });

  it('render returns a React tree (the "Waiting…" placeholder for empty state)', () => {
    const out = liveQuizClipDefinition.render(CTX);
    expect(out).not.toBeNull();
    if (out === null) return;
    expect(out.type).toBe('div');
    expect((out.props as { 'data-stageflip-clip': string })['data-stageflip-clip']).toBe(
      'live-quiz',
    );
    expect((out.props as { 'data-state': string })['data-state']).toBe('waiting');
  });
});
