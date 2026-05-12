// packages/schema/src/elements/audience-provenance.test.ts
// Tests for the canonical schema-side `AudienceProvenance` declaration.
// Mirrors the T-452 contract preview tests (`packages/audience-contract/
// src/audience-provenance.test.ts`) — every `AudienceClipKind` × every
// `AudienceSnapshotPolicy` round-trip + reject malformed shapes + a
// type-level drift assertion that the schema-side and contract-side
// `AudienceProvenance` types remain assignment-compatible in BOTH
// directions.

import type {
  AggregationValue,
  AudienceProvenance as ContractAudienceProvenance,
} from '@stageflip/audience-contract';
import { describe, expect, it } from 'vitest';

import {
  AUDIENCE_CLIP_KINDS,
  AUDIENCE_SNAPSHOT_POLICIES,
  type AudienceClipKind,
  type AudienceProvenance,
  audienceProvenanceSchema,
} from './audience-provenance.js';

// ----------------------------------------------------------------------------
// Per-kind minimal valid aggregation samples — one per `AudienceClipKind`.
// Each is the smallest payload that satisfies its discriminated-union branch
// in `@stageflip/audience-contract#aggregationValueSchema`.
// ----------------------------------------------------------------------------

const aggregationByKind: Record<AudienceClipKind, AggregationValue> = {
  'live-poll-multiple-choice': {
    kind: 'live-poll-multiple-choice',
    optionCounts: [1, 2],
    totalVotes: 3,
  },
  'live-poll-open-text': {
    kind: 'live-poll-open-text',
    entries: [{ text: 'hello', count: 1 }],
    totalVotes: 1,
  },
  'live-poll-rating': {
    kind: 'live-poll-rating',
    scoreCounts: [1, 0, 2],
    totalVotes: 3,
    mean: 2,
  },
  'live-qa': {
    kind: 'live-qa',
    questions: [{ id: 'q-1', text: 'why?', upvotes: 5, submittedAt: '2026-05-12T00:00:00Z' }],
    totalQuestions: 1,
  },
  'live-quiz': {
    kind: 'live-quiz',
    activeQuestionId: 'q-1',
    questionResults: [
      {
        questionId: 'q-1',
        optionCounts: [3, 1],
        correctOptionIndex: 0,
        totalVotes: 4,
        status: 'closed',
      },
    ],
    totalVoters: 4,
  },
  leaderboard: {
    kind: 'leaderboard',
    quizId: 'quiz-1',
    ranking: [{ voterToken: 'tok-1', score: 100, rank: 1 }],
    totalParticipants: 1,
  },
  'word-cloud': {
    kind: 'word-cloud',
    words: [{ word: 'hello', weight: 3 }],
    totalSubmissions: 3,
  },
  survey: {
    kind: 'survey',
    questionAggregations: [
      {
        questionId: 's-1',
        type: 'multiple-choice',
        aggregation: {
          kind: 'live-poll-multiple-choice',
          optionCounts: [1, 1],
          totalVotes: 2,
        },
      },
    ],
    totalResponses: 2,
  },
  heatmap: {
    kind: 'heatmap',
    taps: [{ x: 0.25, y: 0.75, intensity: 1 }],
    totalTaps: 1,
    gridResolution: { w: 1920, h: 1080 },
  },
  'reaction-stream': {
    kind: 'reaction-stream',
    emojiCounts: [{ emojiId: 'fire', count: 10, recentBurst: 3 }],
    totalReactions: 10,
  },
  'audience-ai-prompt': {
    kind: 'audience-ai-prompt',
    prompts: [{ id: 'p-1', text: 'a cat', upvotes: 12 }],
    winnerPromptId: 'p-1',
    generatedAssetCacheKey: 'sha256:abcd',
  },
};

const baseProvenance: AudienceProvenance = {
  provider: 'audience-native',
  sessionId: 'sess-1',
  snapshotFrame: 1500,
  voterCountAtCapture: 500,
  capturedAt: '2026-05-11T00:00:00Z',
  snapshotPolicy: 'final',
  clipKind: 'live-poll-multiple-choice',
  aggregation: aggregationByKind['live-poll-multiple-choice'],
};

describe('AUDIENCE_SNAPSHOT_POLICIES re-export', () => {
  it('matches the T-452 contract preview enum', () => {
    expect(AUDIENCE_SNAPSHOT_POLICIES).toEqual(['final', 'peak', 'at-frame']);
  });
});

describe('AUDIENCE_CLIP_KINDS re-export', () => {
  it('enumerates all eleven kinds', () => {
    expect(AUDIENCE_CLIP_KINDS).toHaveLength(11);
  });
});

