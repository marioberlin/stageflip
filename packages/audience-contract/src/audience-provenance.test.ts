// packages/audience-contract/src/audience-provenance.test.ts
// AudienceProvenance schema preview tests — full round-trip + every
// snapshotPolicy enum + clipKind discriminant on the inlined aggregation.

import { describe, expect, it } from 'vitest';

import {
  AUDIENCE_SNAPSHOT_POLICIES,
  type AudienceProvenance,
  audienceProvenanceSchema,
} from './audience-provenance.js';

const validProvenance: AudienceProvenance = {
  provider: 'audience-native',
  sessionId: 'sess-1',
  snapshotFrame: 1500,
  voterCountAtCapture: 500,
  capturedAt: '2026-05-11T00:00:00Z',
  snapshotPolicy: 'final',
  clipKind: 'live-poll-multiple-choice',
  aggregation: {
    kind: 'live-poll-multiple-choice',
    optionCounts: [200, 300],
    totalVotes: 500,
  },
};

describe('AUDIENCE_SNAPSHOT_POLICIES', () => {
  it('enumerates the three policies per ADR-010 §D4', () => {
    expect(AUDIENCE_SNAPSHOT_POLICIES).toEqual(['final', 'peak', 'at-frame']);
  });
});

describe('audienceProvenanceSchema', () => {
  it('parses a valid provenance', () => {
    expect(audienceProvenanceSchema.parse(validProvenance)).toEqual(validProvenance);
  });

  it('round-trips every snapshot policy', () => {
    for (const policy of AUDIENCE_SNAPSHOT_POLICIES) {
      const prov: AudienceProvenance = { ...validProvenance, snapshotPolicy: policy };
      expect(audienceProvenanceSchema.parse(prov).snapshotPolicy).toBe(policy);
    }
  });

  it('round-trips the heatmap provenance (motion-native differentiator)', () => {
    const prov: AudienceProvenance = {
      ...validProvenance,
      clipKind: 'heatmap',
      snapshotPolicy: 'at-frame',
      aggregation: {
        kind: 'heatmap',
        taps: [{ x: 0.4, y: 0.6, intensity: 1 }],
        totalTaps: 1,
        gridResolution: { w: 1920, h: 1080 },
      },
    };
    const parsed = audienceProvenanceSchema.parse(prov);
    expect(parsed.clipKind).toBe('heatmap');
    expect(parsed.aggregation.kind).toBe('heatmap');
  });

  it('round-trips the audience-ai-prompt provenance (cross-product asset-gen)', () => {
    const prov: AudienceProvenance = {
      ...validProvenance,
      clipKind: 'audience-ai-prompt',
      aggregation: {
        kind: 'audience-ai-prompt',
        prompts: [{ id: 'p-1', text: 'a cat', upvotes: 12 }],
        winnerPromptId: 'p-1',
        generatedAssetCacheKey: 'sha256:abcd',
      },
    };
    expect(audienceProvenanceSchema.parse(prov).clipKind).toBe('audience-ai-prompt');
  });

  it('rejects unknown clipKind', () => {
    expect(() =>
      audienceProvenanceSchema.parse({ ...validProvenance, clipKind: 'unknown-kind' }),
    ).toThrow();
  });

  it('rejects unknown snapshotPolicy', () => {
    expect(() =>
      audienceProvenanceSchema.parse({ ...validProvenance, snapshotPolicy: 'rolling' }),
    ).toThrow();
  });

  it('rejects negative snapshotFrame', () => {
    expect(() =>
      audienceProvenanceSchema.parse({ ...validProvenance, snapshotFrame: -1 }),
    ).toThrow();
  });

  it('rejects negative voterCountAtCapture', () => {
    expect(() =>
      audienceProvenanceSchema.parse({ ...validProvenance, voterCountAtCapture: -1 }),
    ).toThrow();
  });

  it('rejects unknown top-level fields (strict)', () => {
    expect(() => audienceProvenanceSchema.parse({ ...validProvenance, extra: 'nope' })).toThrow();
  });

  it('rejects empty provider string', () => {
    expect(() => audienceProvenanceSchema.parse({ ...validProvenance, provider: '' })).toThrow();
  });
});
