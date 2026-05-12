// packages/schema/src/elements/audience-ai-prompt.ts
// T-471 — Schema-side `AudienceAiPromptClipElement` RIRElement variant.
// Eleventh + FINAL audience-clip variant on the `Element` discriminated
// union — the THIRD marquee differentiator (per ADR-010 §D1 + §D7):
// audience submits prompts → upvote shortlist → winning prompt drives a
// Phase 14 asset-gen pipeline (Seedance T-430 / ACE-Step T-432 / etc.,
// per `targetModality`); the generated asset is rendered statically in
// the static-fallback view. This clip family closes the v1 clip-family
// set and demonstrates the cross-product synergy (audience-driven
// authoring of AI-generated assets) that competitors structurally
// cannot offer.
//
// Per ADR-010 §D2 / §D3 + the T-471 spec:
//   - `type: 'audience-ai-prompt'` discriminator value.
//   - `props: { prompt, targetModality, topN (default 20), maxPromptLength
//     (default 200), sessionId? }`. `targetModality` is one of
//     `'video-gen' | 'music-gen' | 'image-gen' | 'tts'`, mapping to the
//     P14 adapter modality kinds that the asset-gen pipeline will
//     dispatch to on winner declaration.
//   - `provenance?: AudienceProvenance` per T-460.
//   - `permissions: readonly ['audience-network']` — frozen literal
//     tuple matching T-455's `AudienceClipManifest` runtime declaration.
//
// Browser-safe — pure Zod. No Node-only imports.

import { z } from 'zod';

import { audienceProvenanceSchema } from './audience-provenance.js';
import { elementBaseSchema } from './base.js';

/**
 * Target modality for the AI generation triggered when a prompt wins.
 * Values map onto P14's `AdapterModalityKind` for the modalities a voter
 * might want to drive: `'video-gen'` (T-430 Seedance / T-431 Runway),
 * `'music-gen'` (T-432 ACE-Step / T-433 YuE), `'image-gen'` (no v1
 * reference adapter; forward-compat), `'tts'` (T-426 Kokoro / T-427
 * Fish-Speech — for voice-driven prompts).
 */
export const AUDIENCE_AI_PROMPT_TARGET_MODALITIES = [
  'video-gen',
  'music-gen',
  'image-gen',
  'tts',
] as const;
export type AudienceAiPromptTargetModality = (typeof AUDIENCE_AI_PROMPT_TARGET_MODALITIES)[number];

/**
 * Props shape for the `AudienceAiPromptClipElement`.
 *
 * - `prompt`: question text shown to voters above the input ("What
 *   should we generate next?").
 * - `targetModality`: which P14 asset-gen modality the winning prompt
 *   feeds.
 * - `topN`: maximum prompts surfaced in the live shortlist. Default 20.
 *   Capped at 100 to bound the snapshot size.
 * - `maxPromptLength`: textarea `maxLength` for voter submissions.
 *   Default 200. Capped at 500 to bound payload size.
 * - `sessionId`: optional live-mount session binding (absent for
 *   pre-session authoring stubs + static-fallback exports).
 */
export const audienceAiPromptClipPropsSchema = z
  .object({
    /** Question text shown to voters above the input. */
    prompt: z.string().min(1),
    /** Which P14 asset-gen modality the winning prompt feeds. */
    targetModality: z.enum(AUDIENCE_AI_PROMPT_TARGET_MODALITIES),
    /**
     * Maximum prompts surfaced in the live shortlist. Default 20.
     * Bounded ≤ 100 to keep aggregation snapshots small.
     */
    topN: z.number().int().positive().max(100).default(20),
    /**
     * Textarea `maxLength` for voter submissions. Default 200. Bounded
     * ≤ 500 to keep payload size predictable.
     */
    maxPromptLength: z.number().int().positive().max(500).default(200),
    /**
     * Optional session id for live-mount routing. Absent for
     * pre-session authoring (the editor binds it at session-start time)
     * and for static-fallback exports (the snapshot is inlined via
     * `provenance` instead).
     */
    sessionId: z.string().min(1).optional(),
  })
  .strict();

export type AudienceAiPromptClipProps = z.infer<typeof audienceAiPromptClipPropsSchema>;

/**
 * `AudienceAiPromptClipElement` schema — eleventh + FINAL audience-clip
 * variant on the `Element` union. Mirrors the per-element pattern from
 * the prior audience clip variants: extends `elementBaseSchema` with the
 * `type` discriminator, the per-clip `props`, the `permissions` literal
 * tuple, and the optional `provenance` slot.
 *
 * Permissions are typed as the literal tuple `['audience-network']` so
 * downstream consumers (the audience runtime's mount-time permission
 * check, the `check-audience-permissions` CI gate's runtime-side
 * counterpart) cannot widen the scope at the schema layer.
 */
export const audienceAiPromptClipElementSchema = elementBaseSchema
  .merge(
    z.object({
      type: z.literal('audience-ai-prompt'),
      props: audienceAiPromptClipPropsSchema,
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
 * union so downstream type-narrowing on `el.type === 'audience-ai-prompt'`
 * gets the strongly-typed props shape.
 */
export type AudienceAiPromptClipElement = z.infer<typeof audienceAiPromptClipElementSchema>;
