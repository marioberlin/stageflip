// packages/schema/src/primitives.ts
// Shared scalar + struct schemas used across every element type. Kept in one
// place so invariants (hex-color format, asset-ref shape, id format) have one
// source of truth.

import { z } from 'zod';

/** Element and other IDs. Nanoid-style (21-char URL-safe alphabet). */
export const idSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, { message: 'id must be URL-safe (A-Z a-z 0-9 _ -)' });

/** #RGB / #RRGGBB / #RRGGBBAA lowercased hex. */
export const hexColorSchema = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, {
    message: 'color must be #RGB, #RRGGBB, or #RRGGBBAA',
  });

/**
 * An opaque reference to an asset. Resolution is owned by the storage +
 * preflight pipeline (T-084a). At the schema level the only contract is that
 * the reference is a string of the agreed shape.
 */
export const assetRefSchema = z
  .string()
  .regex(/^asset:[A-Za-z0-9_-]+$/, { message: 'asset ref must be "asset:<id>"' });

/**
 * A reference to a theme token (e.g. "theme:color.primary"). Resolved by the
 * RIR compiler's theme-resolve pass.
 */
export const themeRefSchema = z.string().regex(/^theme:[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/, {
  message: 'theme ref must be "theme:dotted.lower.path"',
});

/** A color value: either a hex literal or a theme token reference. */
export const colorValueSchema = z.union([hexColorSchema, themeRefSchema]);

/** Affine transform on the canvas. Rotation is degrees; opacity is 0..1. */
export const transformSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().finite().positive(),
    height: z.number().finite().positive(),
    rotation: z.number().finite().default(0),
    opacity: z.number().min(0).max(1).default(1),
  })
  .strict();

export type Id = z.infer<typeof idSchema>;
export type HexColor = z.infer<typeof hexColorSchema>;
export type AssetRef = z.infer<typeof assetRefSchema>;
export type ThemeRef = z.infer<typeof themeRefSchema>;
export type ColorValue = z.infer<typeof colorValueSchema>;
export type Transform = z.infer<typeof transformSchema>;
