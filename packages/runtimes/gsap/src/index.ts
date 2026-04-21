// packages/runtimes/gsap/src/index.ts
// @stageflip/runtimes-gsap — wraps GSAP 3.x timelines as live ClipRuntime
// clips. Every frame the dispatcher calls render(ctx), which remaps to a
// clip-local frame and then seeks a paused GSAP timeline to that point.
//
// Determinism posture: GSAP is consumed exclusively via seek() on a
// paused timeline. The GSAP ticker is never allowed to advance our
// animations — see src/host.tsx. Clip code under src/clips/** is
// scoped by check-determinism and must not use wall-clock APIs.
//
// License: GSAP is distributed under GreenSock's "Standard 'no charge'
// license" (URL form) with a Business Green license also procured. See
// docs/dependencies.md §3 + the REVIEWED_OK entry in
// scripts/check-licenses.ts.

import { type ReactElement, createElement } from 'react';

import type {
  ClipDefinition,
  ClipRenderContext,
  ClipRuntime,
  FontRequirement,
} from '@stageflip/runtimes-contract';

import { GsapClipHost, type GsapTimelineBuild } from './host.js';

export type { GsapTimelineBuild } from './host.js';

export interface DefineGsapClipInput<P> {
  /** Globally unique clip kind. */
  kind: string;
  /**
   * Render the clip's DOM. Invoked inside the host's container div.
   * GSAP tween targets should be addressable from the returned subtree
   * via querySelector — see `motion-text-gsap` for the pattern.
   */
  render(props: P): ReactElement;
  /**
   * Configure the paused timeline for a newly-mounted instance. Called
   * once per mount with the clip's props, a fresh `gsap.core.Timeline`
   * (paused), and the container element wrapping the render output.
   */
  build: GsapTimelineBuild<P>;
  /** Optional: fonts this clip needs (consumed by T-072 FontManager). */
  fontRequirements?(props: P): FontRequirement[];
}

/**
 * Adapt a GSAP-driven clip into a `ClipDefinition<unknown>`. The produced
 * render:
 *   1. Gates on the clip window ([clipFrom, clipFrom + duration)).
 *   2. Mounts a `GsapClipHost` that owns the timeline lifecycle.
 *
 * `P` is erased at the return site — same pattern as the other runtimes.
 */
export function defineGsapClip<P>(input: DefineGsapClipInput<P>): ClipDefinition<unknown> {
  const def: ClipDefinition<P> = {
    kind: input.kind,
    render(ctx: ClipRenderContext<P>): ReactElement | null {
      const localFrame = ctx.frame - ctx.clipFrom;
      if (localFrame < 0 || localFrame >= ctx.clipDurationInFrames) {
        return null;
      }
      // Cast through unknown at the boundary: GsapClipHost is generic in P
      // but the produced ClipDefinition is stored as ClipDefinition<unknown>
      // in the runtime registry; createElement's inference doesn't carry P
      // through. Internally the closure still binds the concrete P.
      const hostProps = {
        build: input.build,
        props: ctx.props,
        render: input.render,
        localFrame,
        fps: ctx.fps,
      } as unknown as Parameters<typeof GsapClipHost>[0];
      return createElement(GsapClipHost, hostProps);
    },
  };
  if (input.fontRequirements !== undefined) {
    def.fontRequirements = input.fontRequirements;
  }
  return def as unknown as ClipDefinition<unknown>;
}

/**
 * Build the gsap ClipRuntime with the given clips. `id: 'gsap'`,
 * `tier: 'live'`. Duplicate kinds throw.
 */
export function createGsapRuntime(clips: Iterable<ClipDefinition<unknown>> = []): ClipRuntime {
  const clipMap = new Map<string, ClipDefinition<unknown>>();
  for (const clip of clips) {
    if (clipMap.has(clip.kind)) {
      throw new Error(
        `createGsapRuntime: duplicate clip kind '${clip.kind}' — each kind must be unique within the runtime`,
      );
    }
    clipMap.set(clip.kind, clip);
  }
  return {
    id: 'gsap',
    tier: 'live',
    clips: clipMap,
  };
}

// Re-export the canonical demo clip so consumers + T-067 can seed fixtures.
export { motionTextGsap, type MotionTextGsapProps } from './clips/motion-text-gsap.js';
