// packages/schema/src/content/display.ts
// StageFlip.Display content — IAB/GDN-compliant HTML5 banners. The budget
// field matches the T-021 [rev] note and concepts/display-budget/SKILL.md.

import { z } from 'zod';
import { elementSchema } from '../elements/index.js';
import { assetRefSchema, idSchema } from '../primitives.js';

/** Banner dimensions for one instance in a multi-size export. */
export const bannerSizeSchema = z
  .object({
    id: idSchema,
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    name: z.string().min(1).max(100).optional(),
  })
  .strict();
export type BannerSize = z.infer<typeof bannerSizeSchema>;

/** Required fallback assets for IAB compliance. */
export const bannerFallbackSchema = z
  .object({
    png: assetRefSchema,
    gif: assetRefSchema.optional(),
  })
  .strict();
export type BannerFallback = z.infer<typeof bannerFallbackSchema>;

/**
 * File-size and external-resource budget. Enforced at RIR compile, editor
 * preview, export, and Validator stages — see concepts/display-budget/SKILL.md.
 *
 * Field semantics match the T-021 [rev] spec verbatim:
 *   totalZipKb            — hard cap on the produced .zip
 *   externalFontsAllowed  — if false, every glyph must be inlined via @fontsource
 *   externalFontsKbCap    — cap applied when externalFontsAllowed=true
 *   assetsInlined         — true = every asset in the ZIP; false = CDN refs OK
 */
export const displayBudgetSchema = z
  .object({
    totalZipKb: z.number().int().positive(),
    externalFontsAllowed: z.boolean().default(false),
    externalFontsKbCap: z.number().int().nonnegative().default(0),
    assetsInlined: z.boolean().default(true),
  })
  .strict()
  .refine((b) => (b.externalFontsAllowed ? b.externalFontsKbCap > 0 : true), {
    message: 'externalFontsKbCap must be positive when externalFontsAllowed=true',
    path: ['externalFontsKbCap'],
  });
export type DisplayBudget = z.infer<typeof displayBudgetSchema>;

export const displayContentSchema = z
  .object({
    mode: z.literal('display'),
    sizes: z.array(bannerSizeSchema).min(1),
    durationMs: z.number().int().positive(),
    /** IAB clickTag exit URL. Ad networks replace this at serve time. */
    clickTag: z.string().min(1).optional(),
    fallback: bannerFallbackSchema.optional(),
    budget: displayBudgetSchema,
    elements: z.array(elementSchema),
  })
  .strict();
export type DisplayContent = z.infer<typeof displayContentSchema>;
