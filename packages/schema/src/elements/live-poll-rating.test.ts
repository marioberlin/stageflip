// packages/schema/src/elements/live-poll-rating.test.ts
// T-463 — Schema-side roundtrip + reject-malformed tests for the
// `LivePollRatingClipElement` RIRElement variant.
//
// Third audience-clip variant on the `Element` discriminated union.
// Mirrors T-461 + T-462 test layout verbatim, swapping the
// discriminator + per-kind shape.

import { describe, expect, it } from 'vitest';

import {
  type LivePollRatingClipElement,
  livePollRatingClipElementSchema,
} from './live-poll-rating.js';

const BASE = {
  id: 'el_lp_rating_001',
  transform: { x: 0, y: 0, width: 800, height: 400 },
} as const;

const VALID: LivePollRatingClipElement = {
  ...BASE,
  visible: true,
  locked: false,
  animations: [],
  type: 'live-poll-rating',
  permissions: ['audience-network'],
  props: {
    question: 'Rate the talk',
    scaleMin: 1,
    scaleMax: 5,
  },
};

describe('livePollRatingClipElementSchema (T-463)', () => {
  it('parses a minimal valid element', () => {
    const parsed = livePollRatingClipElementSchema.parse(VALID);
    expect(parsed.type).toBe('live-poll-rating');
    expect(parsed.props.question).toBe('Rate the talk');
    expect(parsed.props.scaleMin).toBe(1);
    expect(parsed.props.scaleMax).toBe(5);
    expect(parsed.permissions).toEqual(['audience-network']);
  });

  it('round-trips byte-equal', () => {
    const once = livePollRatingClipElementSchema.parse(VALID);
    const twice = livePollRatingClipElementSchema.parse(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
  });

  it('accepts a custom scaleMax within bounds (10-point scale)', () => {
    const parsed = livePollRatingClipElementSchema.parse({
      ...VALID,
      props: { question: 'NPS?', scaleMin: 1, scaleMax: 10 },
    });
    expect(parsed.props.scaleMax).toBe(10);
  });

  it('accepts optional labels', () => {
    const parsed = livePollRatingClipElementSchema.parse({
      ...VALID,
      props: {
        question: 'Rate',
        scaleMin: 1,
        scaleMax: 5,
        labels: ['Strongly disagree', 'Strongly agree'],
      },
    });
    expect(parsed.props.labels).toEqual(['Strongly disagree', 'Strongly agree']);
  });

  it('accepts an optional sessionId on props', () => {
    const parsed = livePollRatingClipElementSchema.parse({
      ...VALID,
      props: { ...VALID.props, sessionId: 'sess-abc' },
    });
    expect(parsed.props.sessionId).toBe('sess-abc');
  });

  it('accepts optional provenance', () => {
    const parsed = livePollRatingClipElementSchema.parse({
      ...VALID,
      provenance: {
        provider: 'audience-native',
        sessionId: 'sess-1',
        snapshotFrame: 0,
        voterCountAtCapture: 21,
        capturedAt: '2026-05-12T00:00:00.000Z',
        snapshotPolicy: 'final',
        clipKind: 'live-poll-rating',
        aggregation: {
          kind: 'live-poll-rating',
          scoreCounts: [2, 3, 5, 7, 4],
          totalVotes: 21,
          mean: 3.38,
        },
      },
    });
    expect(parsed.provenance?.aggregation.kind).toBe('live-poll-rating');
  });

  it('rejects missing question', () => {
    expect(() =>
      livePollRatingClipElementSchema.parse({
        ...VALID,
        props: { scaleMin: 1, scaleMax: 5 } as unknown as LivePollRatingClipElement['props'],
      }),
    ).toThrow();
  });

  it('rejects empty question (min 1 char)', () => {
    expect(() =>
      livePollRatingClipElementSchema.parse({
        ...VALID,
        props: { question: '', scaleMin: 1, scaleMax: 5 },
      }),
    ).toThrow();
  });

  it('rejects scaleMin !== 1 (literal-typed at the schema layer)', () => {
    expect(() =>
      livePollRatingClipElementSchema.parse({
        ...VALID,
        props: {
          question: 'q',
          scaleMin: 0,
          scaleMax: 5,
        } as unknown as LivePollRatingClipElement['props'],
      }),
    ).toThrow();
    expect(() =>
      livePollRatingClipElementSchema.parse({
        ...VALID,
        props: {
          question: 'q',
          scaleMin: 2,
          scaleMax: 5,
        } as unknown as LivePollRatingClipElement['props'],
      }),
    ).toThrow();
  });

  it('rejects scaleMax below 2', () => {
    expect(() =>
      livePollRatingClipElementSchema.parse({
        ...VALID,
        props: { question: 'q', scaleMin: 1, scaleMax: 1 },
      }),
    ).toThrow();
  });

  it('rejects scaleMax above 10', () => {
    expect(() =>
      livePollRatingClipElementSchema.parse({
        ...VALID,
        props: { question: 'q', scaleMin: 1, scaleMax: 11 },
      }),
    ).toThrow();
  });

  it('rejects non-integer scaleMax', () => {
    expect(() =>
      livePollRatingClipElementSchema.parse({
        ...VALID,
        props: { question: 'q', scaleMin: 1, scaleMax: 5.5 },
      }),
    ).toThrow();
  });

  it('rejects a wrong permissions tuple', () => {
    expect(() =>
      livePollRatingClipElementSchema.parse({
        ...VALID,
        permissions: ['network'] as unknown as LivePollRatingClipElement['permissions'],
      }),
    ).toThrow();
  });

  it('rejects extra permissions entries', () => {
    expect(() =>
      livePollRatingClipElementSchema.parse({
        ...VALID,
        permissions: [
          'audience-network',
          'mic',
        ] as unknown as LivePollRatingClipElement['permissions'],
      }),
    ).toThrow();
  });

  it('rejects unknown discriminator', () => {
    expect(() =>
      livePollRatingClipElementSchema.parse({
        ...VALID,
        type: 'live-poll-multiple-choice' as 'live-poll-rating',
      }),
    ).toThrow();
  });

  it('rejects unknown extra fields (strict)', () => {
    expect(() =>
      livePollRatingClipElementSchema.parse({
        ...VALID,
        unknownField: 'oops',
      } as unknown as LivePollRatingClipElement),
    ).toThrow();
  });
});
