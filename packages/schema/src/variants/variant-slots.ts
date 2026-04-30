// packages/schema/src/variants/variant-slots.ts
// T-386 — `Document.variantSlots` schema. Each slot is a named pointer
// (`{ elementId, path }`) into an Element's text-property; @stageflip/variant-gen
// substitutes content at axis-resolution time.
//
// BROWSER-SAFE — pure Zod. No `fs` / `path` / Node-only modules.
// `@stageflip/schema` is consumed by browser apps; per
// `feedback_t304_lessons.md` any new file under this package must keep
// the browser-bundle hazard surface zero.

import { z } from 'zod';

/**
 * One named variant slot. Points to an Element by ID and the dotted-path
 * inside that element where text content lives (today: `'text'` for
 * TextElement, `'placeholder'` for placeholder fields).
 *
 * Authors mark text as variant-slot-bound at authoring time; variant-gen
 * resolves the pointer + substitutes text per axis entry.
 */
export const variantSlotDefSchema = z
  .object({
    elementId: z.string().min(1),
    /** Property path inside the element. Dotted; e.g. `'text'` or `'props.placeholder'`. */
    path: z.string().min(1),
  })
  .strict();
export type VariantSlotDef = z.infer<typeof variantSlotDefSchema>;

/** Map of slot-name → slot definition. Keys are author-chosen short names. */
export const variantSlotsSchema = z.record(variantSlotDefSchema);
export type VariantSlots = z.infer<typeof variantSlotsSchema>;
