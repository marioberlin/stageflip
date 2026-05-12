// packages/schema/src/elements/live-qa.ts
// T-464 — Schema-side `LiveQAClipElement` RIRElement variant.
// Fourth audience-clip variant on the `Element` discriminated union;
// follows the T-461..T-463 (LivePoll family) template verbatim,
// swapping the discriminator + per-kind props shape.
//
// Per ADR-010 §D2 / §D5 + the T-464 spec:
//   - `type: 'live-qa'` discriminator value.
//   - `props: { topic: string (min 1), allowUpvoting: boolean (default
//     true), moderationMode: 'open' | 'moderated' (default 'open'),
//     maxLength: int 1..2000 (default 500), topN: int 1..500 (default
//     100), sessionId?: string }`.
//   - `provenance?: AudienceProvenance` per T-460.
//   - `permissions: readonly ['audience-network']` — frozen literal
//     tuple matching T-455's `AudienceClipManifest` runtime declaration.
//
// Browser-safe — pure Zod. No Node-only imports.

import { z } from 'zod';

import { audienceProvenanceSchema } from './audience-provenance.js';
import { elementBaseSchema } from './base.js';

/**
 * Props shape for the `LiveQAClipElement`. Per ADR-010 §D2 the matching
 * `LiveQAVote` is a dual-action discriminant `{ kind: 'live-qa', action:
 * 'submit' | 'upvote', text?, questionId? }`. The clip's `topic` props
 * value frames the prompt; `allowUpvoting` toggles whether voters see
 * upvote affordances on the Browse-tab list; `moderationMode` carries
 * the presenter / moderator policy (the schema reifies the enum so
 * downstream consumers narrow at compile time); `maxLength` bounds the
 * server-side text accept; `topN` bounds the live aggregation feed
 * length.
 */
export const liveQAClipPropsSchema = z
  .object({
    /** The discussion topic shown to the audience. Must be non-empty. */
    topic: z.string().min(1),
    /**
     * When true, voters see upvote affordances on the Browse-tab list.
     * When false, the Browse-tab is display-only (no upvote buttons
     * rendered). Defaults to true (the common pattern).
     */
    allowUpvoting: z.boolean().default(true),
    /**
     * Moderation policy. `'open'` — every submission lands directly on
     * the live feed. `'moderated'` — submissions sit in a presenter-side
     * queue until promoted. Defaults to `'open'`.
     */
    moderationMode: z.enum(['open', 'moderated']).default('open'),
    /**
     * Maximum text length per question submission. Bounded at 2000 to
     * cap per-snapshot payload size. Defaults to 500 — long enough for
     * a paragraph-length question, short enough to keep the feed
     * scannable.
     */
    maxLength: z.number().int().positive().max(2000).default(500),
    /**
     * Cap on the aggregation `questions` array length — the server
     * sorts by upvotes desc and trims to this. Bounded at 500 to keep
     * snapshot bytes manageable. Defaults to 100.
     */
    topN: z.number().int().positive().max(500).default(100),
    /**
     * Optional session id for live-mount routing. Absent for
     * pre-session authoring (the editor binds it at session-start time)
     * and for static-fallback exports (the snapshot is inlined via
     * `provenance` instead).
     */
    sessionId: z.string().min(1).optional(),
  })
  .strict();

export type LiveQAClipProps = z.infer<typeof liveQAClipPropsSchema>;

/**
 * `LiveQAClipElement` schema — fourth audience-clip variant on the
 * `Element` union. Mirrors the per-element pattern from
 * `live-poll-multiple-choice.ts` / `live-poll-open-text.ts` /
 * `live-poll-rating.ts`: extends `elementBaseSchema` with the `type`
 * discriminator, the per-clip `props`, the `permissions` literal tuple,
 * and the optional `provenance` slot.
 *
 * Permissions are typed as the literal tuple `['audience-network']` so
 * downstream consumers (the audience runtime's mount-time permission
 * check, the `check-audience-permissions` CI gate's runtime-side
 * counterpart) cannot widen the scope at the schema layer.
 */
export const liveQAClipElementSchema = elementBaseSchema
  .merge(
    z.object({
      type: z.literal('live-qa'),
      props: liveQAClipPropsSchema,
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
 * union so downstream type-narrowing on `el.type === 'live-qa'` gets the
 * strongly-typed props shape.
 */
export type LiveQAClipElement = z.infer<typeof liveQAClipElementSchema>;
