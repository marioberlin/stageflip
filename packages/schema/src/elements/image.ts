// packages/schema/src/elements/image.ts
// Image element — raster or vector reference with fit semantics.

import { z } from 'zod';
import { assetRefSchema } from '../primitives.js';
import { elementBaseSchema } from './base.js';

export const imageElementSchema = elementBaseSchema
  .merge(
    z.object({
      type: z.literal('image'),
      src: assetRefSchema,
      alt: z.string().max(500).optional(),
      fit: z.enum(['cover', 'contain', 'fill', 'none', 'scale-down']).default('cover'),
    }),
  )
  .strict();

export type ImageElement = z.infer<typeof imageElementSchema>;
