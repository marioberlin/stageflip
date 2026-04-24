// packages/runtimes/frame-runtime-bridge/src/clips/hook-moment.tsx
// T-183b — "hook-moment" video-profile clip. The opening attention-grabber
// for a short-form ad: bold claim text flashes in with a quick zoom-out +
// brightness pulse, then holds while a supporting tagline slides up.
// Deterministic — every numeric is frame-derived.

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

export const hookMomentPropsSchema = z
  .object({
    claim: z.string(),
    supporting: z.string().optional(),
    /** Claim color. Defaults to theme palette.foreground. */
    color: z.string().optional(),
    /** Flash color at peak. Defaults to theme palette.accent. */
    flashColor: z.string().optional(),
    /** Background color. Defaults to theme palette.background. */
    background: z.string().optional(),
    /** Claim font size in px. Default 160. */
    fontSize: z.number().positive().optional(),
  })
  .strict();

export type HookMomentProps = z.infer<typeof hookMomentPropsSchema>;

const EASE_OUT_EXPO = cubicBezier(0.16, 1, 0.3, 1);

export function HookMoment({
  claim,
  supporting,
  color = '#f5f7fa',
  flashColor = '#5af8fb',
  background = '#080f15',
  fontSize = 160,
}: HookMomentProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const zoomEnd = Math.ceil(fps * 0.3);
  const flashPeak = Math.ceil(fps * 0.15);
  const flashEnd = Math.ceil(fps * 0.4);
  const supportingStart = Math.ceil(fps * 0.45);
  const supportingEnd = Math.ceil(fps * 0.9);

  const claimScale = interpolate(frame, [0, zoomEnd], [1.4, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT_EXPO,
  });
  const claimOpacity = interpolate(frame, [0, zoomEnd * 0.5], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT_EXPO,
  });
  const flashIntensity = interpolate(frame, [0, flashPeak, flashEnd], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT_EXPO,
  });

  const supportingY = interpolate(frame, [supportingStart, supportingEnd], [24, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT_EXPO,
  });
  const supportingOpacity = interpolate(frame, [supportingStart, supportingEnd], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT_EXPO,
  });

  return (
    <div
      data-testid="hook-moment-clip"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 36,
        background,
      }}
    >
      <div
        data-testid="hook-moment-claim"
        style={{
          transform: `scale(${claimScale})`,
          opacity: claimOpacity,
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontSize,
          fontWeight: 900,
          color,
          textAlign: 'center',
          letterSpacing: '-0.04em',
          lineHeight: 0.95,
          textShadow: `0 0 ${Math.round(flashIntensity * 48)}px ${flashColor}`,
        }}
      >
        {claim}
      </div>
      {supporting !== undefined && supporting.length > 0 ? (
        <div
          data-testid="hook-moment-supporting"
          style={{
            transform: `translateY(${supportingY}px)`,
            opacity: supportingOpacity,
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: Math.max(20, fontSize * 0.2),
            fontWeight: 500,
            color: flashColor,
            letterSpacing: '0.02em',
          }}
        >
          {supporting}
        </div>
      ) : null}
    </div>
  );
}

export const hookMomentClip: ClipDefinition<unknown> = defineFrameClip<HookMomentProps>({
  kind: 'hook-moment',
  component: HookMoment,
  propsSchema: hookMomentPropsSchema,
  themeSlots: {
    color: { kind: 'palette', role: 'foreground' },
    flashColor: { kind: 'palette', role: 'accent' },
    background: { kind: 'palette', role: 'background' },
  },
  fontRequirements: () => [
    { family: 'Plus Jakarta Sans', weight: 500 },
    { family: 'Plus Jakarta Sans', weight: 900 },
  ],
});
