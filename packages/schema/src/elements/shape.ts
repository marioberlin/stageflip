// packages/schema/src/elements/shape.ts
// Shape element — SVG primitives + custom paths. Fill + stroke options.

import { z } from 'zod';
import { colorValueSchema } from '../primitives.js';
import { elementBaseSchema } from './base.js';

export const strokeSchema = z
  .object({
    color: colorValueSchema,
    width: z.number().nonnegative(),
    dasharray: z.array(z.number().nonnegative()).optional(),
    linecap: z.enum(['butt', 'round', 'square']).default('butt'),
    linejoin: z.enum(['miter', 'round', 'bevel']).default('miter'),
  })
  .strict();

/**
 * Shape kind. `custom-path` requires `path` to carry an SVG d-attribute string;
 * the other kinds derive from the element's transform width/height.
 */
export const shapeKindSchema = z.enum([
  'rect',
  'ellipse',
  'line',
  'polygon',
  'star',
  'custom-path',
]);

export const shapeElementSchema = elementBaseSchema
  .merge(
    z.object({
      type: z.literal('shape'),
      shape: shapeKindSchema,
      path: z.string().optional(),
      fill: colorValueSchema.optional(),
      stroke: strokeSchema.optional(),
      cornerRadius: z.number().nonnegative().optional(),
    }),
  )
  .strict();

// Note: the `custom-path requires path` constraint is deliberately NOT a
// .refine() here — that would turn this schema into a ZodEffects and make it
// incompatible with z.discriminatedUnion. The constraint is re-asserted at
// RIR compile time (T-031) where failures can be traced to a document
// location. Callers that need early validation can use `validateShapeElement`
// below.

/** Semantic check for `custom-path` shapes. Returns null on OK, a message on violation. */
export function validateShapeElement(e: z.infer<typeof shapeElementSchema>): string | null {
  if (e.shape === 'custom-path' && (e.path === undefined || e.path.length === 0)) {
    return 'custom-path shapes require a path (SVG d-attribute string)';
  }
  return null;
}

export type Stroke = z.infer<typeof strokeSchema>;
export type ShapeKind = z.infer<typeof shapeKindSchema>;
export type ShapeElement = z.infer<typeof shapeElementSchema>;