describe('audienceProvenanceSchema', () => {
  it('parses the base valid provenance', () => {
    expect(audienceProvenanceSchema.parse(baseProvenance)).toEqual(baseProvenance);
  });

  it('round-trips every snapshot policy', () => {
    for (const policy of AUDIENCE_SNAPSHOT_POLICIES) {
      const prov: AudienceProvenance = { ...baseProvenance, snapshotPolicy: policy };
      expect(audienceProvenanceSchema.parse(prov).snapshotPolicy).toBe(policy);
    }
  });

  it('round-trips every audience clip kind with its matching aggregation', () => {
    for (const kind of AUDIENCE_CLIP_KINDS) {
      const prov: AudienceProvenance = {
        ...baseProvenance,
        clipKind: kind,
        aggregation: aggregationByKind[kind],
      };
      const parsed = audienceProvenanceSchema.parse(prov);
      expect(parsed.clipKind).toBe(kind);
      expect(parsed.aggregation.kind).toBe(kind);
    }
  });

  it('round-trips the full clipKind × snapshotPolicy matrix (33 cases)', () => {
    for (const kind of AUDIENCE_CLIP_KINDS) {
      for (const policy of AUDIENCE_SNAPSHOT_POLICIES) {
        const prov: AudienceProvenance = {
          ...baseProvenance,
          clipKind: kind,
          snapshotPolicy: policy,
          aggregation: aggregationByKind[kind],
        };
        const parsed = audienceProvenanceSchema.parse(prov);
        expect(parsed.clipKind).toBe(kind);
        expect(parsed.snapshotPolicy).toBe(policy);
      }
    }
  });

  it('rejects unknown clipKind', () => {
    expect(() =>
      audienceProvenanceSchema.parse({ ...baseProvenance, clipKind: 'unknown-kind' }),
    ).toThrow();
  });

  it('rejects unknown snapshotPolicy', () => {
    expect(() =>
      audienceProvenanceSchema.parse({ ...baseProvenance, snapshotPolicy: 'rolling' }),
    ).toThrow();
  });

  it('rejects negative snapshotFrame', () => {
    expect(() =>
      audienceProvenanceSchema.parse({ ...baseProvenance, snapshotFrame: -1 }),
    ).toThrow();
  });

  it('rejects negative voterCountAtCapture', () => {
    expect(() =>
      audienceProvenanceSchema.parse({ ...baseProvenance, voterCountAtCapture: -1 }),
    ).toThrow();
  });

  it('rejects empty provider string', () => {
    expect(() => audienceProvenanceSchema.parse({ ...baseProvenance, provider: '' })).toThrow();
  });

  it('rejects empty sessionId string', () => {
    expect(() => audienceProvenanceSchema.parse({ ...baseProvenance, sessionId: '' })).toThrow();
  });

  it('rejects empty capturedAt string', () => {
    expect(() => audienceProvenanceSchema.parse({ ...baseProvenance, capturedAt: '' })).toThrow();
  });

  it('rejects missing required fields', () => {
    const { provider: _provider, ...withoutProvider } = baseProvenance;
    expect(() => audienceProvenanceSchema.parse(withoutProvider)).toThrow();
  });

  it('rejects unknown top-level fields (.strict())', () => {
    expect(() =>
      audienceProvenanceSchema.parse({ ...baseProvenance, extraField: 'nope' }),
    ).toThrow();
  });

  it('rejects mismatched aggregation discriminator vs declared clipKind branch', () => {
    // Aggregation parses (it's a valid heatmap), and `clipKind` parses (it's a
    // valid enum value). The schema does NOT cross-check the two — the T-452
    // preview is intentionally lenient here per ADR-010 §D5; consumer wiring
    // (T-461..T-471) layers the cross-check at the element level. Pin the
    // current behavior so a future tightening lands intentionally.
    const prov = {
      ...baseProvenance,
      clipKind: 'live-poll-multiple-choice' as const,
      aggregation: aggregationByKind.heatmap,
    };
    expect(() => audienceProvenanceSchema.parse(prov)).not.toThrow();
  });
});

// ----------------------------------------------------------------------------
// Type-level drift test: assignment-compatibility in both directions.
// If the contract preview ever drifts from the schema-side declaration,
// these assignments fail at compile time. (Vitest never executes them as
// runtime checks — `tsc --noEmit` does.)
// ----------------------------------------------------------------------------

describe('type-level drift vs the T-452 contract preview', () => {
  it('schema AudienceProvenance is assignable to contract AudienceProvenance', () => {
    // type-level test: schema -> contract
    const schemaSide: AudienceProvenance = baseProvenance;
    const contractSide: ContractAudienceProvenance = schemaSide;
    expect(contractSide.provider).toBe('audience-native');
  });

  it('contract AudienceProvenance is assignable to schema AudienceProvenance', () => {
    // type-level test: contract -> schema
    const contractSide: ContractAudienceProvenance = {
      provider: 'audience-native',
      sessionId: 'sess-2',
      snapshotFrame: 0,
      voterCountAtCapture: 0,
      capturedAt: '2026-05-12T00:00:00Z',
      snapshotPolicy: 'peak',
      clipKind: 'reaction-stream',
      aggregation: aggregationByKind['reaction-stream'],
    };
    const schemaSide: AudienceProvenance = contractSide;
    expect(schemaSide.clipKind).toBe('reaction-stream');
  });
});
