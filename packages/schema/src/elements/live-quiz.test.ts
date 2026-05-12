// packages/schema/src/elements/live-quiz.test.ts
// T-465 — Schema-side roundtrip + reject-malformed tests for the
// `LiveQuizClipElement` RIRElement variant.
//
// Fifth audience-clip variant on the `Element` discriminated union.
// Mirrors T-461..T-464 test layout verbatim, swapping the discriminator
// + per-kind shape and adding cross-field validation
// (`correctOptionIndex < options.length`) coverage.

import { describe, expect, it } from 'vitest';

import { type LiveQuizClipElement, liveQuizClipElementSchema } from './live-quiz.js';

const BASE = {
  id: 'el_lqz_001',
  transform: { x: 0, y: 0, width: 800, height: 400 },
} as const;

const VALID: LiveQuizClipElement = {
  ...BASE,
  visible: true,
  locked: false,
  animations: [],
  type: 'live-quiz',
  permissions: ['audience-network'],
  props: {
    questions: [
      {
        id: 'q1',
        text: 'What is 2 + 2?',
        options: ['3', '4', '5', '6'],
        correctOptionIndex: 1,
      },
      {
        id: 'q2',
        text: 'Capital of France?',
        options: ['London', 'Paris', 'Berlin', 'Madrid'],
        correctOptionIndex: 1,
      },
    ],
  },
};

