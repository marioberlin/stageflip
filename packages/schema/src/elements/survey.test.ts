// packages/schema/src/elements/survey.test.ts
// T-468 — Schema-side roundtrip + reject-malformed tests for the
// `SurveyClipElement` RIRElement variant.
//
// Eighth audience-clip variant on the `Element` discriminated union;
// multi-question survey with type-discriminated per-question schema.
// Mirrors T-467 test layout, with extra coverage for the per-question
// discriminated union.

import { describe, expect, it } from 'vitest';

import { type SurveyClipElement, surveyClipElementSchema } from './survey.js';

const BASE = {
  id: 'el_sv_001',
  transform: { x: 0, y: 0, width: 800, height: 600 },
} as const;

const VALID: SurveyClipElement = {
  ...BASE,
  visible: true,
  locked: false,
  animations: [],
  type: 'survey',
  permissions: ['audience-network'],
  props: {
    questions: [
      {
        id: 'q1',
        type: 'multiple-choice',
        text: 'Which framework?',
        options: ['React', 'Vue', 'Svelte'],
      },
      {
        id: 'q2',
        type: 'open-text',
        text: 'Any comments?',
        maxLength: 280,
      },
      {
        id: 'q3',
        type: 'rating',
        text: 'Rate the session',
        scaleMin: 1,
        scaleMax: 5,
      },
    ],
  },
};

