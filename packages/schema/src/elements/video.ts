// packages/schema/src/elements/video.ts
// Video element — source + trim window + muting. Sync with timeline is handled
// by useMediaSync at render time (T-055).

import { z } from 'zod';
import { assetRefSchema } from '../primitives.js';
import { elementBaseSchema } from './base.js';
import { mediaProvenanceSchema } from './media-provenance.js';

/** A trim window in milliseconds into the source media. */
export const trimWindowSchema = z
  .object({
    startMs: z.number().nonnegative(),
    endMs: z.number().positive(),
  })
  .strict()
  .refine((t) => t.endMs > t.startMs, { message: 'endMs must exceed startMs' });

export const videoElementSchema = elementBaseSchema
  .merge(
    z.object({
      type: z.literal('video'),
      src: assetRefSchema,
      trim: trimWindowSchema.optional(),
      muted: z.boolean().default(false),
      loop: z.boolean().default(false),
      playbackRate: z.number().positive().default(1),
      /**
       * Asset-generation provenance per ADR-008 §D2 (T-421). Optional —
       * hand-authored / imported video carries none. Video-gen adapters
       * populate this slot with pipeline kind, provider, model, prompt,
       * cache key, seed, and (when source-grounded) the research
       * session id + per-source citation ids.
       */
      provenance: mediaProvenanceSchema.optional(),
    }),
  )
  .strict();

export type TrimWindow = z.infer<typeof trimWindowSchema>;
export type VideoElement = z.infer<typeof videoElementSchema>;
