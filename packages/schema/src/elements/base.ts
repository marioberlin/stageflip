// packages/schema/src/elements/base.ts
// Shared base shape for every element in the canonical schema. Each element
// type extends this via Zod's .merge() (see siblings in this dir).

import { z } from 'zod';
import { animationSchema } from '../animations.js';
import { idSchema, transformSchema } from '../primitives.js';

/**
 * Per-element template reference. Slides whose elements carry an
 * `inheritsFrom` borrow unset top-level fields from the matching placeholder
 * on the layout (or transitively on the layout's master). PPTX
 * `<p:ph idx="N"/>` and Slides `placeholder.index` both map onto
 * `placeholderIdx`. See `../inheritance.ts` for the materialization helper.
 */
export const elementInheritsFromSchema = z
  .object({
    /** id of a SlideLayout or SlideMaster in `Document.layouts` / `Document.masters`. */
    templateId: idSchema,
    /**
     * Placeholder index. PPTX `<p:ph idx="N"/>`, Slides `placeholder.index`.
     * Multiple elements on the same template can share `placeholderIdx` if
     * the template defines a positional family (e.g., "content" placeholder
     * with multiple text frames).
     */
    placeholderIdx: z.number().int().nonnegative(),
  })
  .strict();
export type ElementInheritsFrom = z.infer<typeof elementInheritsFromSchema>;

/**
 * Fields every element carries, regardless of `type`. `zIndex` is deliberately
 * absent — the RIR compiler assigns it from array order × 10 at compile time
 * (see skills/stageflip/concepts/rir/SKILL.md). Animations attach per-element
 * and are resolved at timing-flatten (T-031).
 */
export const elementBaseSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1).max(200).optional(),
    transform: transformSchema,
    visible: z.boolean().default(true),
    locked: z.boolean().default(false),
    animations: z.array(animationSchema).default([]),
    inheritsFrom: elementInheritsFromSchema.optional(),
  })
  .strict();

export type ElementBase = z.infer<typeof elementBaseSchema>;
