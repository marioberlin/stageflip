// packages/storage/src/audience-results.test.ts
// T-453 — Unit tests for `audience-results.ts` Zod schemas
// (`AudienceSessionDoc` + `AudienceEventDoc`) per ADR-009 §D5. Asserts:
// round-trip on valid input; strict-key rejection; required-field
// enforcement; voter-token-hash format invariant.

import { describe, expect, it } from 'vitest';

import {
  type AudienceEventDoc,
  type AudienceQuizState,
  type AudienceSessionDoc,
  audienceEventDocSchema,
  audienceQuizStateSchema,
  audienceSessionDocSchema,
} from './audience-results.js';

const validSession: AudienceSessionDoc = {
  sessionId: '01J0AB3F8R3RTKZQ9X4HMRZQAY',
  tenantId: 'tenant-1',
  projectId: 'project-1',
  clipKind: 'live-poll-multiple-choice',
  createdAt: '2026-05-11T00:00:00.000Z',
  closedAt: null,
  voterCount: 0,
  snapshotFrame: null,
  adapterDescriptor: { id: 'audience-native', license: 'MIT' },
  ttlAt: '2026-05-12T00:00:00.000Z',
};

const validEvent: AudienceEventDoc = {
  eventId: '01J0AB3F8R3RTKZQ9X4HMRZQAZ',
  sessionId: validSession.sessionId,
  voterTokenHash: 'a'.repeat(64),
  serverTimestamp: '2026-05-11T00:00:01.000Z',
  clientTimestamp: '2026-05-11T00:00:00.500Z',
  payload: { kind: 'live-poll-multiple-choice', optionIndex: 0 },
  accepted: true,
};

describe('audienceSessionDocSchema', () => {
  it('round-trips a valid open-session doc', () => {
    expect(audienceSessionDocSchema.parse(validSession)).toEqual(validSession);
  });

  it('round-trips a valid closed-session doc with snapshotFrame', () => {
    const closed: AudienceSessionDoc = {
      ...validSession,
      closedAt: '2026-05-11T01:00:00.000Z',
      voterCount: 42,
      snapshotFrame: 1800,
    };
    expect(audienceSessionDocSchema.parse(closed)).toEqual(closed);
  });

  it('rejects unknown keys (strict)', () => {
    expect(() =>
      audienceSessionDocSchema.parse({ ...validSession, extra: 'nope' } as unknown),
    ).toThrow(/unrecognized/i);
  });

  it('rejects an unknown clipKind', () => {
    expect(() =>
      audienceSessionDocSchema.parse({ ...validSession, clipKind: 'not-a-kind' } as unknown),
    ).toThrow();
  });

  it('rejects a negative voterCount', () => {
    expect(() => audienceSessionDocSchema.parse({ ...validSession, voterCount: -1 })).toThrow();
  });

  it('rejects empty tenantId', () => {
    expect(() => audienceSessionDocSchema.parse({ ...validSession, tenantId: '' })).toThrow();
  });

  it('rejects malformed createdAt', () => {
    expect(() => audienceSessionDocSchema.parse({ ...validSession, createdAt: 'now' })).toThrow();
  });

  it('rejects malformed ttlAt', () => {
    expect(() => audienceSessionDocSchema.parse({ ...validSession, ttlAt: 'someday' })).toThrow();
  });

  it('rejects unknown keys inside adapterDescriptor', () => {
    expect(() =>
      audienceSessionDocSchema.parse({
        ...validSession,
        adapterDescriptor: { id: 'x', license: 'MIT', other: 'no' } as unknown,
      }),
    ).toThrow(/unrecognized/i);
  });
});

