// packages/schema/src/elements/survey.ts
// T-468 — Schema-side `SurveyClipElement` RIRElement variant.
// Eighth audience-clip variant on the `Element` discriminated union —
// closes the standard-family v1 set. Multi-question survey: each
// question is one of three types (`multiple-choice` / `open-text` /
// `rating`); the runtime aggregates responses per question and the
// renderer paints a per-question result card.
//
// Per ADR-010 §D2 / §D3 + the T-468 spec:
//   - `type: 'survey'` discriminator value.
//   - `props: { questions: SurveyQuestion[], sessionId?: string }`
//     where SurveyQuestion is a discriminated union on `type` with
//     three strict-shape variants.
//   - `provenance?: AudienceProvenance` per T-460.
//   - `permissions: readonly ['audience-network']` — frozen literal
//     tuple matching T-455's `AudienceClipManifest` runtime declaration.
//
// Browser-safe — pure Zod. No Node-only imports.

import { z } from 'zod';

import { audienceProvenanceSchema } from './audience-provenance.js';
import { elementBaseSchema } from './base.js';

/**
 * Per-question schema — discriminated union on `type`. Each variant
 * is `strict()` so unknown extra fields are rejected at the schema
 * boundary (matches the other audience-clip per-clip-props patterns).
 *
 * Variants:
 *   - `multiple-choice`: `{ id, type, text, options[2..10] }`. The
 *     voter picks ONE option-index; the aggregation buckets votes by
 *     index — same shape as the LivePoll variant.
 *   - `open-text`: `{ id, type, text, maxLength? }`. Free-text
 *     response; `maxLength` bounded 1..2000 with default 280 (same
 *     default as the LivePoll variant).
 *   - `rating`: `{ id, type, text, scaleMin: 1, scaleMax: 2..10,
 *     labels? }`. Likert-style rating; `scaleMin === 1` (literal) by
 *     design — survey ratings in v1 always start at 1 (the LivePoll
 *     rating clip enforces the same).
 */
export const surveyQuestionSchema = z.discriminatedUnion('type', [
  z
    .object({
      id: z.string().min(1),
      type: z.literal('multiple-choice'),
      text: z.string().min(1),
      options: z.array(z.string().min(1)).min(2).max(10),
    })
    .strict(),
  z
    .object({
      id: z.string().min(1),
      type: z.literal('open-text'),
      text: z.string().min(1),
      maxLength: z.number().int().positive().max(2000).default(280),
    })
    .strict(),
  z
    .object({
      id: z.string().min(1),
      type: z.literal('rating'),
      text: z.string().min(1),
      scaleMin: z.literal(1),
      scaleMax: z.number().int().min(2).max(10),
      labels: z.array(z.string()).optional(),
    })
    .strict(),
]);

export type SurveyQuestion = z.infer<typeof surveyQuestionSchema>;

/**
 * Props shape for the `SurveyClipElement`. `questions` is bounded to
 * 1..20 — keeps the voter form scrollable but not exhausting; matches
 * the spec.
 *
 * The optional `sessionId` is bound at session-start time (absent for
 * pre-session authoring stubs and for static-fallback exports where
 * the snapshot is inlined via `provenance` instead).
 */
export const surveyClipPropsSchema = z
  .object({
    /**
     * Per-question schema array. Bounded 1..20.
     */
    questions: z.array(surveyQuestionSchema).min(1).max(20),
    /**
     * Optional session id for live-mount routing. Absent for
     * pre-session authoring (the editor binds it at session-start time)
     * and for static-fallback exports (the snapshot is inlined via
     * `provenance` instead).
     */
    sessionId: z.string().min(1).optional(),
  })
  .strict();

export type SurveyClipProps = z.infer<typeof surveyClipPropsSchema>;

/**
 * `SurveyClipElement` schema — eighth audience-clip variant on the
 * `Element` union. Mirrors the per-element pattern from the prior
 * audience clip variants: extends `elementBaseSchema` with the `type`
 * discriminator, the per-clip `props`, the `permissions` literal tuple,
 * and the optional `provenance` slot.
 *
 * Permissions are typed as the literal tuple `['audience-network']` so
 * downstream consumers (the audience runtime's mount-time permission
 * check, the `check-audience-permissions` CI gate's runtime-side
 * counterpart) cannot widen the scope at the schema layer.
 */
export const surveyClipElementSchema = elementBaseSchema
  .merge(
    z.object({
      type: z.literal('survey'),
      props: surveyClipPropsSchema,
      /**
       * Frozen permissions tuple — exactly `['audience-network']` per
       * ADR-009 §D13 + ADR-010 §D6.
       */
      permissions: z.tuple([z.literal('audience-network')]),
      /**
       * Optional `AudienceProvenance` slot per T-460 / ADR-010 §D5.
       */
      provenance: audienceProvenanceSchema.optional(),
    }),
  )
  .strict();

/**
 * Inferred TypeScript type for the schema. Carried across the Element
 * union so downstream type-narrowing on `el.type === 'survey'`
 * gets the strongly-typed props shape.
 */
export type SurveyClipElement = z.infer<typeof surveyClipElementSchema>;
