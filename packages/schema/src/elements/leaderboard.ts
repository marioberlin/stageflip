// packages/schema/src/elements/leaderboard.ts
// T-466 — Schema-side `LeaderboardClipElement` RIRElement variant.
// Sixth audience-clip variant on the `Element` discriminated union;
// first DERIVED clip (paired with `live-quiz`). Voters never cast
// votes against this clip — per ADR-010 §D2 `LeaderboardVote = never`;
// the aggregation is derived server-side from the upstream
// `LiveQuizAggregation` referenced by `props.quizId`.
//
// Per ADR-010 §D2 / §D5 + the T-466 spec:
//   - `type: 'leaderboard'` discriminator value.
//   - `props: { quizId: string, topN?: number (1..100, default 10),
//     title?: string, sessionId?: string }`.
//   - `provenance?: AudienceProvenance` per T-460.
//   - `permissions: readonly ['audience-network']` — frozen literal
//     tuple matching T-455's `AudienceClipManifest` runtime declaration.
//
// Browser-safe — pure Zod. No Node-only imports.

import { z } from 'zod';

import { audienceProvenanceSchema } from './audience-provenance.js';
import { elementBaseSchema } from './base.js';

/**
 * Props shape for the `LeaderboardClipElement`. Per ADR-010 §D2 there
 * is NO matching `LeaderboardVote` — `LeaderboardVote = never`; the
 * voter never submits, the aggregation is derived from the upstream
 * `LiveQuizClip` instance identified by `quizId`. The schema-level
 * constraint is just that `quizId` is a non-empty string; cross-clip-
 * reference validation (the referenced quiz actually exists in the
 * surrounding document, the session is bound, etc.) is downstream —
 * the renderer-core dispatcher or a future Cluster I CI rule.
 *
 * The optional `sessionId` is bound at session-start time (absent for
 * pre-session authoring stubs and for static-fallback exports where
 * the snapshot is inlined via `provenance` instead).
 */
export const leaderboardClipPropsSchema = z
  .object({
    /**
     * Foreign-key reference to the upstream `LiveQuizClip` instance.
     * The server-side derivation joins on the quiz's session to compute
     * rankings. Schema-level constraint: non-empty string; cross-clip
     * validity is a downstream concern.
     */
    quizId: z.string().min(1),
    /**
     * Number of top-ranked voters to surface. Bounded 1..100; defaults
     * to 10. The aggregation snapshot's `ranking` length is bounded by
     * this value.
     */
    topN: z.number().int().positive().max(100).default(10),
    /**
     * Optional display title shown above the ranking list (e.g.,
     * "Round 1 Standings"). Non-empty when present.
     */
    title: z.string().min(1).optional(),
    /**
     * Optional session id for live-mount routing. Absent for
     * pre-session authoring (the editor binds it at session-start time)
     * and for static-fallback exports (the snapshot is inlined via
     * `provenance` instead).
     */
    sessionId: z.string().min(1).optional(),
  })
  .strict();

export type LeaderboardClipProps = z.infer<typeof leaderboardClipPropsSchema>;

/**
 * `LeaderboardClipElement` schema — sixth audience-clip variant on the
 * `Element` union. Mirrors the per-element pattern from
 * `live-poll-multiple-choice.ts` / `live-poll-open-text.ts` /
 * `live-poll-rating.ts` / `live-qa.ts` / `live-quiz.ts`: extends
 * `elementBaseSchema` with the `type` discriminator, the per-clip
 * `props`, the `permissions` literal tuple, and the optional
 * `provenance` slot.
 *
 * Permissions are typed as the literal tuple `['audience-network']` so
 * downstream consumers (the audience runtime's mount-time permission
 * check, the `check-audience-permissions` CI gate's runtime-side
 * counterpart) cannot widen the scope at the schema layer.
 */
export const leaderboardClipElementSchema = elementBaseSchema
  .merge(
    z.object({
      type: z.literal('leaderboard'),
      props: leaderboardClipPropsSchema,
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
 * union so downstream type-narrowing on `el.type === 'leaderboard'`
 * gets the strongly-typed props shape.
 */
export type LeaderboardClipElement = z.infer<typeof leaderboardClipElementSchema>;
