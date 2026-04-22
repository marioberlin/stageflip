// packages/runtimes/frame-runtime-bridge/src/clips/logo-intro.tsx
// T-131b.1 port of reference/slidemotion/.../clips/logo-intro.tsx.
// Fade + scale-up entrance with an accent-coloured glow that crests then settles.

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

export const logoIntroPropsSchema = z
  .object({
    text: z.string(),
    color: z.string().optional(),
    glowColor: z.string().optional(),
    background: z.string().optional(),
    fontSize: z.number().positive().optional(),
  })
  .strict();

export type LogoIntroProps = z.infer<typeof logoIntroPropsSchema>;

const EASE_OUT_EXPO = cubicBezier(0.16, 1, 0.3, 1);

export function LogoIntro({
  text,
  color = '#0072e5',
  glowColor = '#5af8fb',
  // Reference clip uses AC.background (#080f15), the deepest tone in the
  // palette; the other ports use AC.canvas (#0c1116). themeSlots resolve
  // both to `palette.background` once a document theme is applied — the
  // hardcoded fallback here matches the reference for parity.
  background = '#080f15',
  fontSize = 72,
}: LogoIntroProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const fadeEnd = Math.ceil(fps * 0.8);
  const scaleEnd = Math.ceil(fps * 1);
  const glowPeak = Math.ceil(fps * 1.2);
  const opacity = interpolate(frame, [0, fadeEnd], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT_EXPO,
  });
  const scale = interpolate(frame, [0, scaleEnd], [0.8, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT_EXPO,
  });
  const glowIntensity = interpolate(
    frame,
    [Math.ceil(fps * 0.5), glowPeak, durationInFrames],
    [0, 30, 15],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  return (
    <div
      data-testid="logo-intro-clip"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: background,
      }}
    >
      <span
        style={{
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontSize,
          fontWeight: 800,
          color,
          opacity,
          transform: `scale(${scale})`,
          // 0x40 alpha on the wider halo matches the reference clip's
          // intent (a softer outer ring); literal hex preserves parity.
          textShadow: `0 0 ${glowIntensity}px ${glowColor}, 0 0 ${glowIntensity * 2}px ${glowColor}40`,
          letterSpacing: '-0.02em',
        }}
      >
        {text}
      </span>
    </div>
  );
}

export const logoIntroClip: ClipDefinition<unknown> = defineFrameClip<LogoIntroProps>({
  kind: 'logo-intro',
  component: LogoIntro,
  propsSchema: logoIntroPropsSchema,
  themeSlots: {
    color: { kind: 'palette', role: 'primary' },
    glowColor: { kind: 'palette', role: 'accent' },
    background: { kind: 'palette', role: 'background' },
  },
  fontRequirements: () => [{ family: 'Plus Jakarta Sans', weight: 800 }],
});
