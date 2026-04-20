// packages/schema/src/theme.ts
// Minimal theme shape. The 8-step design-system learning pipeline (T-249)
// produces a richer `LearnedTheme`; this shape is what a hand-authored
// document carries. Token paths match the `theme:<dotted.path>` ref shape
// from ./primitives.ts.

import { z } from 'zod';
import { colorValueSchema, hexColorSchema } from './primitives.js';

/**
 * Theme tokens keyed by dotted path. Callers reference them via
 * `theme:color.primary`, `theme:typography.body.size`, etc. Values are either
 * hex color literals or free strings (for fonts, spacing units, numbers
 * stringified, etc.). Per-kind sub-schemas arrive with T-249.
 */
export const themeTokensSchema = z.record(z.union([hexColorSchema, z.string(), z.number()]));
export type ThemeTokens = z.infer<typeof themeTokensSchema>;

/**
 * Named palette entries. Convenience on top of raw tokens for the most
 * common theming needs (primary / secondary / background / foreground).
 */
export const themePaletteSchema = z
  .object({
    primary: colorValueSchema.optional(),
    secondary: colorValueSchema.optional(),
    accent: colorValueSchema.optional(),
    background: colorValueSchema.optional(),
    foreground: colorValueSchema.optional(),
    surface: colorValueSchema.optional(),
  })
  .strict();
export type ThemePalette = z.infer<typeof themePaletteSchema>;

export const themeSchema = z
  .object({
    tokens: themeTokensSchema.default({}),
    palette: themePaletteSchema.optional(),
  })
  .strict();
export type Theme = z.infer<typeof themeSchema>;
