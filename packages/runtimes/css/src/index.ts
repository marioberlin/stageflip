// packages/runtimes/css/src/index.ts
// @stageflip/runtimes-css — the simplest concrete ClipRuntime. Renders
// static clips (no frame dependence) as CSS-styled React elements. Useful
// for solid fills, static backgrounds, simple text with no animation —
// anything that's purely a styled DOM element parameterised by props.
//
// This runtime's clips do NOT read `useCurrentFrame` or any other
// frame-runtime hook. If you need frame-driven state, use
// @stageflip/runtimes-frame-runtime-bridge instead.

import { type ReactElement, createElement } from 'react';

import type {
  ClipDefinition,
  ClipRenderContext,
  ClipRuntime,
  FontRequirement,
} from '@stageflip/runtimes-contract';

export interface DefineCssClipInput<P> {
  /** Globally unique clip kind identifier. */
  kind: string;
  /**
   * Pure render function. Receives clip props only — no frame, no fps, no
   * composition size. Return the React element for this clip.
   */
  render(props: P): ReactElement;
  /** Optional: declare fonts this clip needs (consumed by T-072 FontManager). */
  fontRequirements?(props: P): FontRequirement[];
}

/**
 * Adapt a pure-props render function into a ClipDefinition. The produced
 * definition handles the window gate ([clipFrom, clipFrom + duration))
 * internally; outside the window it returns `null` and the dispatcher
 * interprets that as "clip not mounted this frame."
 *
 * `P` is erased at the return site so the definition fits in a
 * `ClipDefinition<unknown>`-typed map without variance gymnastics.
 */
export function defineCssClip<P>(input: DefineCssClipInput<P>): ClipDefinition<unknown> {
  const def: ClipDefinition<P> = {
    kind: input.kind,
    render(ctx: ClipRenderContext<P>): ReactElement | null {
      const localFrame = ctx.frame - ctx.clipFrom;
      if (localFrame < 0 || localFrame >= ctx.clipDurationInFrames) {
        return null;
      }
      return input.render(ctx.props);
    },
  };
  if (input.fontRequirements !== undefined) {
    def.fontRequirements = input.fontRequirements;
  }
  return def as unknown as ClipDefinition<unknown>;
}

/**
 * Build the css ClipRuntime with the given clips. `id: 'css'`,
 * `tier: 'live'`. Duplicate kinds throw.
 */
export function createCssRuntime(clips: Iterable<ClipDefinition<unknown>> = []): ClipRuntime {
  const clipMap = new Map<string, ClipDefinition<unknown>>();
  for (const clip of clips) {
    if (clipMap.has(clip.kind)) {
      throw new Error(
        `createCssRuntime: duplicate clip kind '${clip.kind}' — each kind must be unique within the runtime`,
      );
    }
    clipMap.set(clip.kind, clip);
  }
  return {
    id: 'css',
    tier: 'live',
    clips: clipMap,
  };
}

// ---------------------------------------------------------------------------
// Demo clip — the canonical css-runtime clip that T-067 parity fixtures
// reference.
// ---------------------------------------------------------------------------

export interface SolidBackgroundProps {
  /** Any CSS color string (hex, rgb(), named, etc.). */
  color: string;
}

/**
 * Absolutely-positioned div that fills the clip area with a solid color.
 * Pure CSS, no animation — the canonical demonstration of the css runtime.
 */
export const solidBackgroundClip: ClipDefinition<unknown> = defineCssClip<SolidBackgroundProps>({
  kind: 'solid-background',
  render: ({ color }) =>
    createElement('div', {
      style: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: color,
      },
    }),
});