describe('surveyClipElementSchema (T-468)', () => {
  it('parses a minimal valid element with one multiple-choice question', () => {
    const parsed = surveyClipElementSchema.parse({
      ...BASE,
      visible: true,
      locked: false,
      animations: [],
      type: 'survey',
      permissions: ['audience-network'],
      props: {
        questions: [
          {
            id: 'q1',
            type: 'multiple-choice',
            text: 'Pick one',
            options: ['A', 'B'],
          },
        ],
      },
    });
    expect(parsed.type).toBe('survey');
    expect(parsed.props.questions).toHaveLength(1);
    expect(parsed.props.questions[0]?.type).toBe('multiple-choice');
    expect(parsed.permissions).toEqual(['audience-network']);
  });

  it('parses a mixed-type survey with all three question kinds', () => {
    const parsed = surveyClipElementSchema.parse(VALID);
    expect(parsed.props.questions).toHaveLength(3);
    expect(parsed.props.questions[0]?.type).toBe('multiple-choice');
    expect(parsed.props.questions[1]?.type).toBe('open-text');
    expect(parsed.props.questions[2]?.type).toBe('rating');
  });

  it('defaults open-text maxLength to 280 when omitted', () => {
    const parsed = surveyClipElementSchema.parse({
      ...BASE,
      visible: true,
      locked: false,
      animations: [],
      type: 'survey',
      permissions: ['audience-network'],
      props: {
        questions: [{ id: 'q1', type: 'open-text', text: 'Thoughts?' }],
      },
    });
    const q = parsed.props.questions[0];
    expect(q?.type).toBe('open-text');
    if (q?.type === 'open-text') {
      expect(q.maxLength).toBe(280);
    }
  });

  it('accepts a custom open-text maxLength within bounds', () => {
    const parsed = surveyClipElementSchema.parse({
      ...VALID,
      props: {
        questions: [{ id: 'q1', type: 'open-text', text: 'go', maxLength: 1000 }],
      },
    });
    const q = parsed.props.questions[0];
    if (q?.type === 'open-text') {
      expect(q.maxLength).toBe(1000);
    }
  });

  it('accepts an optional sessionId on props', () => {
    const parsed = surveyClipElementSchema.parse({
      ...VALID,
      props: { ...VALID.props, sessionId: 'sess-abc' },
    });
    expect(parsed.props.sessionId).toBe('sess-abc');
  });

  it('accepts rating with labels', () => {
    const parsed = surveyClipElementSchema.parse({
      ...VALID,
      props: {
        questions: [
          {
            id: 'q1',
            type: 'rating',
            text: 'Rate',
            scaleMin: 1,
            scaleMax: 5,
            labels: ['Poor', 'Fair', 'Good', 'Great', 'Excellent'],
          },
        ],
      },
    });
    const q = parsed.props.questions[0];
    if (q?.type === 'rating') {
      expect(q.labels).toEqual(['Poor', 'Fair', 'Good', 'Great', 'Excellent']);
    }
  });

  it('round-trips byte-equal', () => {
    const once = surveyClipElementSchema.parse(VALID);
    const twice = surveyClipElementSchema.parse(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
  });

  it('accepts optional provenance', () => {
    const parsed = surveyClipElementSchema.parse({
      ...VALID,
      provenance: {
        provider: 'audience-native',
        sessionId: 'sess-1',
        snapshotFrame: 0,
        voterCountAtCapture: 15,
        capturedAt: '2026-05-12T00:00:00.000Z',
        snapshotPolicy: 'final',
        clipKind: 'survey',
        aggregation: {
          kind: 'survey',
          questionAggregations: [
            {
              questionId: 'q1',
              type: 'multiple-choice',
              aggregation: {
                kind: 'live-poll-multiple-choice',
                optionCounts: [3, 5, 7],
                totalVotes: 15,
              },
            },
          ],
          totalResponses: 15,
        },
      },
    });
    expect(parsed.provenance?.aggregation.kind).toBe('survey');
  });

  // --- malformed rejection ---

  it('rejects an empty questions array', () => {
    expect(() =>
      surveyClipElementSchema.parse({
        ...VALID,
        props: { questions: [] },
      }),
    ).toThrow();
  });

  it('rejects more than 20 questions', () => {
    const tooMany = Array.from({ length: 21 }, (_, i) => ({
      id: `q${i + 1}`,
      type: 'open-text' as const,
      text: 'go',
    }));
    expect(() =>
      surveyClipElementSchema.parse({
        ...VALID,
        props: { questions: tooMany },
      }),
    ).toThrow();
  });

  it('rejects multiple-choice with fewer than 2 options', () => {
    expect(() =>
      surveyClipElementSchema.parse({
        ...VALID,
        props: {
          questions: [{ id: 'q1', type: 'multiple-choice', text: 'Pick', options: ['only-one'] }],
        },
      }),
    ).toThrow();
  });

  it('rejects multiple-choice with more than 10 options', () => {
    expect(() =>
      surveyClipElementSchema.parse({
        ...VALID,
        props: {
          questions: [
            {
              id: 'q1',
              type: 'multiple-choice',
              text: 'Pick',
              options: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'],
            },
          ],
        },
      }),
    ).toThrow();
  });

  it('rejects multiple-choice with empty option strings', () => {
    expect(() =>
      surveyClipElementSchema.parse({
        ...VALID,
        props: {
          questions: [{ id: 'q1', type: 'multiple-choice', text: 'Pick', options: ['', 'b'] }],
        },
      }),
    ).toThrow();
  });

  it('rejects open-text with maxLength === 0', () => {
    expect(() =>
      surveyClipElementSchema.parse({
        ...VALID,
        props: {
          questions: [{ id: 'q1', type: 'open-text', text: 'Comments', maxLength: 0 }],
        },
      }),
    ).toThrow();
  });

  it('rejects open-text with maxLength > 2000', () => {
    expect(() =>
      surveyClipElementSchema.parse({
        ...VALID,
        props: {
          questions: [{ id: 'q1', type: 'open-text', text: 'Comments', maxLength: 2001 }],
        },
      }),
    ).toThrow();
  });

  it('rejects rating with scaleMin !== 1', () => {
    expect(() =>
      surveyClipElementSchema.parse({
        ...VALID,
        props: {
          questions: [
            { id: 'q1', type: 'rating', text: 'Rate', scaleMin: 0, scaleMax: 5 } as unknown,
          ] as SurveyClipElement['props']['questions'],
        },
      }),
    ).toThrow();
  });

  it('rejects rating with scaleMax < 2', () => {
    expect(() =>
      surveyClipElementSchema.parse({
        ...VALID,
        props: {
          questions: [{ id: 'q1', type: 'rating', text: 'Rate', scaleMin: 1, scaleMax: 1 }],
        },
      }),
    ).toThrow();
  });

  it('rejects rating with scaleMax > 10', () => {
    expect(() =>
      surveyClipElementSchema.parse({
        ...VALID,
        props: {
          questions: [{ id: 'q1', type: 'rating', text: 'Rate', scaleMin: 1, scaleMax: 11 }],
        },
      }),
    ).toThrow();
  });

  it('rejects empty question id', () => {
    expect(() =>
      surveyClipElementSchema.parse({
        ...VALID,
        props: {
          questions: [{ id: '', type: 'open-text', text: 'Hello' }],
        },
      }),
    ).toThrow();
  });

  it('rejects empty question text', () => {
    expect(() =>
      surveyClipElementSchema.parse({
        ...VALID,
        props: {
          questions: [{ id: 'q1', type: 'open-text', text: '' }],
        },
      }),
    ).toThrow();
  });

  it('rejects unknown question type discriminator', () => {
    expect(() =>
      surveyClipElementSchema.parse({
        ...VALID,
        props: {
          questions: [
            {
              id: 'q1',
              type: 'unknown-type' as 'open-text',
              text: 'Hello',
            },
          ],
        },
      }),
    ).toThrow();
  });

  it('rejects unknown extra fields on a question (strict)', () => {
    expect(() =>
      surveyClipElementSchema.parse({
        ...VALID,
        props: {
          questions: [
            {
              id: 'q1',
              type: 'open-text',
              text: 'Hello',
              unknownField: 'oops',
            } as unknown as SurveyClipElement['props']['questions'][number],
          ],
        },
      }),
    ).toThrow();
  });

  it('rejects empty sessionId', () => {
    expect(() =>
      surveyClipElementSchema.parse({
        ...VALID,
        props: { ...VALID.props, sessionId: '' },
      }),
    ).toThrow();
  });

  it('rejects a wrong permissions tuple', () => {
    expect(() =>
      surveyClipElementSchema.parse({
        ...VALID,
        permissions: ['network'] as unknown as SurveyClipElement['permissions'],
      }),
    ).toThrow();
  });

  it('rejects extra permissions entries', () => {
    expect(() =>
      surveyClipElementSchema.parse({
        ...VALID,
        permissions: ['audience-network', 'mic'] as unknown as SurveyClipElement['permissions'],
      }),
    ).toThrow();
  });

  it('rejects unknown top-level discriminator', () => {
    expect(() =>
      surveyClipElementSchema.parse({
        ...VALID,
        type: 'live-quiz' as 'survey',
      }),
    ).toThrow();
  });

  it('rejects unknown extra fields (strict)', () => {
    expect(() =>
      surveyClipElementSchema.parse({
        ...VALID,
        unknownField: 'oops',
      } as unknown as SurveyClipElement),
    ).toThrow();
  });

  it('rejects unknown extra fields on props (strict)', () => {
    expect(() =>
      surveyClipElementSchema.parse({
        ...VALID,
        props: {
          ...VALID.props,
          unknownField: 'x',
        } as unknown as SurveyClipElement['props'],
      }),
    ).toThrow();
  });
});
