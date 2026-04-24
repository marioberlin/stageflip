// packages/runtimes/frame-runtime-bridge/src/clips/lower-third.tsx
// T-183 — "lower-third" video-profile clip. A name/title chyron that
// slides in from the left, holds, and slides out to the right. Used as
// the introductory card for speakers, interview subjects, and captioned
// brand overlays.
//
// Deterministic: every numeric is derived from `useCurrentFrame` +
// `useVideoConfig`. No Date.now, no Math.random, no timers.

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

export const lowerThirdPropsSchema = z
  .object({
    name: z.string(),
    title: z.string().optional(),
    /** Accent bar + title color. Defaults to theme palette.primary. */
    accent: z.string().optional(),
    /** Card background color. Defaults to theme palette.background. */
    background: z.string().optional(),
    /** Primary name color. Defaults to theme palette.foreground. */
    textColor: z.string().optional(),
    /** Horizontal offset from the viewport's left edge, in px. Default 96. */
    insetLeftPx: z.number().nonnegative().optional(),
    /** Distance from the viewport bottom, in px. Default 96. */
    insetBottomPx: z.number().nonnegative().optional(),
  })
  .strict();

export type LowerThirdProps = z.infer<typeof lowerThirdPropsSchema>;

const EASE_OUT_QUART = cubicBezier(0.25, 1, 0.5, 1);
const EASE_IN_QUART = cubicBezier(0.5, 0, 0.75, 0);

export function LowerThird({
  name,
  title,
  accent = '#0072e5',
  background = '#080f15',
  textColor = '#f5f7fa',
  insetLeftPx = 96,
  insetBottomPx = 96,
}: LowerThirdProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const enterEnd = Math.ceil(fps * 0.45);
  const exitStart = Math.max(enterEnd + 1, durationInFrames - Math.ceil(fps * 0.35));

  const enterX = interpolate(frame, [0, enterEnd], [-100, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT_QUART,
  });
  const exitX = interpolate(frame, [exitStart, durationInFrames], [0, 120], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_IN_QUART,
  });
  const translatePct = enterX + exitX;
  const opacity =
    frame < enterEnd
      ? interpolate(frame, [0, enterEnd], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: EASE_OUT_QUART,
        })
      : interpolate(frame, [exitStart, durationInFrames], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: EASE_IN_QUART,
        });

  return (
    <div
      data-testid="lower-third-clip"
      style={{
        position: 'absolute',
        left: insetLeftPx,
        bottom: insetBottomPx,
        transform: `translateX(${translatePct}%)`,
        opacity,
        display: 'flex',
        alignItems: 'stretch',
        gap: 16,
      }}
    >
      <span
        data-testid="lower-third-accent"
        style={{ width: 6, background: accent, borderRadius: 3 }}
      />
      <div
        style={{
          background,
          padding: '12px 20px',
          borderRadius: 6,
          minWidth: 240,
          boxShadow: '0 8px 24px rgba(0,0,0,0.24)',
        }}
      >
        <div
          style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontWeight: 700,
            fontSize: 34,
            color: textColor,
            letterSpacing: '-0.015em',
          }}
        >
          {name}
        </div>
        {title !== undefined && title.length > 0 ? (
          <div
            data-testid="lower-third-title"
            style={{
              marginTop: 4,
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontWeight: 500,
              fontSize: 18,
              color: accent,
              letterSpacing: '0.02em',
            }}
          >
            {title}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export const lowerThirdClip: ClipDefinition<unknown> = defineFrameClip<LowerThirdProps>({
  kind: 'lower-third',
  component: LowerThird,
  propsSchema: lowerThirdPropsSchema,
  themeSlots: {
    accent: { kind: 'palette', role: 'primary' },
    background: { kind: 'palette', role: 'background' },
    textColor: { kind: 'palette', role: 'foreground' },
  },
  fontRequirements: () => [
    { family: 'Plus Jakarta Sans', weight: 500 },
    { family: 'Plus Jakarta Sans', weight: 700 },
  ],
});
