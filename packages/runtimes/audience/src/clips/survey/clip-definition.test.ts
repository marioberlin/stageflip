// packages/runtimes/audience/src/clips/survey/clip-definition.test.ts
// T-468 — Unit tests for `surveyClipDefinition`. Verifies the kind
// discriminator, the propsSchema wiring, and the empty-state render
// path (which routes to the "Waiting for responses…" placeholder).

import type { ClipRenderContext } from '@stageflip/runtimes-contract';
import type { SurveyClipProps } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';

import { SURVEY_KIND, surveyClipDefinition } from './clip-definition.js';

const PROPS: SurveyClipProps = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      text: 'Which framework?',
      options: ['React', 'Vue'],
    },
  ],
};

const CTX: ClipRenderContext<SurveyClipProps> = {
  frame: 0,
  fps: 30,
  width: 800,
  height: 600,
  clipFrom: 0,
  clipDurationInFrames: 90,
  props: PROPS,
};

describe('surveyClipDefinition', () => {
  it('declares kind === "survey"', () => {
    expect(surveyClipDefinition.kind).toBe('survey');
    expect(SURVEY_KIND).toBe('survey');
  });

  it('exposes a propsSchema that accepts a valid props value', () => {
    const schema = surveyClipDefinition.propsSchema;
    expect(schema).toBeDefined();
    const parsed = schema?.parse(PROPS);
    expect(parsed?.questions).toHaveLength(1);
    expect(parsed?.questions[0]?.type).toBe('multiple-choice');
  });

  it('propsSchema rejects empty questions array', () => {
    const schema = surveyClipDefinition.propsSchema;
    expect(() => schema?.parse({ questions: [] })).toThrow();
  });

  it('propsSchema rejects more than 20 questions', () => {
    const schema = surveyClipDefinition.propsSchema;
    const tooMany = Array.from({ length: 21 }, (_, i) => ({
      id: `q${i + 1}`,
      type: 'open-text' as const,
      text: 'go',
    }));
    expect(() => schema?.parse({ questions: tooMany })).toThrow();
  });

  it('propsSchema rejects multiple-choice with <2 options', () => {
    const schema = surveyClipDefinition.propsSchema;
    expect(() =>
      schema?.parse({
        questions: [{ id: 'q1', type: 'multiple-choice', text: 'Pick', options: ['only-one'] }],
      }),
    ).toThrow();
  });

  it('propsSchema rejects rating with scaleMin !== 1', () => {
    const schema = surveyClipDefinition.propsSchema;
    expect(() =>
      schema?.parse({
        questions: [{ id: 'q1', type: 'rating', text: 'Rate', scaleMin: 2, scaleMax: 5 }],
      }),
    ).toThrow();
  });

  it('render returns a React tree (the "Waiting…" placeholder for empty state)', () => {
    const out = surveyClipDefinition.render(CTX);
    expect(out).not.toBeNull();
    if (out === null) return;
    expect(out.type).toBe('div');
    expect((out.props as { 'data-stageflip-clip': string })['data-stageflip-clip']).toBe('survey');
    expect((out.props as { 'data-state': string })['data-state']).toBe('waiting');
  });
});
