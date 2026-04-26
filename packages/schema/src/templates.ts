// packages/schema/src/templates.ts
// SlideMaster + SlideLayout — deck-level template stores. PPTX
// `<p:sldMaster>` / `<p:sldLayout>` and Google Slides `pageType: 'MASTER' |
// 'LAYOUT'` both model these as separate tiers; the canonical schema keeps
// them separate too so round-trip imports preserve the distinction.
//
// Slide elements that carry an `inheritsFrom: { templateId, placeholderIdx }`
// have their unset top-level fields filled at compile-time from the matching
// placeholder on the layout (or transitively on the layout's master). See
// `./inheritance.ts` for the materialization helper.

import { z } from 'zod';
import { elementSchema } from './elements/index.js';
import { idSchema } from './primitives.js';
import { themeSchema } from './theme.js';

/**
 * SlideMaster — top-level template. One per "design system" the deck uses;
 * a deck typically has one master with several layouts under it. Masters
 * own placeholder elements that layouts (and ultimately slides) extend
 * via `inheritsFrom`.
 *
 * `theme` is an optional override on `Document.theme` — masters can rebrand
 * a subset of slides. Future work adds the theme-resolution pass; T-251
 * carries the field but does not implement override application.
 */
export const slideMasterSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1).max(200),
    theme: themeSchema.partial().optional(),
    placeholders: z.array(elementSchema).default([]),
  })
  .strict();
export type SlideMaster = z.infer<typeof slideMasterSchema>;

/**
 * SlideLayout — second-tier template that extends one master. Layouts own
 * placeholder elements that slides extend via `inheritsFrom`. A layout's
 * placeholders inherit transitively from the master at render time.
 */
export const slideLayoutSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1).max(200),
    masterId: idSchema,
    placeholders: z.array(elementSchema).default([]),
  })
  .strict();
export type SlideLayout = z.infer<typeof slideLayoutSchema>;
