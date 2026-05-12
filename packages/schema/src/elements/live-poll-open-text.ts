// packages/schema/src/elements/live-poll-open-text.ts
// T-462 — Schema-side `LivePollOpenTextClipElement` RIRElement variant.
// Second audience-clip variant on the `Element` discriminated union;
// follows the T-461 (`live-poll-multiple-choice`) template verbatim,
// swapping the discriminator + per-kind props shape.
//
// Per ADR-010 §D2 / §D5 + the T-462 spec:
//   - `type: 'live-poll-open-text'` discriminator value.
//   - `props: { question: string (min 1), maxLength: int 1..2000 (default
//     280), sessionId?: string }`.
//   - `provenance?: AudienceProvenance` per T-460.
//   - `permissions: readonly ['audience-network']` — frozen literal
//     tuple matching T-455's `AudienceClipManifest` runtime declaration.
//
// Browser-safe — pure Zod. No Node-only imports.

import { z } from 'zod';

import { audienceProvenanceSchema } from './audience-provenance.js';
import { elementBaseSchema } from './base.js';

/**
 * Props shape for the `LivePollOpenTextClipElement`. Per ADR-010 §D2 the
 * matching `LivePollOpenTextVote` is `{ kind: 'live-poll-open-text',
 * text: string }` with `text.length <= maxLength`. The default
 * `maxLength` of 280 mirrors the contract-level default and matches the
 * common short-form social-text upper bound.
 */
export const livePollOpenTextClipPropsSchema = z
  .object({
    /** The question put to the audience. Must be non-empty. */
    question: z.string().min(1),
    /**
     * Server-enforced maximum length of any single voter submission.
     * Default 280; capped at 2000 to bound the aggregation memory
     * footprint (top-N entries dedup canonicalised text).
     */
    maxLength: z.number().int().positive().max(2000).default(280),
    /**
     * Optional session id for live-mount routing. Absent for
     * pre-session authoring (the editor binds it at session-start time)
     * and for static-fallback exports (the snapshot is inlined via
     * `provenance` instead).
     */
    sessionId: z.string().min(1).optional(),
  })
  .strict();

export type LivePollOpenTextClipProps = z.infer<typeof livePollOpenTextClipPropsSchema>;

/**
 * `LivePollOpenTextClipElement` schema — second audience-clip variant
 * on the `Element` union. Mirrors the per-element pattern from
 * `live-poll-multiple-choice.ts`: extends `elementBaseSchema` with the
 * `type` discriminator, the per-clip `props`, the `permissions`
 * literal tuple, and the optional `provenance` slot.
 *
 * Permissions are typed as the literal tuple `['audience-network']` so
 * downstream consumers (the audience runtime's mount-time permission
 * check, the `check-audience-permissions` CI gate's runtime-side
 * counterpart) cannot widen the scope at the schema layer.
 */
export const livePollOpenTextClipElementSchema = elementBaseSchema
  .merge(
    z.object({
      type: z.literal('live-poll-open-text'),
      props: livePollOpenTextClipPropsSchema,
      /**
       * Frozen permissions tuple — exactly `['audience-network']` per
       * ADR-009 §D13 + ADR-010 §D6. The tuple shape matches T-455's
       * `AudienceClipManifest.permissions` so the schema-side and the
       * runtime-side declarations cannot drift.
       */
      permissions: z.tuple([z.literal('audience-network')]),
      /**
       * Optional `AudienceProvenance` slot per T-460 / ADR-010 §D5.
       * Present at export time + on persisted post-session documents;
       * absent on a fresh authoring stub.
       */
      provenance: audienceProvenanceSchema.optional(),
    }),
  )
  .strict();

/**
 * Inferred TypeScript type for the schema. Carried across the Element
 * union so downstream type-narrowing on `el.type ===
 * 'live-poll-open-text'` gets the strongly-typed props shape.
 */
export type LivePollOpenTextClipElement = z.infer<typeof livePollOpenTextClipElementSchema>;
