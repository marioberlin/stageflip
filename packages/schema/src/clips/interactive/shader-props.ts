// packages/schema/src/clips/interactive/shader-props.ts
// Per-family `liveMount.props` schema for `family: 'shader'` (T-383 D-T383-3).
// First narrowing of the Phase γ discriminated-union pattern hinted at by
// T-305: `liveMount.props` was `z.record(z.unknown())` at the contract layer;
// per-family schemas live here and are dispatched at gate time
// (`check-preset-integrity`) keyed on `family`.
//
// BROWSER-SAFE — pure Zod. No `fs` / `path` / `child_process` / Node-only
// modules. `@stageflip/schema` is consumed by browser apps; per
// `feedback_t304_lessons.md` any new file under this package must keep
// the browser-bundle hazard surface zero.

import { z } from 'zod';

/**
 * A scalar or vector uniform value. Matches what the WebGL host accepts —
 * `number` (uniform1f) or a small numeric array (uniform2f / 3f / 4f). The
 * runtime rejects lengths outside 1..4 at draw time; the schema mirrors
 * that constraint so authoring-time validation catches it before mount.
 */
export const uniformValueSchema = z.union([
  z.number(),
  z
    .array(z.number())
    .min(1, 'uniform vector must have 1..4 components')
    .max(4, 'uniform vector must have 1..4 components'),
]);
export type UniformValue = z.infer<typeof uniformValueSchema>;

/**
 * `liveMount.props` shape for `family: 'shader'`. Strict-shaped:
 * unknown keys are rejected so a typo at author time does not silently
 * become a no-op uniform.
 *
 * - `fragmentShader` — raw GLSL source. Validated for explicit float
 *   precision at mount time by `validateFragmentShader` from
 *   `@stageflip/runtimes-shader` (T-065 rule).
 * - `initialUniforms` — uniforms applied at mount time. Per-frame uniforms
 *   come from the (optional) caller-supplied `@uniformUpdater`; defaulting
 *   here keeps `props.initialUniforms` always-present in code paths.
 * - `width` / `height` — canvas size in CSS pixels. Positive integers; the
 *   factory uses these as the WebGL viewport.
 * - `posterFrame` — frame at which `staticFallback` is sampled by
 *   cluster-author tooling. Default 0 keeps the schema usable without a
 *   poster-generation pipeline (T-383 out-of-scope).
 */
export const shaderClipPropsSchema = z
  .object({
    fragmentShader: z.string().min(1, 'fragmentShader must be a non-empty GLSL source'),
    initialUniforms: z.record(uniformValueSchema).default({}),
    width: z.number().int().positive('width must be a positive integer'),
    height: z.number().int().positive('height must be a positive integer'),
    posterFrame: z.number().int().nonnegative().default(0),
  })
  .strict();

/** Inferred shape of {@link shaderClipPropsSchema}. */
export type ShaderClipProps = z.infer<typeof shaderClipPropsSchema>;
