// packages/audience-contract/src/capability.test.ts
// AudienceCapabilityDescriptor tests — schema round-trip + validator dispatch.

import { describe, expect, it } from 'vitest';

import {
  AUDIENCE_CLIP_KINDS,
  AUDIENCE_PERSISTENCE_TIERS,
  AUDIENCE_VOTER_IDENTITIES,
  type AudienceCapabilityDescriptor,
  audienceCapabilityDescriptorSchema,
  validateAudienceCapability,
} from './capability.js';

const validCapability: AudienceCapabilityDescriptor = {
  persistenceTier: 'durable',
  maxConcurrentVoters: 1000,
  supportedClipKinds: ['live-poll-multiple-choice', 'live-qa', 'heatmap'],
  supportsMotionNative: true,
  voterIdentity: 'either',
  supportsStaticFallback: true,
  maxIngestRateHz: 1000,
  snapshotCadenceHz: 30,
};

describe('AUDIENCE_CLIP_KINDS', () => {
  it('enumerates the eleven discriminants per ADR-010 §D1', () => {
    expect(AUDIENCE_CLIP_KINDS).toHaveLength(11);
    expect(new Set(AUDIENCE_CLIP_KINDS).size).toBe(11);
  });

  it('matches the ADR-009 §D2 + ADR-010 §D1 verbatim list', () => {
    expect(AUDIENCE_CLIP_KINDS).toEqual([
      'live-poll-multiple-choice',
      'live-poll-open-text',
      'live-poll-rating',
      'live-qa',
      'live-quiz',
      'leaderboard',
      'word-cloud',
      'survey',
      'heatmap',
      'reaction-stream',
      'audience-ai-prompt',
    ]);
  });
});

describe('AUDIENCE_PERSISTENCE_TIERS', () => {
  it('enumerates three tiers', () => {
    expect(AUDIENCE_PERSISTENCE_TIERS).toEqual(['durable', 'session-only', 'best-effort']);
  });
});

describe('AUDIENCE_VOTER_IDENTITIES', () => {
  it('enumerates three identity postures', () => {
    expect(AUDIENCE_VOTER_IDENTITIES).toEqual(['anonymous', 'authenticated', 'either']);
  });
});

describe('audienceCapabilityDescriptorSchema', () => {
  it('parses a valid capability descriptor', () => {
    const parsed = audienceCapabilityDescriptorSchema.parse(validCapability);
    expect(parsed).toEqual(validCapability);
  });

  it('round-trips every persistence tier', () => {
    for (const tier of AUDIENCE_PERSISTENCE_TIERS) {
      const cap: AudienceCapabilityDescriptor = { ...validCapability, persistenceTier: tier };
      expect(audienceCapabilityDescriptorSchema.parse(cap).persistenceTier).toBe(tier);
    }
  });

  it('round-trips every voter identity', () => {
    for (const id of AUDIENCE_VOTER_IDENTITIES) {
      const cap: AudienceCapabilityDescriptor = { ...validCapability, voterIdentity: id };
      expect(audienceCapabilityDescriptorSchema.parse(cap).voterIdentity).toBe(id);
    }
  });

  it('round-trips every clip kind in supportedClipKinds', () => {
    for (const kind of AUDIENCE_CLIP_KINDS) {
      const cap: AudienceCapabilityDescriptor = {
        ...validCapability,
        supportedClipKinds: [kind],
      };
      const parsed = audienceCapabilityDescriptorSchema.parse(cap);
      expect(parsed.supportedClipKinds).toEqual([kind]);
    }
  });

  it('accepts the full eleven-clip kind set (native)', () => {
    const cap: AudienceCapabilityDescriptor = {
      ...validCapability,
      supportedClipKinds: AUDIENCE_CLIP_KINDS,
    };
    expect(audienceCapabilityDescriptorSchema.parse(cap).supportedClipKinds).toHaveLength(11);
  });

  it('rejects an empty supportedClipKinds', () => {
    expect(() =>
      audienceCapabilityDescriptorSchema.parse({ ...validCapability, supportedClipKinds: [] }),
    ).toThrow();
  });

  it('rejects unknown clip kinds', () => {
    expect(() =>
      audienceCapabilityDescriptorSchema.parse({
        ...validCapability,
        supportedClipKinds: ['xxxx-unknown-kind'],
      }),
    ).toThrow();
  });

  it('rejects a non-positive maxConcurrentVoters', () => {
    expect(() =>
      audienceCapabilityDescriptorSchema.parse({ ...validCapability, maxConcurrentVoters: 0 }),
    ).toThrow();
  });

  it('rejects a non-positive snapshotCadenceHz', () => {
    expect(() =>
      audienceCapabilityDescriptorSchema.parse({ ...validCapability, snapshotCadenceHz: 0 }),
    ).toThrow();
  });

  it('rejects a non-positive maxIngestRateHz', () => {
    expect(() =>
      audienceCapabilityDescriptorSchema.parse({ ...validCapability, maxIngestRateHz: -1 }),
    ).toThrow();
  });

  it('rejects unknown top-level fields (strict)', () => {
    expect(() =>
      audienceCapabilityDescriptorSchema.parse({ ...validCapability, extra: 'nope' }),
    ).toThrow();
  });
});

describe('validateAudienceCapability', () => {
  it('returns ok:true on valid capability', () => {
    const result = validateAudienceCapability(validCapability);
    expect(result.ok).toBe(true);
    if (result.ok === true) {
      expect(result.capability).toMatchObject({ persistenceTier: 'durable' });
    }
  });

  it('returns ok:false on invalid capability', () => {
    const result = validateAudienceCapability({
      persistenceTier: 'durable',
      maxConcurrentVoters: 1000,
      supportedClipKinds: [],
      supportsMotionNative: false,
      voterIdentity: 'anonymous',
      supportsStaticFallback: true,
      maxIngestRateHz: 100,
      snapshotCadenceHz: 5,
    });
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error).toBeTruthy();
    }
  });

  it('rejects a non-object input', () => {
    const result = validateAudienceCapability(42);
    expect(result.ok).toBe(false);
  });

  it('rejects null', () => {
    const result = validateAudienceCapability(null);
    expect(result.ok).toBe(false);
  });
});
