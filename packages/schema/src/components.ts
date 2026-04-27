// packages/schema/src/components.ts
// Slot + layout descriptor schemas for `ComponentDefinition.body` (T-249).
// The design-system pipeline's step 5 (component extraction) emits
// `ComponentDefinition` records with a typed body — slot identification +
// a layout descriptor — which `componentDefinitionSchema` now validates
// instead of accepting `z.unknown()` for the body.

import { z } from 'zod';
import { idSchema } from './primitives.js';

/**
 * A slot in a component — a per-instance override surface. Slots are
 * identified by step 5's vary-by-slide analysis: element fields that vary
 * across the recurring grouping's instances become slots, fields that are
 * stable bake into the component definition.
 *
 * `kind` matches the canonical `ElementKind` discriminator the slot can be
 * filled with. `optional` marks slots that some instances of the component
 * leave empty (e.g., a card with an optional badge).
 */
export const slotDefinitionSchema = z
  .object({
    /** Slot id — stable across re-runs for the same component. */
    id: idSchema,
    /** Human-readable slot name (e.g., "title", "body", "image"). */
    name: z.string().min(1).max(100),
    /** What kind of element fills this slot. */
    kind: z.enum(['text', 'image', 'video', 'audio', 'shape', 'table', 'chart', 'embed', 'code']),
    /** Whether instances may omit this slot. */
    optional: z.boolean().default(false),
  })
  .strict();
export type SlotDefinition = z.infer<typeof slotDefinitionSchema>;

/**
 * Layout descriptor for a component. The design-system pipeline emits
 * a normalized-coordinate (0..1 within the component's bounding box) layout
 * so the component can scale to any container size at instantiation time.
 *
 * `cells` orders slots in render order — the component's elements are
 * laid out one cell per slot (1:1).
 */
export const layoutDescriptorSchema = z
  .object({
    /** Component bounding-box width in normalized units (always 1). */
    width: z.literal(1),
    /** Component bounding-box height in normalized units (always 1). */
    height: z.literal(1),
    /** Per-slot cell rectangles in normalized coordinates. */
    cells: z
      .array(
        z
          .object({
            slotId: idSchema,
            x: z.number().min(0).max(1),
            y: z.number().min(0).max(1),
            width: z.number().min(0).max(1),
            height: z.number().min(0).max(1),
          })
          .strict(),
      )
      .default([]),
  })
  .strict();
export type LayoutDescriptor = z.infer<typeof layoutDescriptorSchema>;
