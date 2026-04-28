// packages/schema/src/elements/blender-clip.ts
// BlenderClip element — declares a 3D scene that must be pre-rendered offline
// by the bake tier (T-265). The clip's `inputsHash` is the cache key:
// `bakes/{inputsHash}/frame-{N}.png` per docs/architecture.md:330. The hash
// is pinned at clip creation so re-renders that produce the same hash hit the
// cache; any input change produces a new hash.
//
// Per ADR-003 §D2, BlenderClip is the only element type so far that uses the
// bake runtime tier — see skills/stageflip/concepts/runtimes/SKILL.md.

import { z } from 'zod';
import { elementBaseSchema } from './base.js';

/** Hex SHA-256 (lower-case, 64 chars). The cache key for the bake tier. */
export const inputsHashSchema = z.string().regex(/^[a-f0-9]{64}$/, {
  message: 'inputsHash must be a lower-case hex SHA-256 (64 chars)',
});

/**
 * Scene template + parameter bag the worker injects into a Blender scene.
 * `template` references a built-in (`fluid-sim`, `product-render`,
 * `particle-burst`); `params` is a free-form record validated by the
 * template's own JSON Schema in the worker.
 */
export const blenderSceneSchema = z
  .object({
    template: z.string().min(1).max(100),
    params: z.record(z.unknown()).default({}),
  })
  .strict();

/** Duration + fps. Distinct from animation timing — this is render extent. */
export const blenderDurationSchema = z
  .object({
    durationMs: z.number().int().positive(),
    fps: z.number().int().positive().default(30),
  })
  .strict();

/**
 * BlenderClip — a 3D scene rendered offline. The element ships in the document
 * with its `inputsHash` already computed; consumers verify the hash matches the
 * scene+duration before submitting a bake job.
 */
export const blenderClipSchema = elementBaseSchema
  .merge(
    z.object({
      type: z.literal('blender-clip'),
      scene: blenderSceneSchema,
      duration: blenderDurationSchema,
      inputsHash: inputsHashSchema,
    }),
  )
  .strict();

export type BlenderScene = z.infer<typeof blenderSceneSchema>;
export type BlenderDuration = z.infer<typeof blenderDurationSchema>;
export type BlenderClipElement = z.infer<typeof blenderClipSchema>;
