// packages/runtimes/frame-runtime-bridge/src/clips/price-reveal.tsx
// T-202 — "price-reveal" display-profile clip. Shows an old price
// (struck-through) at the start, then the new price slides up with a
// scale pop at the midpoint. Used for sale banners ("Was $99 / Now $79").
//
// Determinism: every numeric derives from `useCurrentFrame` +
// `useVideoConfig`. No `Date.now`, no `Math.random`, no timers.

import {
  cubicBezier,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

export const priceRevealPropsSchema = z
  .object({
    /** Old / struck-through price ("$99", "€129,00"). */
    oldPrice: z.string().min(1),
    /** New / sale price ("$79"). */
    newPrice: z.string().min(1),
    /** Label above the old price. Defaults to "Was". Pass `''` to hide. */
    oldLabel: z.string().optional(),
    /** Label above the new price. Defaults to "Now". Pass `''` to hide. */
    newLabel: z.string().optional(),
    /** New-price accent colour. Defaults to theme primary. */
    accent: z.string().optional(),
    /** Old-price colour + strike-through. Defaults to muted grey. */
    strikeColor: z.string().optional(),
    /** Label / old-price text colour. Defaults to theme foreground. */
    textColor: z.string().optional(),
    /** Card background. Defaults to theme background. */
    background: z.string().optional(),
  })
  .strict();

export type PriceRevealProps = z.infer<typeof priceRevealPropsSchema>;

const EASE_OUT_EXPO = cubicBezier(0.16, 1, 0.3, 1);
const EASE_IN_QUART = cubicBezier(0.5, 0, 0.75, 0);

export function PriceReveal({
  oldPrice,
  newPrice,
  oldLabel = 'Was',
  newLabel = 'Now',
  accent = '#0072e5',
  strikeColor = '#8590a0',
  textColor = '#080f15',
  background = '#ffffff',
}: PriceRevealProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Old price appears for the first ~45% of the clip, then fades out as
  // the new price slides in for the remaining ~55%.
  const oldFadeOutStart = Math.ceil(durationInFrames * 0.4);
  const oldFadeOutEnd = Math.ceil(durationInFrames * 0.55);
  const newEnterStart = Math.ceil(durationInFrames * 0.45);
  const newEnterEnd = Math.min(newEnterStart + Math.ceil(fps * 0.6), durationInFrames);

  const oldOpacity =
    frame < oldFadeOutStart
      ? 1
      : interpolate(frame, [oldFadeOutStart, oldFadeOutEnd], [1, 0.35], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: EASE_IN_QUART,
        });

  const newY = interpolate(frame, [newEnterStart, newEnterEnd], [40, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT_EXPO,
  });
  const newScale = interpolate(frame, [newEnterStart, newEnterEnd], [0.82, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT_EXPO,
  });
  const newOpacity = interpolate(frame, [newEnterStart, newEnterEnd], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT_EXPO,
  });

  return (
    <div
      data-testid="price-reveal-clip"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 48,
        background,
        padding: 24,
      }}
    >
      <div
        data-testid="price-reveal-old"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          opacity: oldOpacity,
        }}
      >
        {oldLabel.length > 0 ? (
          <div
            data-testid="price-reveal-old-label"
            style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontWeight: 500,
              fontSize: 13,
              color: textColor,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            {oldLabel}
          </div>
        ) : null}
        <div
          data-testid="price-reveal-old-value"
          style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontWeight: 600,
            fontSize: 32,
            color: strikeColor,
            textDecoration: 'line-through',
            textDecorationThickness: 2,
          }}
        >
          {oldPrice}
        </div>
      </div>
      <div
        data-testid="price-reveal-new"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          transform: `translateY(${newY}px) scale(${newScale.toFixed(4)})`,
          opacity: newOpacity,
          transformOrigin: 'center',
        }}
      >
        {newLabel.length > 0 ? (
          <div
            data-testid="price-reveal-new-label"
            style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontWeight: 500,
              fontSize: 13,
              color: textColor,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            {newLabel}
          </div>
        ) : null}
        <div
          data-testid="price-reveal-new-value"
          style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontWeight: 800,
            fontSize: 52,
            color: accent,
            letterSpacing: '-0.02em',
          }}
        >
          {newPrice}
        </div>
      </div>
    </div>
  );
}

export const priceRevealClip: ClipDefinition<unknown> = defineFrameClip<PriceRevealProps>({
  kind: 'price-reveal',
  component: PriceReveal,
  propsSchema: priceRevealPropsSchema,
  themeSlots: {
    accent: { kind: 'palette', role: 'primary' },
    textColor: { kind: 'palette', role: 'foreground' },
    background: { kind: 'palette', role: 'background' },
  },
  fontRequirements: () => [
    { family: 'Plus Jakarta Sans', weight: 500 },
    { family: 'Plus Jakarta Sans', weight: 600 },
    { family: 'Plus Jakarta Sans', weight: 800 },
  ],
});
