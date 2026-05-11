// packages/audience-contract/src/aggregation-snapshot.test.ts
// AggregationSnapshot tests — round-trip every clip-kind aggregation
// variant; envelope + FinalSnapshot schemas; cover all eleven discriminants.

import { describe, expect, it } from 'vitest';

import {
  AGGREGATION_KINDS,
  type AggregationSnapshot,
  type AggregationValue,
  type FinalSnapshot,
  aggregationSnapshotSchema,
  aggregationValueSchema,
  finalSnapshotSchema,
} from './aggregation-snapshot.js';

describe('AGGREGATION_KINDS', () => {
  it('enumerates all eleven AudienceClipKind discriminants', () => {
    expect(AGGREGATION_KINDS).toHaveLength(11);
  });

  it('includes leaderboard (derived clip is renderable)', () => {
    expect(AGGREGATION_KINDS).toContain('leaderboard');
  });
});

describe('aggregationValueSchema — per-clip-kind round-trip', () => {
  const samples: Record<(typeof AGGREGATION_KINDS)[number], AggregationValue> = {
    'live-poll-multiple-choice': {
      kind: 'live-poll-multiple-choice',
      optionCounts: [3, 5, 2],
      totalVotes: 10,
    },
    'live-poll-open-text': {
      kind: 'live-poll-open-text',
      entries: [{ text: 'hello', count: 5 }],
      totalVotes: 5,
    },
    'live-poll-rating': {
      kind: 'live-poll-rating',
      scoreCounts: [0, 1, 2, 5, 2],
      totalVotes: 10,
      mean: 3.8,
    },
    'live-qa': {
      kind: 'live-qa',
      questions: [
        {
          id: 'q-1',
          text: 'what?',
          upvotes: 12,
          submittedAt: '2026-05-11T00:00:00Z',
        },
      ],
      totalQuestions: 1,
    },
    'live-quiz': {
      kind: 'live-quiz',
      activeQuestionId: 'q-1',
      questionResults: [
        {
          questionId: 'q-1',
          optionCounts: [3, 7],
          correctOptionIndex: 1,
          totalVotes: 10,
          status: 'active',
        },
      ],
      totalVoters: 10,
    },
    leaderboard: {
      kind: 'leaderboard',
      quizId: 'qz-1',
      ranking: [{ voterToken: 'h-1', score: 100, rank: 1 }],
      totalParticipants: 1,
    },
    'word-cloud': {
      kind: 'word-cloud',
      words: [{ word: 'focus', weight: 12 }],
      totalSubmissions: 12,
    },
    survey: {
      kind: 'survey',
      questionAggregations: [
        {
          questionId: 'q-1',
          type: 'multiple-choice',
          aggregation: {
            kind: 'live-poll-multiple-choice',
            optionCounts: [3, 5],
            totalVotes: 8,
          },
        },
      ],
      totalResponses: 8,
    },
    heatmap: {
      kind: 'heatmap',
      taps: [{ x: 0.5, y: 0.5, intensity: 1 }],
      totalTaps: 1,
      gridResolution: { w: 1920, h: 1080 },
    },
    'reaction-stream': {
      kind: 'reaction-stream',
      emojiCounts: [{ emojiId: 'heart', count: 200, recentBurst: 12 }],
      totalReactions: 200,
    },
    'audience-ai-prompt': {
      kind: 'audience-ai-prompt',
      prompts: [{ id: 'p-1', text: 'cat in a hat', upvotes: 7 }],
      winnerPromptId: 'p-1',
      generatedAssetCacheKey: 'sha256:abcd',
    },
  };

  for (const kind of AGGREGATION_KINDS) {
    it(`round-trips the ${kind} aggregation`, () => {
      const parsed = aggregationValueSchema.parse(samples[kind]);
      expect(parsed.kind).toBe(kind);
    });
  }

  it('round-trips a NaN mean (zero-vote rating session)', () => {
    const parsed = aggregationValueSchema.parse({
      kind: 'live-poll-rating',
      scoreCounts: [0, 0, 0, 0, 0],
      totalVotes: 0,
      mean: Number.NaN,
    });
    if (parsed.kind === 'live-poll-rating') {
      expect(Number.isNaN(parsed.mean)).toBe(true);
    }
  });

  it('admits a null winnerPromptId before voting closes', () => {
    const parsed = aggregationValueSchema.parse({
      kind: 'audience-ai-prompt',
      prompts: [],
      winnerPromptId: null,
      generatedAssetCacheKey: null,
    });
    if (parsed.kind === 'audience-ai-prompt') {
      expect(parsed.winnerPromptId).toBeNull();
    }
  });

  it('rejects heatmap tap x out of [0, 1]', () => {
    expect(() =>
      aggregationValueSchema.parse({
        kind: 'heatmap',
        taps: [{ x: 1.1, y: 0.5, intensity: 1 }],
        totalTaps: 1,
        gridResolution: { w: 100, h: 100 },
      }),
    ).toThrow();
  });

  it('rejects unknown survey question type', () => {
    expect(() =>
      aggregationValueSchema.parse({
        kind: 'survey',
        questionAggregations: [
          {
            questionId: 'q',
            type: 'ranking',
            aggregation: {
              kind: 'live-poll-multiple-choice',
              optionCounts: [1],
              totalVotes: 1,
            },
          },
        ],
        totalResponses: 1,
      }),
    ).toThrow();
  });

  it('rejects unknown clip-kind discriminant', () => {
    expect(() => aggregationValueSchema.parse({ kind: 'mystery', foo: 1 })).toThrow();
  });
});

describe('aggregationSnapshotSchema', () => {
  const envelope: AggregationSnapshot = {
    sessionId: 'sess-1',
    frameNo: 5,
    serverTimestamp: '2026-05-11T00:00:00Z',
    voterCount: 42,
    aggregation: { kind: 'live-poll-multiple-choice', optionCounts: [42], totalVotes: 42 },
  };

  it('parses a valid envelope', () => {
    expect(aggregationSnapshotSchema.parse(envelope).voterCount).toBe(42);
  });

  it('rejects negative frameNo', () => {
    expect(() => aggregationSnapshotSchema.parse({ ...envelope, frameNo: -1 })).toThrow();
  });

  it('rejects envelope with missing aggregation', () => {
    expect(() =>
      aggregationSnapshotSchema.parse({ ...envelope, aggregation: undefined }),
    ).toThrow();
  });
});

describe('finalSnapshotSchema', () => {
  const final: FinalSnapshot = {
    sessionId: 'sess-1',
    frameNo: 100,
    serverTimestamp: '2026-05-11T00:00:00Z',
    voterCount: 1000,
    aggregation: { kind: 'live-poll-multiple-choice', optionCounts: [500, 500], totalVotes: 1000 },
    closedAt: '2026-05-11T00:01:00Z',
    snapshotFrame: 100,
  };

  it('parses a valid FinalSnapshot', () => {
    expect(finalSnapshotSchema.parse(final).snapshotFrame).toBe(100);
  });

  it('rejects missing closedAt', () => {
    expect(() => finalSnapshotSchema.parse({ ...final, closedAt: undefined })).toThrow();
  });

  it('rejects negative snapshotFrame', () => {
    expect(() => finalSnapshotSchema.parse({ ...final, snapshotFrame: -1 })).toThrow();
  });
});