describe('liveQuizClipElementSchema (T-465)', () => {
  it('parses a minimal valid element', () => {
    const parsed = liveQuizClipElementSchema.parse(VALID);
    expect(parsed.type).toBe('live-quiz');
    expect(parsed.props.questions).toHaveLength(2);
    expect(parsed.props.questions[0]?.id).toBe('q1');
    expect(parsed.props.questions[0]?.correctOptionIndex).toBe(1);
    expect(parsed.permissions).toEqual(['audience-network']);
  });

  it('parses a single-question element', () => {
    const parsed = liveQuizClipElementSchema.parse({
      ...BASE,
      visible: true,
      locked: false,
      animations: [],
      type: 'live-quiz',
      permissions: ['audience-network'],
      props: {
        questions: [
          {
            id: 'q1',
            text: 'Pick one',
            options: ['A', 'B'],
            correctOptionIndex: 0,
          },
        ],
      },
    });
    expect(parsed.props.questions).toHaveLength(1);
  });

  it('round-trips byte-equal', () => {
    const once = liveQuizClipElementSchema.parse(VALID);
    const twice = liveQuizClipElementSchema.parse(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
  });

  it('accepts an optional per-question timerSeconds within bounds', () => {
    const parsed = liveQuizClipElementSchema.parse({
      ...VALID,
      props: {
        questions: [
          {
            id: 'q1',
            text: 'Timed?',
            options: ['Yes', 'No'],
            correctOptionIndex: 0,
            timerSeconds: 30,
          },
        ],
      },
    });
    expect(parsed.props.questions[0]?.timerSeconds).toBe(30);
  });

  it('accepts an optional sessionId on props', () => {
    const parsed = liveQuizClipElementSchema.parse({
      ...VALID,
      props: { ...VALID.props, sessionId: 'sess-abc' },
    });
    expect(parsed.props.sessionId).toBe('sess-abc');
  });

  it('accepts optional provenance', () => {
    const parsed = liveQuizClipElementSchema.parse({
      ...VALID,
      provenance: {
        provider: 'audience-native',
        sessionId: 'sess-1',
        snapshotFrame: 0,
        voterCountAtCapture: 21,
        capturedAt: '2026-05-12T00:00:00.000Z',
        snapshotPolicy: 'final',
        clipKind: 'live-quiz',
        aggregation: {
          kind: 'live-quiz',
          activeQuestionId: null,
          questionResults: [
            {
              questionId: 'q1',
              optionCounts: [12, 5, 3, 1],
              correctOptionIndex: 0,
              totalVotes: 21,
              status: 'closed',
            },
          ],
          totalVoters: 21,
        },
      },
    });
    expect(parsed.provenance?.aggregation.kind).toBe('live-quiz');
  });

  it('rejects missing questions array', () => {
    expect(() =>
      liveQuizClipElementSchema.parse({
        ...VALID,
        props: {} as unknown as LiveQuizClipElement['props'],
      }),
    ).toThrow();
  });

  it('rejects an empty questions array (min 1)', () => {
    expect(() =>
      liveQuizClipElementSchema.parse({
        ...VALID,
        props: { questions: [] },
      }),
    ).toThrow();
  });

  it('rejects > 50 questions (max 50)', () => {
    const tooMany = Array.from({ length: 51 }, (_, i) => ({
      id: `q${i}`,
      text: 't',
      options: ['a', 'b'],
      correctOptionIndex: 0,
    }));
    expect(() =>
      liveQuizClipElementSchema.parse({
        ...VALID,
        props: { questions: tooMany },
      }),
    ).toThrow();
  });

  it('rejects < 2 options on any question', () => {
    expect(() =>
      liveQuizClipElementSchema.parse({
        ...VALID,
        props: {
          questions: [
            {
              id: 'q1',
              text: 't',
              options: ['only one'],
              correctOptionIndex: 0,
            },
          ],
        },
      }),
    ).toThrow();
  });

  it('rejects > 6 options on any question', () => {
    expect(() =>
      liveQuizClipElementSchema.parse({
        ...VALID,
        props: {
          questions: [
            {
              id: 'q1',
              text: 't',
              options: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
              correctOptionIndex: 0,
            },
          ],
        },
      }),
    ).toThrow();
  });

  it('rejects correctOptionIndex out of range (>= options.length)', () => {
    expect(() =>
      liveQuizClipElementSchema.parse({
        ...VALID,
        props: {
          questions: [
            {
              id: 'q1',
              text: 't',
              options: ['a', 'b'],
              correctOptionIndex: 2,
            },
          ],
        },
      }),
    ).toThrow();
  });

  it('rejects negative correctOptionIndex', () => {
    expect(() =>
      liveQuizClipElementSchema.parse({
        ...VALID,
        props: {
          questions: [
            {
              id: 'q1',
              text: 't',
              options: ['a', 'b'],
              correctOptionIndex: -1,
            },
          ],
        },
      }),
    ).toThrow();
  });

  it('rejects non-integer correctOptionIndex', () => {
    expect(() =>
      liveQuizClipElementSchema.parse({
        ...VALID,
        props: {
          questions: [
            {
              id: 'q1',
              text: 't',
              options: ['a', 'b'],
              correctOptionIndex: 0.5,
            },
          ],
        },
      }),
    ).toThrow();
  });

  it('rejects empty question id', () => {
    expect(() =>
      liveQuizClipElementSchema.parse({
        ...VALID,
        props: {
          questions: [
            {
              id: '',
              text: 't',
              options: ['a', 'b'],
              correctOptionIndex: 0,
            },
          ],
        },
      }),
    ).toThrow();
  });

  it('rejects empty question text', () => {
    expect(() =>
      liveQuizClipElementSchema.parse({
        ...VALID,
        props: {
          questions: [
            {
              id: 'q1',
              text: '',
              options: ['a', 'b'],
              correctOptionIndex: 0,
            },
          ],
        },
      }),
    ).toThrow();
  });

  it('rejects timerSeconds above 120', () => {
    expect(() =>
      liveQuizClipElementSchema.parse({
        ...VALID,
        props: {
          questions: [
            {
              id: 'q1',
              text: 't',
              options: ['a', 'b'],
              correctOptionIndex: 0,
              timerSeconds: 121,
            },
          ],
        },
      }),
    ).toThrow();
  });

  it('rejects timerSeconds === 0', () => {
    expect(() =>
      liveQuizClipElementSchema.parse({
        ...VALID,
        props: {
          questions: [
            {
              id: 'q1',
              text: 't',
              options: ['a', 'b'],
              correctOptionIndex: 0,
              timerSeconds: 0,
            },
          ],
        },
      }),
    ).toThrow();
  });

  it('rejects a wrong permissions tuple', () => {
    expect(() =>
      liveQuizClipElementSchema.parse({
        ...VALID,
        permissions: ['network'] as unknown as LiveQuizClipElement['permissions'],
      }),
    ).toThrow();
  });

  it('rejects extra permissions entries', () => {
    expect(() =>
      liveQuizClipElementSchema.parse({
        ...VALID,
        permissions: ['audience-network', 'mic'] as unknown as LiveQuizClipElement['permissions'],
      }),
    ).toThrow();
  });

  it('rejects unknown discriminator', () => {
    expect(() =>
      liveQuizClipElementSchema.parse({
        ...VALID,
        type: 'live-qa' as 'live-quiz',
      }),
    ).toThrow();
  });

  it('rejects unknown extra fields (strict)', () => {
    expect(() =>
      liveQuizClipElementSchema.parse({
        ...VALID,
        unknownField: 'oops',
      } as unknown as LiveQuizClipElement),
    ).toThrow();
  });
});
