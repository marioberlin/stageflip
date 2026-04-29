// packages/runtimes/interactive/src/clips/shader/uniforms.ts
// Default `@uniformUpdater` for `ShaderClip` (T-383 D-T383-5). Maps
// `(frame, fps, resolution)` to the standard `uFrame` / `uTime` /
// `uResolution` uniforms used by `@stageflip/runtimes-shader`.
//
// DETERMINISM SUB-RULE (T-309): this file lives under
// `packages/runtimes/interactive/src/clips/shader/**` and is therefore
// scanned by the shader sub-rule. Every top-level function MUST accept
// `frame: number` as a parameter and MUST NOT call `Date.now`,
// `performance.now`, `Math.random`, `setTimeout`/`setInterval`, or
// `requestAnimationFrame`/`cancelAnimationFrame`. The factory's call site
// passes the current `FrameSource.current()` value as `frame`.
//
// The `@uniformUpdater` JSDoc tag opts the function into the sub-rule
// regardless of file path — belt-and-braces with the path-based check.

import type { UniformValue } from '@stageflip/runtimes-shader';

import type { ShaderClipProps } from './props.js';

/** Auxiliary inputs to the uniform updater (everything except `frame`). */
export interface UniformContext {
  /** Composition fps. Used to derive `uTime` from `frame`. */
  fps: number;
  /** Canvas resolution `[width, height]` in CSS pixels. */
  resolution: readonly [number, number];
  /** Validated shader-clip props. */
  props: ShaderClipProps;
}

/**
 * Function shape implemented by a `@uniformUpdater`. `frame` is the first
 * parameter so the determinism sub-rule's structural check (D-T309-2) can
 * confirm the function names `frame` in its signature.
 */
export type UniformUpdater = (
  frame: number,
  ctx: UniformContext,
) => Readonly<Record<string, UniformValue>>;

/**
 * Default uniform updater. Maps frame → `uFrame` (raw int as float),
 * `uTime` (seconds), `uResolution` (vec2). Caller-supplied
 * `props.initialUniforms` are merged in so static uniforms (e.g.,
 * `uColor`) appear alongside the time-varying defaults.
 *
 * @uniformUpdater
 */
export function defaultShaderUniforms(
  frame: number,
  ctx: UniformContext,
): Readonly<Record<string, UniformValue>> {
  const { fps, resolution, props } = ctx;
  return {
    ...props.initialUniforms,
    uFrame: frame,
    uTime: frame / fps,
    uResolution: [resolution[0], resolution[1]],
  };
}
