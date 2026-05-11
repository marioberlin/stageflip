// packages/audience-contract/src/audience-provenance.ts
// `AudienceProvenance` schema preview. Verbatim from ADR-010 §D5.
// The audience analog of `MediaProvenance` (ADR-008 §D2): a strict, optional
// slot on the persisted clip element capturing how the static-fallback
// snapshot was produced, when, and from which session.
//
// The full element-base merge + canonical Zod schema lands in T-460
// (`@stageflip/schema` extension). T-452 ships this preview so the consumer
// service (T-453) can return a typed `FinalSnapshot` companion that
// downstream callers cast into `AudienceProvenance` shape.

import { z } from 'zod';

import { type AggregationValue, aggregationValueSchema } from './aggregation-snapshot.js';
import { AUDIENCE_CLIP_KINDS, type AudienceClipKind } from './capability.js';

// ----------------------------------------------------------------------------
// Snapshot policy (ADR-010 §D4)
// ----------------------------------------------------------------------------

/**
 * Snapshot-selection policy used to pick the `snapshotFrame` at export
 * time. Per ADR-010 §D4. `final` is the default for most clips;
 * ReactionStream defaults to `peak`; HeatmapClip uses `at-frame` when
 * pinned (otherwise `final`).
 */
export const AUDIENCE_SNAPSHOT_POLICIES = ['final', 'peak', 'at-frame'] as const;
export type AudienceSnapshotPolicy = (typeof AUDIENCE_SNAPSHOT_POLICIES)[number];

// ----------------------------------------------------------------------------
// AudienceProvenance (ADR-010 §D5)
// ----------------------------------------------------------------------------

/**
 * Audience provenance slot every persisted audience-clip element carries.
 * Per ADR-010 §D5.
 *
 * The `aggregation` payload is inlined (not pointer-only) so that an
 * exported slide remains renderable indefinitely even after the
 * backend session document has TTL'd out per ADR-009 §D5.
 *
 * Per ADR-010 §D5 schema-evolution posture: `aggregation`'s variants are
 * discriminated by `kind` and stable-forever; `AudienceProvenance` itself
 * is additive — new fields land as optional slots.
 */
export interface AudienceProvenance {
  /** Adapter that served the session (descriptor.id from ADR-009 §D2). */
  readonly provider: string;

  /** Stable session id (the `sessionId` from ADR-009 §D2). */
  readonly sessionId: string;

  /** Frame number of the snapshot the staticFallback path renders. */
  readonly snapshotFrame: number;

  /** Voter count captured at the snapshot frame. */
  readonly voterCountAtCapture: number;

  /** ISO 8601 of session close (matches `closedAt` from ADR-009 §D5). */
  readonly capturedAt: string;

  /** Snapshot-selection policy used to pick the `snapshotFrame` (per §D4). */
  readonly snapshotPolicy: AudienceSnapshotPolicy;

  /** The clip kind this provenance is for. */
  readonly clipKind: AudienceClipKind;

  /** The persisted aggregation payload — typed per §D3 + discriminated by `kind`. */
  readonly aggregation: AggregationValue;
}

export const audienceProvenanceSchema = z
  .object({
    provider: z.string().min(1),
    sessionId: z.string().min(1),
    snapshotFrame: z.number().int().nonnegative(),
    voterCountAtCapture: z.number().int().nonnegative(),
    capturedAt: z.string().min(1),
    snapshotPolicy: z.enum(AUDIENCE_SNAPSHOT_POLICIES),
    clipKind: z.enum(AUDIENCE_CLIP_KINDS),
    aggregation: aggregationValueSchema,
  })
  .strict();
