// packages/runtimes/lottie/src/index.ts
// @stageflip/runtimes-lottie — wraps lottie-web 5.x animations as live
// ClipRuntime clips. Every frame the dispatcher calls render(ctx), which
// remaps to a clip-local time (ms) and seeks the Lottie animation via
// `goToAndStop(ms, false)`.
//
// Determinism posture: `autoplay: false` at load time; never call play().
// The Lottie ticker never advances animations driven by this runtime.
//
// License: lottie-web is MIT. No REVIEWED_OK pairing needed.

import lottie from 'lottie-web';
import { type ReactElement, createElement } from 'react';

import type {
  ClipDefinition,
  ClipRenderContext,
  ClipRuntime,
  FontRequirement,
} from '@stageflip/runtimes-contract';

import { LottieClipHost } from './host.js';
import type { LottiePlayer } from './types.js';

export type { LottieAnimationItem, LottiePlayer } from './types.js';

export interface DefineLottieClipInput {
  /** Globally unique clip kind. */
  kind: string;
  /** Raw Lottie JSON. Typically imported with `import data from './anim.json'`. */
  animationData: unknown;
  /** Optional: fonts this clip needs (consumed by T-072 FontManager). */
  fontRequirements?(): FontRequirement[];
  /**
   * Override the lottie player — test harnesses inject a stub so tests don't
   * have to spin up the real lottie-web runtime. Defaults to the pinned
   * `lottie-web` import.
   */
  lottieFactory?(): LottiePlayer;
}

/**
 * Adapt a Lottie animation into a `ClipDefinition<unknown>`. The produced
 * render:
 *   1. Gates on the clip window ([clipFrom, clipFrom + duration)).
 *   2. Mounts a `LottieClipHost` that owns the animation lifecycle.
 *
 * Lottie clips don't use `ClipRenderContext.props` today; per-instance
 * customisation (color theming, text replacement) lands in later phases.
 */
export function defineLottieClip(input: DefineLottieClipInput): ClipDefinition<unknown> {
  // Resolve the player lazily on first render rather than at defineLottieClip
  // time. Keeps the lottie-web module untouched when tests inject a factory,
  // and keeps the render function pure+synchronous.
  let resolvedPlayer: LottiePlayer | null = null;
  const resolvePlayer = (): LottiePlayer => {
    if (resolvedPlayer !== null) return resolvedPlayer;
    resolvedPlayer = input.lottieFactory
      ? input.lottieFactory()
      : (lottie as unknown as LottiePlayer);
    return resolvedPlayer;
  };

  const def: ClipDefinition<unknown> = {
    kind: input.kind,
    render(ctx: ClipRenderContext<unknown>): ReactElement | null {
      const localFrame = ctx.frame - ctx.clipFrom;
      if (localFrame < 0 || localFrame >= ctx.clipDurationInFrames) {
        return null;
      }
      return createElement(LottieClipHost, {
        animationData: input.animationData,
        localFrame,
        fps: ctx.fps,
        lottiePlayer: resolvePlayer(),
      });
    },
  };
  if (input.fontRequirements !== undefined) {
    def.fontRequirements = input.fontRequirements;
  }
  return def;
}

/**
 * Build the lottie ClipRuntime with the given clips. `id: 'lottie'`,
 * `tier: 'live'`. Duplicate kinds throw.
 */
export function createLottieRuntime(clips: Iterable<ClipDefinition<unknown>> = []): ClipRuntime {
  const clipMap = new Map<string, ClipDefinition<unknown>>();
  for (const clip of clips) {
    if (clipMap.has(clip.kind)) {
      throw new Error(
        `createLottieRuntime: duplicate clip kind '${clip.kind}' — each kind must be unique within the runtime`,
      );
    }
    clipMap.set(clip.kind, clip);
  }
  return {
    id: 'lottie',
    tier: 'live',
    clips: clipMap,
  };
}

export { lottieLogo } from './clips/lottie-logo.js';
export {
  LottiePlayer as LottiePlayerComponent,
  type LottiePlayerProps,
  lottiePlayer,
  lottiePlayerPropsSchema,
} from './clips/lottie-player.js';
export { LottieClipHost } from './host.js';
