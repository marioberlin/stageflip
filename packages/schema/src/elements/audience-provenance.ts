// packages/schema/src/elements/audience-provenance.ts
// AudienceProvenance schema — canonical schema-side declaration. Mirrors
// the T-452 preview shipped in `@stageflip/audience-contract` verbatim.
// Per ADR-010 §D5; the audience analog of `MediaProvenance` (ADR-008 §D2 /
// `./media-provenance.ts`).
//
// Optional, strict slot every persisted audience-clip element will carry
// (the per-element `provenance?: AudienceProvenance` slot wires up in
// T-461..T-471, one per audience-clip family). Captures HOW the
// static-fallback snapshot was produced, WHEN, from WHICH session, and
// the inlined `aggregation` payload (per ADR-009 §D5: aggregation is
// inlined — not a pointer — so an exported slide remains renderable
// indefinitely after the backend session document has TTL'd out).
//
// Single source of truth for the discriminator: this module imports
// `aggregationValueSchema` + `AUDIENCE_SNAPSHOT_POLICIES` +
// `AUDIENCE_CLIP_KINDS` from `@stageflip/audience-contract`. The contract
// package owns the per-kind payload shapes; the schema package owns the
// element-side declaration that downstream audience-clip schemas import.
//
// §13 (CLAUDE.md) deferral: Render verification deferred to consumers —
// per CLAUDE.md §13 option 3: T-461..T-471 (per-clip integration tests
// driving each element variant through the renderer via T-454's
// `StaticFallbackRenderer`) + T-476 (Cluster I parity fixtures + PO
// ratification). T-460 ships ONLY the type; no element variant references
// it yet, so pixel-level verification is not yet possible. The roundtrip
// test in this module verifies the SCHEMA layer is non-breaking + matches
// the T-452 contract preview, which is necessary but explicitly NOT
// sufficient for §13 (the T-348-class wiring-only failure mode the
// regression doc warns against).

import {
  AUDIENCE_CLIP_KINDS,
  AUDIENCE_SNAPSHOT_POLICIES,
  aggregationValueSchema,
} from '@stageflip/audience-contract';
import { z } from 'zod';

/**
 * Snapshot-selection policy used to pick the `snapshotFrame` at export
 * time. Per ADR-010 §D4. Re-exported from `@stageflip/audience-contract`
 * so downstream audience-clip schemas (T-461..T-471) can depend on
 * `@stageflip/schema` only — single import surface, mirroring the
 * `MediaProvenance` pattern.
 */
export { AUDIENCE_SNAPSHOT_POLICIES } from '@stageflip/audience-contract';
export type { AudienceSnapshotPolicy } from '@stageflip/audience-contract';

/**
 * Audience clip kinds (eleven discriminants spanning nine clip families;
 * LivePoll has three sub-variants). Per ADR-009 §D2 / ADR-010 §D1.
 * Re-exported from `@stageflip/audience-contract` for the same reason as
 * `AUDIENCE_SNAPSHOT_POLICIES` above.
 */
export { AUDIENCE_CLIP_KINDS } from '@stageflip/audience-contract';
export type { AudienceClipKind } from '@stageflip/audience-contract';

/**
 * Canonical Zod schema for the `AudienceProvenance` slot. Mirrors the
 * T-452 contract preview verbatim — same fields, same constraints, same
 * `.strict()` posture, same inlined `aggregation` discriminator (sourced
 * from `@stageflip/audience-contract#aggregationValueSchema`).
 *
 * Field-by-field (per ADR-010 §D5):
 *
 *   - `provider` — adapter id from `AdapterDescriptor.id` (per ADR-009
 *     §D2; e.g. `'audience-native'`, `'audience-mentimeter'`).
 *   - `sessionId` — stable session id (per ADR-009 §D2).
 *   - `snapshotFrame` — frame number of the snapshot the staticFallback
 *     path renders.
 *   - `voterCountAtCapture` — voter count captured at the snapshot frame.
 *   - `capturedAt` — ISO 8601 of session close (matches `closedAt` from
 *     ADR-009 §D5). Accepts `min(1)` strings (mirrors T-452 contract
 *     preview; the contract did not constrain to `.datetime()`).
 *   - `snapshotPolicy` — snapshot-selection policy used to pick the
 *     `snapshotFrame` (per §D4).
 *   - `clipKind` — the audience clip kind this provenance is for.
 *   - `aggregation` — persisted aggregation payload (typed per §D3 +
 *     discriminated by `kind`; inlined per ADR-009 §D5 export-durability
 *     posture).
 */
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

/**
 * Inferred TypeScript type for `audienceProvenanceSchema`. Structurally
 * identical to `import('@stageflip/audience-contract').AudienceProvenance`
 * — the type-level drift test in `audience-provenance.test.ts` asserts
 * the two declarations remain assignment-compatible in BOTH directions,
 * failing at compile time if either side ever changes shape.
 *
 * Zod's `z.infer` does not carry the `readonly` modifiers the contract
 * preview's hand-written interface declares; callers needing immutability
 * may annotate `Readonly<AudienceProvenance>` at the use site, matching
 * the `MediaProvenance` precedent.
 */
export type AudienceProvenance = z.infer<typeof audienceProvenanceSchema>;
