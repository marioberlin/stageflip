// packages/schema/src/content/video.ts
// StageFlip.Video content. Horizontal-timeline video ad / social video with
// track-kinded elements. Captions are a sidecar track (T-184 generates them
// via Whisper) aligned to the visual timeline.

import { z } from 'zod';
import { elementSchema } from '../elements/index.js';
import { assetRefSchema, idSchema } from '../primitives.js';

/** Supported output aspect ratios for StageFlip.Video. Custom sizes opt in via `{w,h}`. */
export const aspectRatioSchema = z.union([
  z.enum(['16:9', '9:16', '1:1', '4:5', '21:9']),
  z
    .object({
      kind: z.literal('custom'),
      w: z.number().int().positive(),
      h: z.number().int().positive(),
    })
    .strict(),
]);
export type AspectRatio = z.infer<typeof aspectRatioSchema>;

/** A track is a named lane of elements with a shared semantic role. */
export const trackKindSchema = z.enum(['visual', 'audio', 'caption', 'overlay']);
export type TrackKind = z.infer<typeof trackKindSchema>;

export const trackSchema = z
  .object({
    id: idSchema,
    kind: trackKindSchema,
    name: z.string().min(1).max(200).optional(),
    muted: z.boolean().default(false),
    elements: z.array(elementSchema),
  })
  .strict();
export type Track = z.infer<typeof trackSchema>;

/**
 * Captions produced by T-184's Whisper pipeline. `segments` are pre-grouped
 * caption cells (not raw words); packing for each aspect ratio happens at
 * compile time (T-185).
 */
export const captionSegmentSchema = z
  .object({
    startMs: z.number().nonnegative(),
    endMs: z.number().positive(),
    text: z.string().min(1),
  })
  .strict()
  .refine((s) => s.endMs > s.startMs, { message: 'endMs must exceed startMs' });

export const captionTrackSchema = z
  .object({
    lang: z.string().min(2).max(10).default('en'),
    segments: z.array(captionSegmentSchema),
  })
  .strict();
export type CaptionTrack = z.infer<typeof captionTrackSchema>;
export type CaptionSegment = z.infer<typeof captionSegmentSchema>;

export const videoContentSchema = z
  .object({
    mode: z.literal('video'),
    aspectRatio: aspectRatioSchema,
    durationMs: z.number().int().positive(),
    frameRate: z.number().int().positive().default(30),
    tracks: z.array(trackSchema).min(1),
    /** Optional background music asset mixed beneath every track. */
    bgm: assetRefSchema.optional(),
    captions: captionTrackSchema.optional(),
  })
  .strict();
export type VideoContent = z.infer<typeof videoContentSchema>;
