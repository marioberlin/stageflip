// packages/runtimes/frame-runtime-bridge/src/clips/endslate-logo.tsx
// T-183 — "endslate-logo" video-profile clip. The closing brand card:
// centered logo wordmark + optional tagline that fade + scale in,
// hold, and fade out. Deterministic: all motion is frame-derived.

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

export const endslateLogoPropsSchema = z
  .object({
    brand: z.string(),
    tagline: z.string().optional(),
    /** Brand wordmark color. Defaults to theme palette.primary. */
    color: z.string().optional(),
    /** Card background. Defaults to theme palette.background. */
    background: z.string().optional(),
    /** Tagline color. Defaults to theme palette.foreground. */
    taglineColor: z.string().optional(),
    /** Wordmark font size in px. Default 112. */
    fontSize: z.number().positive().optional(),
  })
  .strict();

export type EndslateLogoProps = z.infer<typeof endslateLogoPropsSchema>;

const EASE_OUT_EXPO = cubicBezier(0.16, 1, 0.3, 1);
const EASE_IN_EXPO = cubicBezier(0.7, 0, 0.84, 0);

export function EndslateLogo({
  brand,
  tagline,
  color = '#0072e5',
  background = '#080f15',
  taglineColor = '#c7cdd6',
  fontSize = 112,
}: EndslateLogoProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enterEnd = Math.ceil(fps * 0.8);
  const exitStart = Math.max(enterEnd + 1, durationInFrames - Math.ceil(fps * 0.4));

  const enterOpacity = interpolate(frame, [0, enterEnd], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT_EXPO,
  });
  const exitOpacity = interpolate(frame, [exitStart, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_IN_EXPO,
  });
  const opacity = frame < exitStart ? enterOpacity : exitOpacity;

  const scale = interpolate(frame, [0, enterEnd], [0.92, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT_EXPO,
  });

  return (
    <div
      data-testid="endslate-logo-clip"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background,
        opacity,
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontSize,
          fontWeight: 800,
          color,
          letterSpacing: '-0.03em',
          lineHeight: 1,
        }}
      >
        {brand}
      </div>
      {tagline !== undefined && tagline.length > 0 ? (
        <div
          data-testid="endslate-logo-tagline"
          style={{
            marginTop: 24,
            transform: `scale(${scale})`,
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: Math.max(16, fontSize * 0.24),
            fontWeight: 500,
            color: taglineColor,
            letterSpacing: '0.02em',
          }}
        >
          {tagline}
        </div>
      ) : null}
    </div>
  );
}

export const endslateLogoClip: ClipDefinition<unknown> = defineFrameClip<EndslateLogoProps>({
  kind: 'endslate-logo',
  component: EndslateLogo,
  propsSchema: endslateLogoPropsSchema,
  themeSlots: {
    color: { kind: 'palette', role: 'primary' },
    background: { kind: 'palette', role: 'background' },
    taglineColor: { kind: 'palette', role: 'foreground' },
  },
  fontRequirements: () => [
    { family: 'Plus Jakarta Sans', weight: 500 },
    { family: 'Plus Jakarta Sans', weight: 800 },
  ],
});
