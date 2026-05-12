// packages/schema/src/elements/live-quiz.ts
// T-465 — Schema-side `LiveQuizClipElement` RIRElement variant.
// Fifth audience-clip variant on the `Element` discriminated union;
// follows the T-461..T-464 template verbatim, swapping the
// discriminator + per-kind props shape (multi-question quiz with
// per-question correctness highlighting + an optional per-question
// timer).
//
// Per ADR-010 §D2 / §D5 + the T-465 spec:
//   - `type: 'live-quiz'` discriminator value.
//   - `props: { questions: [{ id, text, options[2..6], correctOptionIndex,
//     timerSeconds? }, ...].min(1).max(50), sessionId?: string }`.
//   - Schema-level `.refine` validates each question's
//     `correctOptionIndex < options.length` so an out-of-range index
//     fails at parse time.
//   - `provenance?: AudienceProvenance` per T-460.
//   - `permissions: readonly ['audience-network']` — frozen literal
//     tuple matching T-455's `AudienceClipManifest` runtime declaration.
//
// Browser-safe — pure Zod. No Node-only imports.

import { z } from 'zod';

import { audienceProvenanceSchema } from './audience-provenance.js';
import { elementBaseSchema } from './base.js';

/**
 * Per-question shape for the `LiveQuizClipElement`. Each question carries
 * a stable `id` (the discriminant the matching `LiveQuizVote` references),
 * a `text` prompt, between 2 and 6 `options`, the
 * `correctOptionIndex` (validated at `liveQuizClipPropsSchema` level
 * against `options.length`), and an optional per-question `timerSeconds`
 * countdown bound (max 120s).
 */
export const liveQuizQuestionSchema = z
  .object({
    /** Stable id — the discriminant the matching `LiveQuizVote` references. */
    id: z.string().min(1),
    /** Question prompt shown to voters. Must be non-empty. */
    text: z.string().min(1),
    /** Answer options. Bounded 2..6 — matches the audience-tier UI affordance. */
    options: z.array(z.string().min(1)).min(2).max(6),
    /**
     * Index into `options` of the correct answer. Cross-field validity
     * (`< options.length`) is enforced by a `.refine` on the parent
     * props schema below.
     */
    correctOptionIndex: z.number().int().nonnegative(),
    /**
     * Optional per-question countdown bound, in seconds. The host's
     * admin-command path (out of scope for T-465 — see spec) drives the
     * actual countdown; the schema reifies the bound so it survives
     * roundtrip + the editor's auto-inspector can render it.
     */
    timerSeconds: z.number().int().positive().max(120).optional(),
  })
  .strict();

export type LiveQuizQuestion = z.infer<typeof liveQuizQuestionSchema>;

/**
 * Props shape for the `LiveQuizClipElement`. The matching
 * `LiveQuizVote` (per ADR-010 §D2 + `@stageflip/audience-contract`) is
 * `{ kind: 'live-quiz', questionId, optionIndex }`. The clip's
 * `questions` props array carries the per-question definitions; the
 * server's per-question result block (totalVotes + optionCounts) lands
 * on the `LiveQuizAggregation` snapshot at runtime.
 *
 * The optional `sessionId` is bound at session-start time (absent for
 * pre-session authoring stubs and for static-fallback exports where
 * the snapshot is inlined via `provenance` instead).
 */
export const liveQuizClipPropsSchema = z
  .object({
    /**
     * The per-question definitions. Bounded 1..50. Each question's
     * `correctOptionIndex` must be `< question.options.length`; this
     * cross-field invariant is enforced by the `.refine` below.
     */
    questions: z.array(liveQuizQuestionSchema).min(1).max(50),
    /**
     * Optional session id for live-mount routing. Absent for
     * pre-session authoring (the editor binds it at session-start time)
     * and for static-fallback exports (the snapshot is inlined via
     * `provenance` instead).
     */
    sessionId: z.string().min(1).optional(),
  })
  .strict()
  .refine((val) => val.questions.every((q) => q.correctOptionIndex < q.options.length), {
    message: 'each question must satisfy correctOptionIndex < options.length',
    path: ['questions'],
  });

export type LiveQuizClipProps = z.infer<typeof liveQuizClipPropsSchema>;

/**
 * `LiveQuizClipElement` schema — fifth audience-clip variant on the
 * `Element` union. Mirrors the per-element pattern from
 * `live-poll-multiple-choice.ts` / `live-poll-open-text.ts` /
 * `live-poll-rating.ts` / `live-qa.ts`: extends `elementBaseSchema`
 * with the `type` discriminator, the per-clip `props`, the
 * `permissions` literal tuple, and the optional `provenance` slot.
 *
 * Permissions are typed as the literal tuple `['audience-network']` so
 * downstream consumers (the audience runtime's mount-time permission
 * check, the `check-audience-permissions` CI gate's runtime-side
 * counterpart) cannot widen the scope at the schema layer.
 */
export const liveQuizClipElementSchema = elementBaseSchema
  .merge(
    z.object({
      type: z.literal('live-quiz'),
      props: liveQuizClipPropsSchema,
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
 * union so downstream type-narrowing on `el.type === 'live-quiz'` gets
 * the strongly-typed props shape.
 */
export type LiveQuizClipElement = z.infer<typeof liveQuizClipElementSchema>;
