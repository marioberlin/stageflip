// packages/schema/src/clips/interactive/three-scene-props.ts
// Per-family `liveMount.props` schema for `family: 'three-scene'` (T-384
// D-T384-3). Replicates the discriminator pattern set by `shader-props.ts`:
// strict-shaped Zod object, browser-safe, dispatched at gate time
// (`check-preset-integrity`) keyed on the clip's `family` field.
//
// BROWSER-SAFE — pure Zod. No `fs` / `path` / `child_process` / Node-only
// modules. `@stageflip/schema` is consumed by browser apps; per
// `feedback_t304_lessons.md` any new file under this package must keep
// the browser-bundle hazard surface zero.
//
// `setupRef` reuses `componentRefSchema` (T-305) for an indirection that is
// new in this preset surface: the resolved symbol is NOT a React component;
// it is a `ThreeClipSetup<P>` callback. The shape of the module string is
// the same (`<package>#<Symbol>`); the runtime resolves it via dynamic
// import at mount time and asserts the resolved value is a function.

import { z } from 'zod';

import { componentRefSchema } from '../interactive.js';

/**
 * `liveMount.props` shape for `family: 'three-scene'`. Strict-shaped:
 * unknown keys are rejected so a typo at author time does not silently
 * become a no-op.
 *
 * - `setupRef` — `<package>#<Symbol>` reference to the author's
 *   `ThreeClipSetup<P>` callback. The runtime dynamic-imports the module
 *   and resolves the named symbol at mount time; this is the first
 *   non-React-component use of `componentRefSchema`. Three.js scenes are
 *   imperative JavaScript and cannot be serialised inline (cf. shader's
 *   `fragmentShader: string`).
 * - `width` / `height` — canvas size in CSS pixels. Positive integers.
 * - `setupProps` — author-supplied props forwarded to setup + render.
 *   Schema-opaque at this layer; authors validate with their own Zod
 *   schema if desired.
 * - `posterFrame` — frame at which `staticFallback` is sampled by
 *   cluster-author tooling. Default 0.
 * - `prngSeed` — non-negative integer seed for the seeded PRNG passed to
 *   the author's setup callback (D-T384-5). Default 0. The PRNG seed
 *   travels with the preset and produces the same output every render —
 *   this is the opt-in determinism path for three-scene authors.
 */
export const threeSceneClipPropsSchema = z
  .object({
    setupRef: componentRefSchema,
    width: z.number().int().positive('width must be a positive integer'),
    height: z.number().int().positive('height must be a positive integer'),
    setupProps: z.record(z.unknown()).default({}),
    posterFrame: z.number().int().nonnegative().default(0),
    prngSeed: z.number().int().nonnegative().default(0),
  })
  .strict();

/** Inferred shape of {@link threeSceneClipPropsSchema}. */
export type ThreeSceneClipProps = z.infer<typeof threeSceneClipPropsSchema>;
