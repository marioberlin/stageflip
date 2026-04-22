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
import { z } from 'zod';

import type {
  ClipDefinition,
  ClipRenderContext,
  ClipRuntime,
  FontRequirement,
  ThemeSlot,
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
  /**
   * Optional Zod schema (T-125b). When declared, the editor's `<ZodForm>`
   * auto-inspects the clip's props.
   */
  propsSchema?: z.ZodType<P>;
  /**
   * Optional theme-slot map (T-131a). Keys are clip prop names; values
   * declare which theme slot to fall back to when the prop is `undefined`.
   * Resolved per-render via
   * `resolveClipDefaultsForTheme` from `@stageflip/runtimes-contract`.
   */
  themeSlots?: Readonly<Record<string, ThemeSlot>>;
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
  if (input.propsSchema !== undefined) {
    (def as { propsSchema?: z.ZodType<P> }).propsSchema = input.propsSchema;
  }
  if (input.themeSlots !== undefined) {
    (def as { themeSlots?: Readonly<Record<string, ThemeSlot>> }).themeSlots = input.themeSlots;
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
// Demo clips — canonical css-runtime clips referenced by parity fixtures.
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

// ---------------------------------------------------------------------------
// gradient-background (T-131a) — second demo clip wired with themeSlots,
// propsSchema, and the parity-fixture pipeline. Two color stops with optional
// direction. `from` / `to` default to the document theme's
// primary / background palette roles when omitted.
// ---------------------------------------------------------------------------

const gradientDirectionSchema = z.enum(['horizontal', 'vertical', 'diagonal']);

/**
 * `direction` is required (no `.default()`) because a Zod `.default` would
 * widen the schema's input type past `P`, breaking the bidirectional
 * `ZodType<P>` contract on `ClipDefinition.propsSchema`. UI layers that
 * want an implicit default should set it at the form level, not the
 * schema level.
 */
export const gradientBackgroundPropsSchema = z
  .object({
    from: z.string().optional(),
    to: z.string().optional(),
    direction: gradientDirectionSchema,
  })
  .strict();

export type GradientBackgroundProps = z.infer<typeof gradientBackgroundPropsSchema>;

const GRADIENT_DIRECTIONS: Readonly<Record<z.infer<typeof gradientDirectionSchema>, string>> = {
  horizontal: 'to right',
  vertical: 'to bottom',
  diagonal: 'to bottom right',
};

const GRADIENT_FALLBACK_FROM = '#0c1116';
const GRADIENT_FALLBACK_TO = '#ffffff';

/**
 * Linear two-stop gradient that fills the clip area. `from` and `to` declare
 * theme-slot fallbacks (`palette.primary` and `palette.background`) so a
 * theme swap re-flows the gradient when the document omits explicit values.
 */
export const gradientBackgroundClip: ClipDefinition<unknown> =
  defineCssClip<GradientBackgroundProps>({
    kind: 'gradient-background',
    propsSchema: gradientBackgroundPropsSchema,
    themeSlots: {
      from: { kind: 'palette', role: 'primary' },
      to: { kind: 'palette', role: 'background' },
    },
    render: ({ from, to, direction }) =>
      createElement('div', {
        style: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `linear-gradient(${GRADIENT_DIRECTIONS[direction]}, ${from ?? GRADIENT_FALLBACK_FROM}, ${to ?? GRADIENT_FALLBACK_TO})`,
        },
      }),
  });
