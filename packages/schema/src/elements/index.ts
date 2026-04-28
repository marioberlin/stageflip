// packages/schema/src/elements/index.ts
// Discriminated union of every element type + the recursive `group` element.
// Group lives here (not in its own file) so the lazy self-reference it needs
// for `children` stays next to the union definition.

import { z } from 'zod';

import { type InteractiveClip, interactiveClipSchema } from '../clips/interactive.js';
import { type AudioElement, audioElementSchema } from './audio.js';
import { type ElementBase, elementBaseSchema } from './base.js';
import { type BlenderClipElement, blenderClipSchema } from './blender-clip.js';
import { type ChartElement, chartElementSchema } from './chart.js';
import { type ClipElement, clipElementSchema } from './clip.js';
import { type CodeElement, codeElementSchema } from './code.js';
import { type EmbedElement, embedElementSchema } from './embed.js';
import { type ImageElement, imageElementSchema } from './image.js';
import { type ShapeElement, shapeElementSchema } from './shape.js';
import { type TableElement, tableElementSchema } from './table.js';
import { type TextElement, textElementSchema } from './text.js';
import { type VideoElement, videoElementSchema } from './video.js';

/**
 * Discriminated union of all 11 element types. `GroupElement` is declared
 * explicitly because it recursively contains `Element[]`; TS cannot infer a
 * self-referential shape from `z.infer` alone.
 */
export type GroupElement = ElementBase & {
  type: 'group';
  children: Element[];
  clip: boolean;
};

export type Element =
  | TextElement
  | ImageElement
  | VideoElement
  | AudioElement
  | ShapeElement
  | GroupElement
  | ChartElement
  | TableElement
  | ClipElement
  | EmbedElement
  | CodeElement
  | BlenderClipElement
  | InteractiveClip;

/**
 * Group schema with recursive `children: Element[]`. Uses `z.lazy` and an
 * explicit `z.ZodType<GroupElement>` annotation — the standard Zod pattern
 * for recursive types, which also breaks TS's "implicit any in circular
 * reference" check.
 */
export const groupElementSchema: z.ZodType<GroupElement> = z.lazy(() =>
  elementBaseSchema
    .merge(
      z.object({
        type: z.literal('group'),
        children: z.array(elementSchema),
        clip: z.boolean().default(false),
      }),
    )
    .strict(),
) as z.ZodType<GroupElement>;

/**
 * The full element union. `z.union` (not `z.discriminatedUnion`) is used
 * because two branches aren't plain ZodObjects:
 *   - `groupElementSchema` is a `z.lazy(...)` wrapper for self-recursion
 *   - composite semantic checks (see `validateShapeElement` et al.) layer
 *     outside the union so branches stay discriminated-union-compatible in
 *     principle; z.union gives us room to accept ZodEffects later if needed
 * Runtime cost at 11 branches is negligible; top-level Zod errors remain
 * readable because every branch still discriminates on `type`.
 */
/**
 * Lazy reference to `interactiveClipSchema` — `interactive.ts` imports
 * `elementSchema` from this module via `z.lazy` to use as the `staticFallback`
 * inner schema (it is itself an Element[]). Wrapping the InteractiveClip
 * branch in `z.lazy` defers binding-resolution to parse time, breaking the
 * ESM circular-import "undefined at union-construction time" hazard.
 */
const interactiveClipBranch = z.lazy(() => interactiveClipSchema);

export const elementSchema = z.union([
  textElementSchema,
  imageElementSchema,
  videoElementSchema,
  audioElementSchema,
  shapeElementSchema,
  chartElementSchema,
  tableElementSchema,
  clipElementSchema,
  embedElementSchema,
  codeElementSchema,
  blenderClipSchema,
  interactiveClipBranch,
  groupElementSchema,
]) as unknown as z.ZodType<Element>;

/**
 * All literal `type` values a CanonicalElement may carry. Exported so
 * exhaustive-switch checks can enumerate them.
 */
export const ELEMENT_TYPES = [
  'text',
  'image',
  'video',
  'audio',
  'shape',
  'group',
  'chart',
  'table',
  'clip',
  'embed',
  'code',
  'blender-clip',
  'interactive-clip',
] as const;
export type ElementType = (typeof ELEMENT_TYPES)[number];

// Re-export everything from each per-type file so callers can import from
// this barrel without reaching into individual files. New exports added to
// any element file propagate automatically.
export * from './audio.js';
export * from './base.js';
export * from './blender-clip.js';
export * from './chart.js';
export * from './clip.js';
export * from './code.js';
export * from './embed.js';
export * from './image.js';
export * from './shape.js';
export * from './table.js';
export * from './text.js';
export * from './video.js';
