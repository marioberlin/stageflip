// packages/schema/src/elements/leaderboard.test.ts
// T-466 — Schema-side roundtrip + reject-malformed tests for the
// `LeaderboardClipElement` RIRElement variant.
//
// Sixth audience-clip variant on the `Element` discriminated union;
// first DERIVED clip (`LeaderboardVote = never` per ADR-010 §D2).
// Mirrors T-461..T-465 test layout verbatim, swapping the
// discriminator + per-kind shape.

import { describe, expect, it } from 'vitest';

import { type LeaderboardClipElement, leaderboardClipElementSchema } from './leaderboard.js';

const BASE = {
  id: 'el_lb_001',
  transform: { x: 0, y: 0, width: 800, height: 400 },
} as const;

const VALID: LeaderboardClipElement = {
  ...BASE,
  visible: true,
  locked: false,
  animations: [],
  type: 'leaderboard',
  permissions: ['audience-network'],
  props: {
    quizId: 'quiz-1',
    topN: 10,
  },
};

describe('leaderboardClipElementSchema (T-466)', () => {
  it('parses a minimal valid element', () => {
    const parsed = leaderboardClipElementSchema.parse(VALID);
    expect(parsed.type).toBe('leaderboard');
    expect(parsed.props.quizId).toBe('quiz-1');
    expect(parsed.props.topN).toBe(10);
    expect(parsed.permissions).toEqual(['audience-network']);
  });

  it('defaults topN to 10 when omitted', () => {
    const parsed = leaderboardClipElementSchema.parse({
      ...BASE,
      visible: true,
      locked: false,
      animations: [],
      type: 'leaderboard',
      permissions: ['audience-network'],
      props: {
        quizId: 'quiz-x',
      },
    });
    expect(parsed.props.topN).toBe(10);
  });

  it('accepts a custom topN within bounds', () => {
    const parsed = leaderboardClipElementSchema.parse({
      ...VALID,
      props: { quizId: 'q', topN: 25 },
    });
    expect(parsed.props.topN).toBe(25);
  });

  it('accepts an optional title', () => {
    const parsed = leaderboardClipElementSchema.parse({
      ...VALID,
      props: { ...VALID.props, title: 'Final Standings' },
    });
    expect(parsed.props.title).toBe('Final Standings');
  });

  it('accepts an optional sessionId on props', () => {
    const parsed = leaderboardClipElementSchema.parse({
      ...VALID,
      props: { ...VALID.props, sessionId: 'sess-abc' },
    });
    expect(parsed.props.sessionId).toBe('sess-abc');
  });

  it('round-trips byte-equal', () => {
    const once = leaderboardClipElementSchema.parse(VALID);
    const twice = leaderboardClipElementSchema.parse(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
  });

  it('accepts optional provenance', () => {
    const parsed = leaderboardClipElementSchema.parse({
      ...VALID,
      provenance: {
        provider: 'audience-native',
        sessionId: 'sess-1',
        snapshotFrame: 0,
        voterCountAtCapture: 21,
        capturedAt: '2026-05-12T00:00:00.000Z',
        snapshotPolicy: 'final',
        clipKind: 'leaderboard',
        aggregation: {
          kind: 'leaderboard',
          quizId: 'quiz-1',
          ranking: [{ voterToken: 'hash-a', displayName: 'Alice', score: 1500, rank: 1 }],
          totalParticipants: 21,
        },
      },
    });
    expect(parsed.provenance?.aggregation.kind).toBe('leaderboard');
  });

  it('rejects empty quizId', () => {
    expect(() =>
      leaderboardClipElementSchema.parse({
        ...VALID,
        props: { quizId: '' },
      }),
    ).toThrow();
  });

  it('rejects missing quizId', () => {
    expect(() =>
      leaderboardClipElementSchema.parse({
        ...VALID,
        props: {} as unknown as LeaderboardClipElement['props'],
      }),
    ).toThrow();
  });

  it('rejects empty title', () => {
    expect(() =>
      leaderboardClipElementSchema.parse({
        ...VALID,
        props: { ...VALID.props, title: '' },
      }),
    ).toThrow();
  });

  it('rejects topN === 0', () => {
    expect(() =>
      leaderboardClipElementSchema.parse({
        ...VALID,
        props: { quizId: 'q', topN: 0 },
      }),
    ).toThrow();
  });

  it('rejects negative topN', () => {
    expect(() =>
      leaderboardClipElementSchema.parse({
        ...VALID,
        props: { quizId: 'q', topN: -1 },
      }),
    ).toThrow();
  });

  it('rejects topN > 100', () => {
    expect(() =>
      leaderboardClipElementSchema.parse({
        ...VALID,
        props: { quizId: 'q', topN: 101 },
      }),
    ).toThrow();
  });

  it('rejects non-integer topN', () => {
    expect(() =>
      leaderboardClipElementSchema.parse({
        ...VALID,
        props: { quizId: 'q', topN: 1.5 },
      }),
    ).toThrow();
  });

  it('rejects empty sessionId', () => {
    expect(() =>
      leaderboardClipElementSchema.parse({
        ...VALID,
        props: { ...VALID.props, sessionId: '' },
      }),
    ).toThrow();
  });

  it('rejects a wrong permissions tuple', () => {
    expect(() =>
      leaderboardClipElementSchema.parse({
        ...VALID,
        permissions: ['network'] as unknown as LeaderboardClipElement['permissions'],
      }),
    ).toThrow();
  });

  it('rejects extra permissions entries', () => {
    expect(() =>
      leaderboardClipElementSchema.parse({
        ...VALID,
        permissions: [
          'audience-network',
          'mic',
        ] as unknown as LeaderboardClipElement['permissions'],
      }),
    ).toThrow();
  });

  it('rejects unknown discriminator', () => {
    expect(() =>
      leaderboardClipElementSchema.parse({
        ...VALID,
        type: 'live-quiz' as 'leaderboard',
      }),
    ).toThrow();
  });

  it('rejects unknown extra fields (strict)', () => {
    expect(() =>
      leaderboardClipElementSchema.parse({
        ...VALID,
        unknownField: 'oops',
      } as unknown as LeaderboardClipElement),
    ).toThrow();
  });

  it('rejects unknown extra fields on props (strict)', () => {
    expect(() =>
      leaderboardClipElementSchema.parse({
        ...VALID,
        props: { ...VALID.props, unknownField: 'x' } as unknown as LeaderboardClipElement['props'],
      }),
    ).toThrow();
  });
});
