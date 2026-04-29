// packages/runtimes/shader/src/index.ts
// @stageflip/runtimes-shader — WebGL fragment shaders as live ClipRuntime
// clips. Each clip provides a fragment shader source and a per-frame uniform
// computation; the host compiles the shader against a standard fullscreen-
// quad vertex shader and re-draws on every frame.
//
// Determinism posture: the render function is pure given (localFrame, fps,
// clipDurationInFrames, props). Uniforms are computed from those deterministic
// inputs. WebGL is used synchronously — no timers, no rAF. Clip source lives
// under src/clips/** and is scanned by check-determinism.
//
// Explicit-precision rule (T-065): every author fragment shader MUST declare
// a float precision (`precision highp|mediump|lowp float;`). Enforced at
// defineShaderClip() time via validateFragmentShader() — implicit precision
// causes cross-device drift that defeats the parity harness.

import { type ReactElement, createElement } from 'react';
import type { ZodType } from 'zod';

import type {
  ClipDefinition,
  ClipRenderContext,
  ClipRuntime,
  FontRequirement,
  ThemeSlot,
} from '@stageflip/runtimes-contract';

import { ShaderClipHost } from './host.js';
import type { GlContextFactory, UniformValue, UniformsForFrame } from './types.js';
import { validateFragmentShader } from './validate.js';

export type { GlContextFactory, UniformValue, UniformsForFrame } from './types.js';
export { validateFragmentShader } from './validate.js';
export { ShaderClipHost, type ShaderClipHostProps } from './host.js';
export { defaultGlContextFactory } from './types.js';

/**
 * Either a static GLSL fragment source (validated at define time — the
 * authored-shader path) or a function that computes the fragment from
 * props (validated at render time — the T-131d.2 user-shader escape
 * hatch used by `shader-bg`). The host silent-fallbacks on
 * compile/link failure, so render-time validation errors do not crash
 * the rest of the deck.
 */
export type FragmentShaderSource<P> = string | ((props: P) => string);

export interface DefineShaderClipInput<P> {
  /** Globally unique clip kind. */
  kind: string;
  /**
   * GLSL fragment shader source. A plain string is validated at define
   * time and must declare an explicit float precision (e.g.,
   * `precision highp float;`). A function is invoked per render with
   * the clip's props; validation is deferred to render time and the
   * host bails to a blank canvas on failure.
   * Receives the standard `varying vec2 v_uv;` from the host's vertex shader.
   */
  fragmentShader: FragmentShaderSource<P>;
  /**
   * Compute uniform values for this frame. Default maps to:
   *   u_progress: progress, u_time: timeSec, u_resolution: resolution
   * Return an object keyed by the exact uniform name the shader declares.
   */
  uniforms?: UniformsForFrame<P>;
  /** Optional: fonts this clip needs (consumed by T-072 FontManager). */
  fontRequirements?(props: P): FontRequirement[];
  /** Test seam — override WebGL context creation. */
  glContextFactory?: GlContextFactory;
  /** Zod schema for the clip's props (T-125b pattern). Forwarded to the ClipDefinition. */
  propsSchema?: ZodType<P>;
  /** Theme-slot bindings (T-131a pattern). Forwarded to the ClipDefinition. */
  themeSlots?: Readonly<Record<string, ThemeSlot>>;
}

const DEFAULT_UNIFORMS: UniformsForFrame<unknown> = ({ progress, timeSec, resolution }) => ({
  u_progress: progress,
  u_time: timeSec,
  u_resolution: resolution as readonly number[],
});

/**
 * Adapt a fragment shader into a `ClipDefinition<unknown>`.
 *
 * @throws If the fragment shader does not declare an explicit float precision.
 */
export function defineShaderClip<P>(input: DefineShaderClipInput<P>): ClipDefinition<unknown> {
  const fragmentFn: (props: P) => string =
    typeof input.fragmentShader === 'function'
      ? (input.fragmentShader as (props: P) => string)
      : (_: P): string => input.fragmentShader as string;
  if (typeof input.fragmentShader !== 'function') {
    // Authored-shader path: validate at define time so invalid GLSL is
    // caught once, not every frame. The user-shader path (function) bails
    // silently in the host on compile failure instead.
    validateFragmentShader(input.fragmentShader, input.kind);
  }

  const uniformsFn: UniformsForFrame<P> =
    input.uniforms ?? (DEFAULT_UNIFORMS as UniformsForFrame<P>);

  const def: ClipDefinition<P> = {
    kind: input.kind,
    render(ctx: ClipRenderContext<P>): ReactElement | null {
      const localFrame = ctx.frame - ctx.clipFrom;
      if (localFrame < 0 || localFrame >= ctx.clipDurationInFrames) {
        return null;
      }
      const progress =
        ctx.clipDurationInFrames === Number.POSITIVE_INFINITY
          ? 0
          : localFrame / ctx.clipDurationInFrames;
      const timeSec = localFrame / ctx.fps;
      const uniforms: Readonly<Record<string, UniformValue>> = uniformsFn({
        progress,
        timeSec,
        frame: localFrame,
        fps: ctx.fps,
        resolution: [ctx.width, ctx.height],
        props: ctx.props,
      });
      const hostProps = {
        fragmentShader: fragmentFn(ctx.props),
        width: ctx.width,
        height: ctx.height,
        uniforms,
        ...(input.glContextFactory !== undefined
          ? { glContextFactory: input.glContextFactory }
          : {}),
      };
      return createElement(ShaderClipHost, hostProps);
    },
    ...(input.fontRequirements !== undefined ? { fontRequirements: input.fontRequirements } : {}),
    ...(input.propsSchema !== undefined ? { propsSchema: input.propsSchema } : {}),
    ...(input.themeSlots !== undefined ? { themeSlots: input.themeSlots } : {}),
  };
  return def as unknown as ClipDefinition<unknown>;
}

/**
 * Build the shader ClipRuntime with the given clips. `id: 'shader'`,
 * `tier: 'live'`. Duplicate kinds throw.
 */
export function createShaderRuntime(clips: Iterable<ClipDefinition<unknown>> = []): ClipRuntime {
  const clipMap = new Map<string, ClipDefinition<unknown>>();
  for (const clip of clips) {
    if (clipMap.has(clip.kind)) {
      throw new Error(
        `createShaderRuntime: duplicate clip kind '${clip.kind}' — each kind must be unique within the runtime`,
      );
    }
    clipMap.set(clip.kind, clip);
  }
  return {
    id: 'shader',
    tier: 'live',
    clips: clipMap,
  };
}

export { flashThroughWhite } from './clips/flash-through-white.js';
export { swirlVortex } from './clips/swirl-vortex.js';
export { glitch } from './clips/glitch.js';
export {
  buildShaderBgUniforms,
  composeShaderBgFragment,
  shaderBg,
  shaderBgPropsSchema,
  type ShaderBgProps,
} from './clips/shader-bg.js';
