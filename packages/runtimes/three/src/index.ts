// packages/runtimes/three/src/index.ts
// @stageflip/runtimes-three — Three.js scenes as live ClipRuntime clips.
// Authors bring their own THREE instance and construct scene/camera/
// renderer inside `setup`; the host calls `render` on every frame change.
// No animation loop, no rAF — all motion is driven by seek-style render
// calls keyed on the FrameClock.
//
// Determinism posture: the host never invokes renderer.setAnimationLoop.
// Clip code under src/clips/** is scanned by check-determinism; keep THREE
// calls deterministic (avoid Math.random, Date.now). THREE's internal
// state mutation during setup is one-time and not timing-sensitive.
//
// License: three is MIT (0.184.0). No REVIEWED_OK pairing needed.

import { type ReactElement, createElement } from 'react';

import type {
  ClipDefinition,
  ClipRenderContext,
  ClipRuntime,
  FontRequirement,
} from '@stageflip/runtimes-contract';

import { ThreeClipHost } from './host.js';
import type { ThreeClipSetup } from './types.js';

export type {
  ThreeClipHandle,
  ThreeClipRenderArgs,
  ThreeClipSetup,
  ThreeClipSetupArgs,
} from './types.js';

export interface DefineThreeClipInput<P> {
  /** Globally unique clip kind. */
  kind: string;
  /**
   * Construct the scene. Called once per mount. Authors:
   *   1. Create scene / camera / renderer with their own `import * as THREE from 'three'`.
   *   2. Append `renderer.domElement` to the provided `container`.
   *   3. Return `{ render(args), dispose?() }`.
   */
  setup: ThreeClipSetup<P>;
  /** Optional: fonts this clip needs (consumed by T-072 FontManager). */
  fontRequirements?(props: P): FontRequirement[];
}

/**
 * Adapt a three.js scene into a `ClipDefinition<unknown>`.
 *
 * The P generic is erased at the return site — the runtime registry stores
 * clips uniformly as `ClipDefinition<unknown>`. Internal closures keep the
 * concrete `P` binding.
 */
export function defineThreeClip<P>(input: DefineThreeClipInput<P>): ClipDefinition<unknown> {
  const def: ClipDefinition<P> = {
    kind: input.kind,
    render(ctx: ClipRenderContext<P>): ReactElement | null {
      const localFrame = ctx.frame - ctx.clipFrom;
      if (localFrame < 0 || localFrame >= ctx.clipDurationInFrames) {
        return null;
      }
      const hostProps = {
        setup: input.setup,
        width: ctx.width,
        height: ctx.height,
        props: ctx.props,
        localFrame,
        fps: ctx.fps,
        clipDurationInFrames: ctx.clipDurationInFrames,
      } as unknown as Parameters<typeof ThreeClipHost>[0];
      return createElement(ThreeClipHost, hostProps);
    },
  };
  if (input.fontRequirements !== undefined) {
    def.fontRequirements = input.fontRequirements;
  }
  return def as unknown as ClipDefinition<unknown>;
}

/**
 * Build the three ClipRuntime with the given clips. `id: 'three'`,
 * `tier: 'live'`. Duplicate kinds throw.
 */
export function createThreeRuntime(clips: Iterable<ClipDefinition<unknown>> = []): ClipRuntime {
  const clipMap = new Map<string, ClipDefinition<unknown>>();
  for (const clip of clips) {
    if (clipMap.has(clip.kind)) {
      throw new Error(
        `createThreeRuntime: duplicate clip kind '${clip.kind}' — each kind must be unique within the runtime`,
      );
    }
    clipMap.set(clip.kind, clip);
  }
  return {
    id: 'three',
    tier: 'live',
    clips: clipMap,
  };
}

export { threeProductReveal } from './clips/three-product-reveal.js';
