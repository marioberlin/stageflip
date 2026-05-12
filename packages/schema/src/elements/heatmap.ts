// packages/schema/src/elements/heatmap.ts
// T-469 — Schema-side `HeatmapClipElement` RIRElement variant. Ninth
// audience-clip variant on the `Element` discriminated union — the
// FIRST marquee differentiator (per ADR-010 §D1 + §D7): spatial input
// that Slido / Mentimeter structurally cannot reach. Voters tap an
// `(x, y)` coordinate on an underlying image; the runtime accumulates
// taps into a grid; the renderer composites a deterministic heatmap
// over the image.
//
// Per ADR-010 §D2 / §D3 + the T-469 spec:
//   - `type: 'heatmap'` discriminator value.
//   - `props: { prompt, imageRef, maxIntensity?, gridResolution?,
//     sessionId? }`.
//     - `imageRef` accepts either a full URL or a `cacheKey:` prefixed
//       reference (the renderer resolves via the existing asset-cache
//       pattern). v1 accepts both shapes via a non-URL `min(1)`
//       constraint — strict format goes to a follow-up.
//   - `provenance?: AudienceProvenance` per T-460.
//   - `permissions: readonly ['audience-network']` — frozen literal
//     tuple matching T-455's `AudienceClipManifest` runtime declaration.
//
// Browser-safe — pure Zod. No Node-only imports.

import { z } from 'zod';

import { audienceProvenanceSchema } from './audience-provenance.js';
import { elementBaseSchema } from './base.js';

/**
 * Grid-resolution shape for the heatmap accumulation buffer. Bounded
 * 1..256 per dimension to keep the deterministic raster within sensible
 * runtime budgets. Default is `32 × 32` — small enough for snappy
 * client-side raster + large enough to resolve gestural taps.
 */
export const heatmapGridResolutionSchema = z
  .object({
    w: z.number().int().positive().max(256),
    h: z.number().int().positive().max(256),
  })
  .strict();

/**
 * Props shape for the `HeatmapClipElement`.
 *
 * - `prompt`: question text shown above the tappable image.
 * - `imageRef`: URL or `cacheKey:` reference. v1 accepts either via a
 *   `min(1)` string — strict format split goes to a follow-up.
 * - `maxIntensity`: voter-side cap on the number of taps each voter
 *   may submit. Default 1 (single-tap); bounded 1..20.
 * - `gridResolution`: accumulation-grid resolution. Default `32 × 32`.
 * - `sessionId`: optional live-mount session binding (absent for
 *   pre-session authoring stubs + static-fallback exports).
 */
export const heatmapClipPropsSchema = z
  .object({
    /** Question text shown above the tappable image. */
    prompt: z.string().min(1),
    /**
     * Underlying image reference — full URL or `cacheKey:` prefix per
     * the existing asset-cache pattern. v1 lets both shapes through;
     * a follow-up will tighten this to a discriminated form.
     */
    imageRef: z.string().min(1),
    /**
     * Per-voter tap cap. Bounded 1..20 — keeps a single voter from
     * dominating the heatmap. Default 1 (single-tap).
     */
    maxIntensity: z.number().int().positive().max(20).default(1),
    /**
     * Accumulation grid resolution. Bounded 1..256 per dim. Default
     * `32 × 32` — keeps the deterministic raster snappy at
     * presentation-scale canvas sizes.
     */
    gridResolution: heatmapGridResolutionSchema.default({ w: 32, h: 32 }),
    /**
     * Optional session id for live-mount routing. Absent for
     * pre-session authoring (the editor binds it at session-start time)
     * and for static-fallback exports (the snapshot is inlined via
     * `provenance` instead).
     */
    sessionId: z.string().min(1).optional(),
  })
  .strict();

export type HeatmapClipProps = z.infer<typeof heatmapClipPropsSchema>;

/**
 * `HeatmapClipElement` schema — ninth audience-clip variant on the
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
export const heatmapClipElementSchema = elementBaseSchema
  .merge(
    z.object({
      type: z.literal('heatmap'),
      props: heatmapClipPropsSchema,
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
 * union so downstream type-narrowing on `el.type === 'heatmap'` gets
 * the strongly-typed props shape.
 */
export type HeatmapClipElement = z.infer<typeof heatmapClipElementSchema>;
