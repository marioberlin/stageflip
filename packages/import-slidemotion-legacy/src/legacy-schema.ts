// packages/import-slidemotion-legacy/src/legacy-schema.ts
// Permissive zod schemas for validating legacy SlideMotion input.

/**
 * These schemas accept the subset of the SlideMotion CanonicalDocument shape
 * that the MVP converter can translate. Fields outside the subset are parsed
 * as `unknown` and surface as import warnings rather than hard failures — the
 * caller (editor import flow, CLI) decides whether to present the warning and
 * continue or abort. We deliberately do NOT re-declare every shape from
 * `reference/slidemotion/packages/schema/**`; instead we accept shallow
 * shapes and let per-element mappers drill into the parts they need.
 *
 * Input invariants
 * ----------------
 *   - `id` + `slides` on the document are required.
 *   - Every slide has an `id`.
 *   - Every element has a `type` and an `id`; other fields vary by type and
 *     are parsed as `unknown` to keep the input permissive. This mirrors how
 *     a real legacy deck might arrive — stored JSON from an older version of
 *     the schema that never validated against today's types.
 */

import { z } from 'zod';

export const legacyFrameSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    rotation: z.number().optional(),
  })
  .passthrough();

export const legacyElementSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().optional(),
    type: z.string().min(1),
    frame: legacyFrameSchema,
    locked: z.boolean().optional(),
    visible: z.boolean().optional(),
    opacity: z.number().optional(),
    altText: z.string().optional(),
  })
  .passthrough();

export const legacySlideBackgroundSchema = z
  .object({
    type: z.enum(['solid', 'image', 'gradient']),
  })
  .passthrough();

export const legacySlideSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().optional(),
    elements: z.array(legacyElementSchema).default([]),
    background: legacySlideBackgroundSchema.optional(),
    notes: z.string().optional(),
    duration: z.union([z.number(), z.literal('auto'), z.record(z.unknown())]).optional(),
    width: z.number().optional(),
    height: z.number().optional(),
  })
  .passthrough();

export const legacyDocumentSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().optional(),
    subtitle: z.string().optional(),
    author: z.string().optional(),
    created: z.string().optional(),
    modified: z.string().optional(),
    slides: z.array(legacySlideSchema).min(1),
    version: z.string().optional(),
  })
  .passthrough();

export type LegacyFrame = z.infer<typeof legacyFrameSchema>;
export type LegacyElement = z.infer<typeof legacyElementSchema>;
export type LegacySlide = z.infer<typeof legacySlideSchema>;
export type LegacyDocument = z.infer<typeof legacyDocumentSchema>;
