// packages/runtimes/frame-runtime-bridge/src/clips/light-leak.tsx
// T-131b.2 port of reference/slidemotion/.../clips/light-leak.tsx.
// Cinematic transition overlay — three blurred radial-gradient blobs
// animated via seeded sin/cos over composition time.

import { interpolate, useCurrentFrame, useVideoConfig } from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

export const lightLeakPropsSchema = z
  .object({
    color1: z.string().optional(),
    color2: z.string().optional(),
    color3: z.string().optional(),
    intensity: z.number().min(0).max(1).optional(),
    seed: z.number().optional(),
  })
  .strict();

export type LightLeakProps = z.infer<typeof lightLeakPropsSchema>;

// The inline SVG-grain texture is preserved from the reference; it's pure
// data, deterministic, and `check-determinism` doesn't flag Math.sin/cos
// (only Math.random is banned — verified against scripts/check-determinism.ts).
const GRAIN_SVG =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E\")";

export function LightLeak({
  color1 = '#ff6b35',
  color2 = '#ffd700',
  color3 = '#ff1493',
  intensity = 0.7,
  seed = 42,
}: LightLeakProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const midpoint = durationInFrames / 2;
  const globalOpacity = interpolate(
    frame,
    [0, midpoint * 0.3, midpoint, midpoint + midpoint * 0.7, durationInFrames],
    [0, intensity, intensity, intensity, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const t = frame / fps;
  const seededOffset = seed * 0.1;

  const blob1X = 30 + Math.sin(t * 0.8 + seededOffset) * 25;
  const blob1Y = 40 + Math.cos(t * 0.6 + seededOffset) * 20;
  const blob1Scale = 1 + Math.sin(t * 1.2) * 0.3;

  const blob2X = 70 + Math.cos(t * 0.5 + seededOffset + 1) * 20;
  const blob2Y = 30 + Math.sin(t * 0.7 + seededOffset + 2) * 25;
  const blob2Scale = 1.2 + Math.cos(t * 0.9) * 0.4;

  const blob3X = 50 + Math.sin(t * 0.9 + seededOffset + 3) * 30;
  const blob3Y = 60 + Math.cos(t * 0.4 + seededOffset + 1) * 20;
  const blob3Scale = 0.8 + Math.sin(t * 1.5) * 0.3;

  return (
    <div
      data-testid="light-leak-clip"
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        opacity: globalOpacity,
        mixBlendMode: 'screen',
      }}
    >
      <div
        data-testid="light-leak-blob-1"
        style={{
          position: 'absolute',
          left: `${blob1X}%`,
          top: `${blob1Y}%`,
          width: 600 * blob1Scale,
          height: 600 * blob1Scale,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${color1}80 0%, ${color1}00 70%)`,
          transform: 'translate(-50%, -50%)',
          filter: 'blur(60px)',
        }}
      />
      <div
        data-testid="light-leak-blob-2"
        style={{
          position: 'absolute',
          left: `${blob2X}%`,
          top: `${blob2Y}%`,
          width: 500 * blob2Scale,
          height: 500 * blob2Scale,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${color2}80 0%, ${color2}00 70%)`,
          transform: 'translate(-50%, -50%)',
          filter: 'blur(80px)',
        }}
      />
      <div
        data-testid="light-leak-blob-3"
        style={{
          position: 'absolute',
          left: `${blob3X}%`,
          top: `${blob3Y}%`,
          width: 400 * blob3Scale,
          height: 400 * blob3Scale,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${color3}60 0%, ${color3}00 70%)`,
          transform: 'translate(-50%, -50%)',
          filter: 'blur(100px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: GRAIN_SVG,
          mixBlendMode: 'overlay',
          opacity: 0.3,
        }}
      />
    </div>
  );
}

// No themeSlots — light-leak is a special-effect overlay whose colours are
// deliberately off-palette (warm film tones). Callers swap colours via
// props; themes don't drive this clip.
export const lightLeakClip: ClipDefinition<unknown> = defineFrameClip<LightLeakProps>({
  kind: 'light-leak',
  component: LightLeak,
  propsSchema: lightLeakPropsSchema,
});
