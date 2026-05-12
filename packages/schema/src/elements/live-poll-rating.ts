// packages/schema/src/elements/live-poll-rating.ts
// T-463 — Schema-side `LivePollRatingClipElement` RIRElement variant.
// Third audience-clip variant on the `Element` discriminated union;
// follows the T-461 (`live-poll-multiple-choice`) + T-462
// (`live-poll-open-text`) template verbatim, swapping the discriminator
// + per-kind props shape.
//
// Per ADR-010 §D2 / §D5 + the T-463 spec:
//   - `type: 'live-poll-rating'` discriminator value.
//   - `props: { question: string (min 1), scaleMin: literal 1, scaleMax:
//     int 2..10, labels?: string[], sessionId?: string }`.
//   - `provenance?: AudienceProvenance` per T-460.
//   - `permissions: readonly ['audience-network']` — frozen literal
//     tuple matching T-455's `AudienceClipManifest` runtime declaration.
//
// Browser-safe — pure Zod. No Node-only imports.

import { z } from 'zod';

import { audienceProvenanceSchema } from './audience-provenance.js';
import { elementBaseSchema } from './base.js';

/**
 * Props shape for the `LivePollRatingClipElement`. Per ADR-010 §D2 the
 * matching `LivePollRatingVote` is `{ kind: 'live-poll-rating', score:
 * number }` with `score` an integer in `1..scaleMax`. `scaleMin` is
 * fixed at 1 (reified as a `z.literal(1)` for type-system clarity); the
 * vote value is always 1-indexed.
 */
export const livePollRatingClipPropsSchema = z
  .object({
    /** The question put to the audience. Must be non-empty. */
    question: z.string().min(1),
    /**
     * Scale lower bound — fixed at 1 per ADR-010 §D2. Reified as a
     * literal so downstream consumers can rely on the type-level
     * narrowing rather than a runtime `if (scaleMin !== 1)` guard.
     */
    scaleMin: z.literal(1),
    /**
     * Scale upper bound — typically 5 (5-point Likert) or 10 (NPS-style
     * 1..10). Capped at 10 to bound the per-snapshot histogram width.
     */
    scaleMax: z.number().int().min(2).max(10),
    /**
     * Optional human-readable end-of-scale labels. When present the
     * static-fallback renderer surfaces `labels[0]` under the leftmost
     * bar and `labels[labels.length - 1]` under the rightmost bar.
     * Common pattern: `["Strongly disagree", "Strongly agree"]` for a
     * 5-point Likert.
     */
    labels: z.array(z.string()).optional(),
    /**
     * Optional session id for live-mount routing. Absent for
     * pre-session authoring (the editor binds it at session-start time)
     * and for static-fallback exports (the snapshot is inlined via
     * `provenance` instead).
     */
    sessionId: z.string().min(1).optional(),
  })
  .strict();

export type LivePollRatingClipProps = z.infer<typeof livePollRatingClipPropsSchema>;

/**
 * `LivePollRatingClipElement` schema — third audience-clip variant on
 * the `Element` union. Mirrors the per-element pattern from
 * `live-poll-multiple-choice.ts` + `live-poll-open-text.ts`: extends
 * `elementBaseSchema` with the `type` discriminator, the per-clip
 * `props`, the `permissions` literal tuple, and the optional
 * `provenance` slot.
 *
 * Permissions are typed as the literal tuple `['audience-network']` so
 * downstream consumers (the audience runtime's mount-time permission
 * check, the `check-audience-permissions` CI gate's runtime-side
 * counterpart) cannot widen the scope at the schema layer.
 */
export const livePollRatingClipElementSchema = elementBaseSchema
  .merge(
    z.object({
      type: z.literal('live-poll-rating'),
      props: livePollRatingClipPropsSchema,
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
 * union so downstream type-narrowing on `el.type === 'live-poll-rating'`
 * gets the strongly-typed props shape.
 */
export type LivePollRatingClipElement = z.infer<typeof livePollRatingClipElementSchema>;