describe('audienceEventDocSchema', () => {
  it('round-trips a valid accepted event', () => {
    expect(audienceEventDocSchema.parse(validEvent)).toEqual(validEvent);
  });

  it('round-trips a valid rejected event with rejectReason', () => {
    const rejected: AudienceEventDoc = {
      ...validEvent,
      accepted: false,
      rejectReason: 'rate-limited',
    };
    expect(audienceEventDocSchema.parse(rejected)).toEqual(rejected);
  });

  it('rejects unknown keys (strict)', () => {
    expect(() =>
      audienceEventDocSchema.parse({ ...validEvent, surprise: 'no' } as unknown),
    ).toThrow(/unrecognized/i);
  });

  it.each([
    'A'.repeat(64), // uppercase
    'a'.repeat(63), // too short
    'a'.repeat(65), // too long
    'plaintext-voter-token', // not hex
    '', // empty
  ])('rejects malformed voterTokenHash: %s', (bad) => {
    expect(() => audienceEventDocSchema.parse({ ...validEvent, voterTokenHash: bad })).toThrow(
      /voterTokenHash/i,
    );
  });

  it('rejects malformed serverTimestamp', () => {
    expect(() => audienceEventDocSchema.parse({ ...validEvent, serverTimestamp: 'now' })).toThrow();
  });

  it('rejects empty rejectReason if present', () => {
    expect(() =>
      audienceEventDocSchema.parse({ ...validEvent, accepted: false, rejectReason: '' }),
    ).toThrow();
  });

  it('admits an arbitrary payload shape (opaque to the store)', () => {
    // The schema does not validate the payload shape (clip routers do that).
    const parsed = audienceEventDocSchema.parse({
      ...validEvent,
      payload: { kind: 'whatever', anything: ['goes', 'here'] },
    });
    expect(parsed.payload).toEqual({ kind: 'whatever', anything: ['goes', 'here'] });
  });
});

describe('audienceQuizStateSchema (T-473)', () => {
  const validQuizState: AudienceQuizState = {
    activeQuestionIndex: 2,
    scores: { 'voter-hash-a': 1500, 'voter-hash-b': 0 },
    joinedAt: { 'voter-hash-a': 0, 'voter-hash-b': 2 },
  };

  it('round-trips a valid quiz state', () => {
    expect(audienceQuizStateSchema.parse(validQuizState)).toEqual(validQuizState);
  });

  it('round-trips an empty quiz state at question 0', () => {
    const empty: AudienceQuizState = { activeQuestionIndex: 0, scores: {}, joinedAt: {} };
    expect(audienceQuizStateSchema.parse(empty)).toEqual(empty);
  });

  it('rejects a negative activeQuestionIndex', () => {
    expect(() =>
      audienceQuizStateSchema.parse({ ...validQuizState, activeQuestionIndex: -1 }),
    ).toThrow();
  });

  it('rejects a negative score', () => {
    expect(() =>
      audienceQuizStateSchema.parse({ ...validQuizState, scores: { 'voter-hash-a': -1 } }),
    ).toThrow();
  });

  it('rejects unknown keys (strict)', () => {
    expect(() =>
      audienceQuizStateSchema.parse({ ...validQuizState, extra: 'no' } as unknown),
    ).toThrow(/unrecognized/i);
  });
});

describe('audienceSessionDocSchema — quizState extension (T-473)', () => {
  it('round-trips a session doc WITHOUT quizState (non-breaking)', () => {
    // Re-verify the pre-T-473 shape still parses cleanly.
    expect(audienceSessionDocSchema.parse(validSession)).toEqual(validSession);
  });

  it('round-trips a session doc WITH quizState present', () => {
    const withQuiz: AudienceSessionDoc = {
      ...validSession,
      clipKind: 'live-quiz',
      quizState: {
        activeQuestionIndex: 1,
        scores: { 'voter-a': 1000, 'voter-b': 750 },
        joinedAt: { 'voter-a': 0, 'voter-b': 1 },
      },
    };
    expect(audienceSessionDocSchema.parse(withQuiz)).toEqual(withQuiz);
  });

  it('rejects a malformed quizState (negative score)', () => {
    expect(() =>
      audienceSessionDocSchema.parse({
        ...validSession,
        clipKind: 'live-quiz',
        quizState: {
          activeQuestionIndex: 0,
          scores: { 'voter-a': -5 },
          joinedAt: {},
        },
      }),
    ).toThrow();
  });
});
