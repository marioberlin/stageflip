// packages/schema/src/elements/image.ts
// Image element — raster or vector reference with fit semantics.

import { z } from 'zod';
import { assetRefSchema } from '../primitives.js';
import { elementBaseSchema } from './base.js';
import { mediaProvenanceSchema } from './media-provenance.js';

export const imageElementSchema = elementBaseSchema
  .merge(
    z.object({
      type: z.literal('image'),
      src: assetRefSchema,
      alt: z.string().max(500).optional(),
      fit: z.enum(['cover', 'contain', 'fill', 'none', 'scale-down']).default('cover'),
      /**
       * Asset-generation provenance per ADR-008 §D2 (T-421). Optional —
       * hand-authored / imported images carry none. Image-gen and
       * infographic-gen adapters populate this slot with pipeline kind,
       * provider, model, prompt, cache key, and (when source-grounded)
       * the research session id + per-source citation ids.
       */
      provenance: mediaProvenanceSchema.optional(),
    }),
  )
  .strict();

export type ImageElement = z.infer<typeof imageElementSchema>;
