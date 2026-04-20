// packages/schema/src/content/slide.ts
// StageFlip.Slide content. One document = a deck of slides; each slide owns
// its element list, an optional background, and an optional entrance/exit
// transition. Speaker notes attach to the slide (not to any element).

import { z } from 'zod';
import { elementSchema } from '../elements/index.js';
import { colorValueSchema, idSchema } from '../primitives.js';

/** Background fill for a slide. Gradient support arrives with T-249 theme learning. */
export const slideBackgroundSchema = z.union([
  z.object({ kind: z.literal('color'), value: colorValueSchema }).strict(),
  z.object({ kind: z.literal('asset'), value: z.string().min(1) }).strict(),
]);
export type SlideBackground = z.infer<typeof slideBackgroundSchema>;

/** Named slide transitions. Per-runtime implementations land in Phase 3. */
export const slideTransitionSchema = z
  .object({
    kind: z.enum(['none', 'fade', 'slide-left', 'slide-right', 'zoom', 'push']),
    durationMs: z.number().int().nonnegative().default(400),
  })
  .strict();
export type SlideTransition = z.infer<typeof slideTransitionSchema>;

export const slideSchema = z
  .object({
    id: idSchema,
    title: z.string().max(400).optional(),
    elements: z.array(elementSchema),
    background: slideBackgroundSchema.optional(),
    transition: slideTransitionSchema.optional(),
    /** Static slide duration in ms when exported to video/PDF. Omit for "advance on user". */
    durationMs: z.number().int().positive().optional(),
    notes: z.string().max(5000).optional(),
  })
  .strict();
export type Slide = z.infer<typeof slideSchema>;

export const slideContentSchema = z
  .object({
    mode: z.literal('slide'),
    slides: z.array(slideSchema).min(1),
  })
  .strict();
export type SlideContent = z.infer<typeof slideContentSchema>;
