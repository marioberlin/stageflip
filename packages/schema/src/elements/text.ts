// packages/schema/src/elements/text.ts
// Text element — styled text content with optional per-run overrides.

import { z } from 'zod';
import { colorValueSchema } from '../primitives.js';
import { elementBaseSchema } from './base.js';

/** A styled segment inside a text element. Enables inline color/weight spans. */
export const textRunSchema = z
  .object({
    text: z.string(),
    color: colorValueSchema.optional(),
    weight: z.number().int().min(100).max(900).multipleOf(100).optional(),
    italic: z.boolean().optional(),
    underline: z.boolean().optional(),
  })
  .strict();

export const textElementSchema = elementBaseSchema
  .merge(
    z.object({
      type: z.literal('text'),
      text: z.string(),
      runs: z.array(textRunSchema).optional(),
      fontFamily: z.string().optional(),
      fontSize: z.number().positive().optional(),
      color: colorValueSchema.optional(),
      align: z.enum(['left', 'center', 'right', 'justify']).default('left'),
      lineHeight: z.number().positive().optional(),
    }),
  )
  .strict();

export type TextRun = z.infer<typeof textRunSchema>;
export type TextElement = z.infer<typeof textElementSchema>;
