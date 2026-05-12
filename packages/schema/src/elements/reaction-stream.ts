// packages/schema/src/elements/reaction-stream.ts
// T-470 — Schema-side `ReactionStreamClipElement` RIRElement variant.
// Tenth audience-clip variant on the `Element` discriminated union — the
// SECOND marquee differentiator (per ADR-010 §D1 + §D7): emoji particle
// storm rendered via the T-383 ShaderClip primitive. Voters tap emoji
// buttons; the renderer accumulates per-emoji counts + recent bursts;
// the static-fallback / live render path drives a fragment shader that
// emits one coloured particle stream per palette entry.
//
// Per ADR-010 §D2 / §D3 + the T-470 spec:
//   - `type: 'reaction-stream'` discriminator value.
//   - `props: { prompt, palette, sessionId? }`. The palette is the
//     curated emoji set the voter may tap; each entry has a stable
//     `emojiId` (used in vote payloads) + a `glyph` (rendered character
//     or asset reference). Bounded 1..12 to match the shader's
//     compile-time loop bound (per `REACTION_STREAM_MAX_PALETTE`).
//   - `provenance?: AudienceProvenance` per T-460.
//   - `permissions: readonly ['audience-network']` — frozen literal
//     tuple matching T-455's `AudienceClipManifest` runtime declaration.
//
// Browser-safe — pure Zod. No Node-only imports.

import { z } from 'zod';

import { audienceProvenanceSchema } from './audience-provenance.js';
import { elementBaseSchema } from './base.js';

/**
 * Single palette entry. `emojiId` is the stable identifier used in vote
 * payloads + aggregation rows; `glyph` is what the voter sees on the
 * button + what the renderer paints (typically the emoji character).
 */
export const reactionStreamPaletteEntrySchema = z
  .object({
    /** Stable identifier used in `ReactionStreamVote.emojiId`. */
    emojiId: z.string().min(1),
    /** Rendered glyph — emoji character or asset reference. */
    glyph: z.string().min(1),
  })
  .strict();

/**
 * Props shape for the `ReactionStreamClipElement`.
 *
 * - `prompt`: question text shown above the emoji-button row.
 * - `palette`: 1..12 emoji entries. The upper bound mirrors the
 *   fragment shader's compile-time loop bound
 *   (`REACTION_STREAM_MAX_PALETTE = 12`).
 * - `sessionId`: optional live-mount session binding (absent for
 *   pre-session authoring stubs + static-fallback exports).
 */
export const reactionStreamClipPropsSchema = z
  .object({
    /** Question text shown above the emoji-button row. */
    prompt: z.string().min(1),
    /**
     * Voter-facing emoji palette. Bounded 1..12 — the upper bound
     * matches the fragment shader's compile-time loop bound. Voters
     * tap any entry; multi-tap is permitted (no client-side disable;
     * server-side 10 Hz rate-limit per ADR-009 §D3 line 231).
     */
    palette: z.array(reactionStreamPaletteEntrySchema).min(1).max(12),
    /**
     * Optional session id for live-mount routing. Absent for
     * pre-session authoring (the editor binds it at session-start time)
     * and for static-fallback exports (the snapshot is inlined via
     * `provenance` instead).
     */
    sessionId: z.string().min(1).optional(),
  })
  .strict();

export type ReactionStreamPaletteEntry = z.infer<typeof reactionStreamPaletteEntrySchema>;
export type ReactionStreamClipProps = z.infer<typeof reactionStreamClipPropsSchema>;

/**
 * `ReactionStreamClipElement` schema — tenth audience-clip variant on
 * the `Element` union. Mirrors the per-element pattern from the prior
 * audience clip variants: extends `elementBaseSchema` with the `type`
 * discriminator, the per-clip `props`, the `permissions` literal tuple,
 * and the optional `provenance` slot.
 *
 * Permissions are typed as the literal tuple `['audience-network']` so
 * downstream consumers (the audience runtime's mount-time permission
 * check, the `check-audience-permissions` CI gate's runtime-side
 * counterpart) cannot widen the scope at the schema layer.
 */
export const reactionStreamClipElementSchema = elementBaseSchema
  .merge(
    z.object({
      type: z.literal('reaction-stream'),
      props: reactionStreamClipPropsSchema,
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
 * union so downstream type-narrowing on `el.type === 'reaction-stream'`
 * gets the strongly-typed props shape.
 */
export type ReactionStreamClipElement = z.infer<typeof reactionStreamClipElementSchema>;
