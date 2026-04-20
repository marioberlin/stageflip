// packages/schema/src/elements/base.ts
// Shared base shape for every element in the canonical schema. Each element
// type extends this via Zod's .merge() (see siblings in this dir).

import { z } from 'zod';
import { animationSchema } from '../animations.js';
import { idSchema, transformSchema } from '../primitives.js';

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
  })
  .strict();

export type ElementBase = z.infer<typeof elementBaseSchema>;
