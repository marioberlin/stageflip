// packages/schema/src/elements/audio.ts
// Audio element — standalone audio track with mix metadata.

import { z } from 'zod';
import { assetRefSchema } from '../primitives.js';
import { elementBaseSchema } from './base.js';
import { trimWindowSchema } from './video.js';

/** Mix metadata. Kept minimal here; richer EQ/compression arrives with T-087. */
export const audioMixSchema = z
  .object({
    gain: z.number().default(1),
    pan: z.number().min(-1).max(1).default(0),
    fadeInMs: z.number().nonnegative().default(0),
    fadeOutMs: z.number().nonnegative().default(0),
  })
  .strict();

export const audioElementSchema = elementBaseSchema
  .merge(
    z.object({
      type: z.literal('audio'),
      src: assetRefSchema,
      trim: trimWindowSchema.optional(),
      mix: audioMixSchema.optional(),
      loop: z.boolean().default(false),
    }),
  )
  .strict();

export type AudioMix = z.infer<typeof audioMixSchema>;
export type AudioElement = z.infer<typeof audioElementSchema>;
