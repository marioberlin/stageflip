// packages/schema/src/elements/video.ts
// Video element — source + trim window + muting. Sync with timeline is handled
// by useMediaSync at render time (T-055).

import { z } from 'zod';
import { assetRefSchema } from '../primitives.js';
import { elementBaseSchema } from './base.js';

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
    }),
  )
  .strict();

export type TrimWindow = z.infer<typeof trimWindowSchema>;
export type VideoElement = z.infer<typeof videoElementSchema>;
