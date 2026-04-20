// packages/schema/src/timing.ts
// Timing primitives for the canonical schema (docs/implementation-plan.md
// T-022: "animations + timing primitives B1–B5"). The plan did not spell out
// the B1–B5 semantics; this file encodes a reasonable interpretation. If a
// downstream task (T-031 timing-flatten, T-032 golden fixtures) surfaces a
// different definition, the primitive set here is still the right shape —
// only the field names + discriminator values would change.
//
// Design: five discriminated primitives express every common "when does this
// element start playing?" question. The RIR compiler's timing-flatten pass
// (T-031) resolves a primitive + context into absolute startFrame/endFrame.
//
//   B1 'absolute'  — literal frame number
//   B2 'relative'  — offset from the preceding sibling's end
//   B3 'anchored'  — offset from another element's start or end
//   B4 'beat'      — aligned to a beat grid (video/audio sync)
//   B5 'event'     — triggered by a runtime event (e.g. clip complete)

import { z } from 'zod';
import { idSchema } from './primitives.js';

/** B1: start at an explicit frame number on the composition timeline. */
export const absoluteTimingSchema = z
  .object({
    kind: z.literal('absolute'),
    startFrame: z.number().int().nonnegative(),
    durationFrames: z.number().int().positive(),
  })
  .strict();

/** B2: start at (previous sibling's end) + offsetFrames. */
export const relativeTimingSchema = z
  .object({
    kind: z.literal('relative'),
    offsetFrames: z.number().int(),
    durationFrames: z.number().int().positive(),
  })
  .strict();

/** B3: anchor this element's start/end to another element's start/end. */
export const anchoredTimingSchema = z
  .object({
    kind: z.literal('anchored'),
    anchor: idSchema,
    anchorEdge: z.enum(['start', 'end']),
    mySide: z.enum(['start', 'end']).default('start'),
    offsetFrames: z.number().int().default(0),
    durationFrames: z.number().int().positive(),
  })
  .strict();

/**
 * B4: align to a beat grid. Meaningful when the composition has an associated
 * audio track with a known BPM. Resolved to an absolute frame by the compiler.
 */
export const beatTimingSchema = z
  .object({
    kind: z.literal('beat'),
    beat: z.number().positive(),
    subdivision: z.enum(['whole', 'half', 'quarter', 'eighth', 'sixteenth']).default('quarter'),
    durationBeats: z.number().positive(),
  })
  .strict();

/** B5: fire when a named runtime event occurs (e.g. a prior clip finishes). */
export const eventTimingSchema = z
  .object({
    kind: z.literal('event'),
    event: z.string().min(1),
    offsetFrames: z.number().int().default(0),
    durationFrames: z.number().int().positive(),
  })
  .strict();

/** Discriminated union of all 5 primitives. */
export const timingPrimitiveSchema = z.discriminatedUnion('kind', [
  absoluteTimingSchema,
  relativeTimingSchema,
  anchoredTimingSchema,
  beatTimingSchema,
  eventTimingSchema,
]);

export type AbsoluteTiming = z.infer<typeof absoluteTimingSchema>;
export type RelativeTiming = z.infer<typeof relativeTimingSchema>;
export type AnchoredTiming = z.infer<typeof anchoredTimingSchema>;
export type BeatTiming = z.infer<typeof beatTimingSchema>;
export type EventTiming = z.infer<typeof eventTimingSchema>;
export type TimingPrimitive = z.infer<typeof timingPrimitiveSchema>;

/** Primitive-kind literals, useful for exhaustive switches. */
export const TIMING_KINDS = ['absolute', 'relative', 'anchored', 'beat', 'event'] as const;
export type TimingKind = (typeof TIMING_KINDS)[number];
