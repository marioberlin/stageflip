// packages/schema/src/elements/clip.ts
// Clip element — runtime-dispatched animation. The `runtime` string identifies
// a registered ClipRuntime (T-060); `clipName` selects a clip from that
// runtime's registry.

import { z } from 'zod';
import { elementBaseSchema } from './base.js';

/**
 * Font requirement declared by a clip. Aggregated by the RIR compiler and
 * resolved by the FontManager (T-072).
 */
export const fontRequirementSchema = z
  .object({
    family: z.string(),
    weight: z.union([z.number(), z.string()]).optional(),
    style: z.enum(['normal', 'italic']).default('normal'),
    subsets: z.array(z.string()).optional(),
    features: z.array(z.string()).optional(),
  })
  .strict();

export const clipElementSchema = elementBaseSchema
  .merge(
    z.object({
      type: z.literal('clip'),
      runtime: z.string().min(1),
      clipName: z.string().min(1),
      params: z.record(z.unknown()).default({}),
      fonts: z.array(fontRequirementSchema).optional(),
    }),
  )
  .strict();

export type FontRequirement = z.infer<typeof fontRequirementSchema>;
export type ClipElement = z.infer<typeof clipElementSchema>;
