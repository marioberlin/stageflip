// packages/audience-contract/src/capability.ts
// `AudienceCapabilityDescriptor` + Zod schema + capability validator.
// Verbatim from ADR-009 §D2. The validator plugs into T-418's
// `CapabilityDescriptorParser` via `buildValidatorMap({ 'audience-backend':
// validateAudienceCapability })`.
//
// The audience modality exposes a single provider interface
// (`AudienceBackendProvider`); native + every vendor adapter implements it
// against the same descriptor shape (ADR-009 §D2 unification rationale).

import type { CapabilityValidator } from '@stageflip/adapters-core';
import { z } from 'zod';

// ----------------------------------------------------------------------------
// AudienceClipKind — the eleven discriminants per ADR-009 §D2 / ADR-010 §D1
// ----------------------------------------------------------------------------

/**
 * Audience clip kinds the v1 audience family ships. Eleven discriminants
 * spanning nine clip families (LivePoll has three sub-variants). Per
 * ADR-009 §D2 and ADR-010 §D1.
 */
export const AUDIENCE_CLIP_KINDS = [
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
] as const;

export type AudienceClipKind = (typeof AUDIENCE_CLIP_KINDS)[number];

// ----------------------------------------------------------------------------
// Capability descriptor enums
// ----------------------------------------------------------------------------

/**
 * Persistence tier the backend supports. `durable` means events + snapshots
 * survive a backend restart (native + vendor with durable APIs);
 * `session-only` means state persists within a running session;
 * `best-effort` admits no durability guarantees (ephemeral vendor surfaces).
 */
export const AUDIENCE_PERSISTENCE_TIERS = ['durable', 'session-only', 'best-effort'] as const;
export type AudiencePersistenceTier = (typeof AUDIENCE_PERSISTENCE_TIERS)[number];

/**
 * Voter identity posture. `anonymous` is the default (vendor adapters);
 * `authenticated` activates when the tenant wires SSO into the voter
 * landing page; `either` admits both.
 */
export const AUDIENCE_VOTER_IDENTITIES = ['anonymous', 'authenticated', 'either'] as const;
export type AudienceVoterIdentity = (typeof AUDIENCE_VOTER_IDENTITIES)[number];

// ----------------------------------------------------------------------------
// AudienceCapabilityDescriptor (ADR-009 §D2)
// ----------------------------------------------------------------------------

/**
 * Capability shape the audience-backend modality declares. Per ADR-009 §D2.
 *
 * `supportedClipKinds` enumerates which `AudienceClipKind` discriminants the
 * adapter can host. Vendor adapters typically cover a subset
 * (e.g., Slido omits `heatmap` + `reaction-stream` + `audience-ai-prompt`);
 * native covers all eleven. The routing engine filters per requested kind.
 *
 * `supportsMotionNative === true` is the marquee differentiator flag — only
 * adapters that can render the three motion-native clips (HeatmapClip,
 * ReactionStreamClip, AudienceAiPromptClip) declare it.
 *
 * `snapshotCadenceHz` is the rate at which the backend emits aggregation
 * snapshots on the `subscribe()` stream; default 30 Hz for live-aggregating
 * clips, 5 Hz for ReactionStream (per ADR-009 §D5 + ADR-010 §D3).
 */
export interface AudienceCapabilityDescriptor {
  /** Persistence tier the backend supports. */
  readonly persistenceTier: AudiencePersistenceTier;

  /** Maximum concurrent voters per session this adapter advertises. */
  readonly maxConcurrentVoters: number;

  /**
   * Clip kinds this adapter can host. At least one. Vendor adapters
   * typically cover a subset of the eleven discriminants.
   */
  readonly supportedClipKinds: readonly AudienceClipKind[];

  /**
   * Whether the adapter supports the three motion-native differentiators
   * (Heatmap / ReactionStream / AudienceAiPrompt).
   */
  readonly supportsMotionNative: boolean;

  /** Voter identity posture. */
  readonly voterIdentity: AudienceVoterIdentity;

  /**
   * Whether the backend supports the `staticFallback` snapshot contract.
   * Per ADR-010 §D4 — adapters that do not durably persist snapshots
   * declare `false`; export pipelines refuse those adapters.
   */
  readonly supportsStaticFallback: boolean;

  /**
   * Maximum events/second per session the backend ingests before
   * backpressure kicks in. Per ADR-009 §D3.
   */
  readonly maxIngestRateHz: number;

  /**
   * Snapshot cadence the backend emits on the `subscribe()` stream (Hz).
   * Per ADR-009 §D5.
   */
  readonly snapshotCadenceHz: number;
}

export const audienceCapabilityDescriptorSchema = z
  .object({
    persistenceTier: z.enum(AUDIENCE_PERSISTENCE_TIERS),
    maxConcurrentVoters: z.number().int().positive(),
    supportedClipKinds: z.array(z.enum(AUDIENCE_CLIP_KINDS)).min(1).readonly(),
    supportsMotionNative: z.boolean(),
    voterIdentity: z.enum(AUDIENCE_VOTER_IDENTITIES),
    supportsStaticFallback: z.boolean(),
    maxIngestRateHz: z.number().positive(),
    snapshotCadenceHz: z.number().positive(),
  })
  .strict();

/**
 * Capability validator that plugs into T-418's `CapabilityDescriptorParser`.
 * Wire at host boot via `buildValidatorMap({ 'audience-backend':
 * validateAudienceCapability })`.
 */
export const validateAudienceCapability: CapabilityValidator = (capability) => {
  const result = audienceCapabilityDescriptorSchema.safeParse(capability);
  if (result.success) {
    return { ok: true, capability: result.data as Record<string, unknown> };
  }
  return { ok: false, error: result.error.message };
};
