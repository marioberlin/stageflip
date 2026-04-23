// packages/runtimes/shader/src/clips/shader-bg.ts
// T-131d.2 port of reference/slidemotion/.../clips/shader-bg.tsx.
//
// Escape-hatch GLSL clip — user supplies a fragment-shader BODY via
// the `glsl` render-time prop + a scalar-uniforms map. The runtime
// composes a full fragment source by prepending
//   precision mediump float;
//   uniform float u_time;
//   uniform vec2  u_resolution;
//   uniform float <name>;   // one per entry in props.uniforms
// so the author only writes the `void main()` + helpers.
//
// Falls back silently to a blank canvas if the composed shader fails
// to compile (see `ShaderClipHost` — linkProgram errors are swallowed
// so one malformed deck prop doesn't crash the rest of the slide).
//
// Determinism: `u_time` is derived from the FrameClock via the
// standard uniforms path. No wall-clock APIs inside the shader runtime
// (check-determinism scans this directory).

import type { ClipDefinition } from '@stageflip/runtimes-contract';
import { z } from 'zod';

import { defineShaderClip } from '../index.js';
import type { UniformValue } from '../types.js';

export const shaderBgPropsSchema = z
  .object({
    /** Fragment-shader BODY (the `void main()` function + helpers). */
    glsl: z.string().min(10),
    /** Scalar float uniforms, one per key. Names must be valid GLSL identifiers. */
    uniforms: z.record(z.string(), z.number()).optional(),
  })
  .strict();

export type ShaderBgProps = z.infer<typeof shaderBgPropsSchema>;

const GLSL_IDENT_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * GLSL reserves every `gl_`-prefixed identifier for built-ins
 * (`gl_FragColor`, `gl_Position`, `gl_PointCoord`, …) — re-declaring
 * one as a user uniform would compile-fail and silent-bail the canvas.
 * Filter them out proactively so a typo in a deck prop doesn't blank
 * the slide.
 */
function isValidUserUniformName(name: string): boolean {
  return GLSL_IDENT_RE.test(name) && !name.startsWith('gl_');
}

const FRAGMENT_HEADER = [
  'precision mediump float;',
  'varying vec2 v_uv;',
  'uniform float u_time;',
  'uniform vec2 u_resolution;',
].join('\n');

/**
 * Compose the full fragment shader source from the user's body + a
 * uniform declaration for every entry in `props.uniforms`. Invalid
 * identifier keys are dropped (a defence-in-depth check; the Zod
 * schema accepts any string).
 */
export function composeShaderBgFragment(props: ShaderBgProps): string {
  const userUniforms = props.uniforms ?? {};
  const userUniformDecls = Object.keys(userUniforms)
    .filter(isValidUserUniformName)
    .sort()
    .map((name) => `uniform float ${name};`)
    .join('\n');
  const header =
    userUniformDecls.length > 0 ? `${FRAGMENT_HEADER}\n${userUniformDecls}` : FRAGMENT_HEADER;
  return `${header}\n${props.glsl}`;
}

/**
 * Build the per-frame uniforms object. Always includes `u_time` + `u_resolution`;
 * user-supplied scalar uniforms are merged in, with valid-identifier filtering.
 */
export function buildShaderBgUniforms(
  timeSec: number,
  resolution: readonly [number, number],
  userUniforms: Readonly<Record<string, number>>,
): Readonly<Record<string, UniformValue>> {
  const out: Record<string, UniformValue> = {
    u_time: timeSec,
    u_resolution: resolution,
  };
  for (const [name, value] of Object.entries(userUniforms)) {
    if (!isValidUserUniformName(name)) continue;
    out[name] = value;
  }
  return out;
}

export const shaderBg: ClipDefinition<unknown> = defineShaderClip<ShaderBgProps>({
  kind: 'shader-bg',
  propsSchema: shaderBgPropsSchema,
  fragmentShader: composeShaderBgFragment,
  uniforms: ({ timeSec, resolution, props }) =>
    buildShaderBgUniforms(timeSec, resolution, props.uniforms ?? {}),
});
