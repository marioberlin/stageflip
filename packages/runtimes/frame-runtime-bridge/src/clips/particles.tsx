// packages/runtimes/frame-runtime-bridge/src/clips/particles.tsx
// T-131d port of reference/slidemotion/.../clips/particles.tsx.
// Confetti / sparkles / snow / rain / bokeh effects driven by a seeded
// LCG — no Math.random, fully deterministic. Particle initial state is
// memoised on (seed, count, width, height, effectColors) so re-renders
// during a single composition don't re-roll the deck.

import {
  cubicBezier,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

const EASE_OUT_EXPO = cubicBezier(0.16, 1, 0.3, 1);

const particleStyleSchema = z.enum(['confetti', 'sparkles', 'snow', 'rain', 'bokeh']);
export type ParticleStyle = z.infer<typeof particleStyleSchema>;

export const particlesPropsSchema = z
  .object({
    style: particleStyleSchema.optional(),
    count: z.number().int().positive().max(500).optional(),
    color: z.string().optional(),
    colors: z.array(z.string()).optional(),
    background: z.string().optional(),
    intensity: z.number().min(0).max(1).optional(),
    seed: z.number().int().optional(),
  })
  .strict();

export type ParticlesProps = z.infer<typeof particlesPropsSchema>;

const DEFAULT_COLORS: Record<ParticleStyle, string[]> = {
  confetti: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6eb4', '#a855f7'],
  sparkles: ['#ffd700', '#fffacd', '#fff8dc', '#ffecb3'],
  snow: ['#ffffff', '#f0f8ff', '#e8f4fd'],
  rain: ['#81aeff', '#5af8fb', '#a5d8ff'],
  bokeh: ['#81aeff', '#5af8fb', '#ff6eb4', '#ffd93d', '#a855f7'],
};

interface ParticleState {
  x: number;
  y: number;
  size: number;
  speed: number;
  delay: number;
  rotation: number;
  rotSpeed: number;
  color: string;
  opacity: number;
  phase: number;
}

/**
 * Linear-congruential PRNG. Deterministic, unsigned-32 mantissa. Output
 * normalised to `[0, 1)` — divisor is `2 ** 32`, NOT `0xffffffff`. The
 * latter would let the output reach exactly `1.0` whenever the LCG state
 * lands on `0xffffffff`, which then makes downstream `Math.floor(r() * len)`
 * picks land at `len` (out-of-bounds). Reference clip has this bug; the
 * port fixes it.
 */
function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

export function Particles({
  style: particleStyle = 'confetti',
  count = 50,
  color,
  colors,
  background,
  intensity = 0.7,
  seed = 42,
}: ParticlesProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();

  // Resolve the colour palette *inside* the useMemo factory. Resolving
  // outside and keying on the resulting array would bust the memo every
  // render when the caller passes a single `color` prop — `[color]` is a
  // fresh array literal each render. With the resolution inside, only the
  // scalar inputs + the optional `colors[]` array drive invalidation.
  const particles = useMemo<ParticleState[]>(() => {
    const palette: readonly string[] =
      colors ?? (color !== undefined ? [color] : DEFAULT_COLORS[particleStyle]);
    const r = seededRandom(seed);
    return Array.from({ length: count }, () => {
      const colorIdx = Math.floor(r() * palette.length);
      return {
        x: r() * width,
        y: r() * height,
        size: 4 + r() * 12,
        speed: 0.5 + r() * 1.5,
        delay: r() * 30,
        rotation: r() * 360,
        rotSpeed: (r() - 0.5) * 6,
        color: palette[colorIdx] ?? palette[0] ?? '#ffffff',
        opacity: 0.4 + r() * 0.6,
        phase: r() * Math.PI * 2,
      };
    });
  }, [seed, count, width, height, color, colors, particleStyle]);

  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT_EXPO,
  });
  const fadeOut = interpolate(frame, [durationInFrames - 20, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const globalOpacity = fadeIn * fadeOut;

  return (
    <div
      data-testid="particles-clip"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        opacity: globalOpacity,
        backgroundColor: background ?? 'transparent',
        pointerEvents: 'none',
      }}
    >
      {particles.map((p, i) => {
        const adjustedFrame = Math.max(0, frame - p.delay);
        const t = adjustedFrame / fps;
        switch (particleStyle) {
          case 'confetti':
            return renderConfetti(p, t, i, intensity, height);
          case 'sparkles':
            return renderSparkle(p, t, i, intensity);
          case 'snow':
            return renderSnow(p, t, i, intensity, height);
          case 'rain':
            return renderRain(p, t, i, intensity, height);
          case 'bokeh':
            return renderBokeh(p, t, i, intensity);
          default:
            return null;
        }
      })}
    </div>
  );
}

function renderConfetti(
  p: ParticleState,
  t: number,
  i: number,
  intensity: number,
  h: number,
): ReactElement {
  const fallSpeed = 120 * p.speed * intensity;
  const y = -50 + ((t * fallSpeed) % (h + 100));
  const x = p.x + Math.sin(t * 2 + p.phase) * 40;
  const rot = p.rotation + t * p.rotSpeed * 180;
  const isCircle = i % 3 === 0;
  return (
    <div
      key={i}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: p.size,
        height: isCircle ? p.size : p.size * 0.6,
        backgroundColor: p.color,
        borderRadius: isCircle ? '50%' : 2,
        transform: `rotate(${rot}deg) rotateX(${rot * 0.5}deg)`,
        opacity: p.opacity,
      }}
    />
  );
}

function renderSparkle(p: ParticleState, t: number, i: number, intensity: number): ReactElement {
  const pulse = 0.3 + Math.abs(Math.sin(t * 3 + p.phase)) * 0.7;
  const scale = pulse * (0.5 + intensity * 0.5);
  return (
    <div
      key={i}
      style={{
        position: 'absolute',
        left: p.x,
        top: p.y,
        width: p.size,
        height: p.size,
        opacity: p.opacity * pulse,
        transform: `scale(${scale}) rotate(${t * 45}deg)`,
      }}
    >
      <svg viewBox="0 0 24 24" width={p.size} height={p.size} role="img" aria-label="sparkle">
        <title>sparkle</title>
        <path d="M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10Z" fill={p.color} />
      </svg>
    </div>
  );
}

function renderSnow(
  p: ParticleState,
  t: number,
  i: number,
  intensity: number,
  h: number,
): ReactElement {
  const fallSpeed = 40 * p.speed * intensity;
  const y = -20 + ((t * fallSpeed) % (h + 40));
  const x = p.x + Math.sin(t * 0.8 + p.phase) * 30;
  const wobble = Math.sin(t * 1.5 + p.phase) * 0.2;
  return (
    <div
      key={i}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: p.size * 0.5,
        height: p.size * 0.5,
        borderRadius: '50%',
        backgroundColor: p.color,
        opacity: p.opacity * 0.8,
        transform: `scale(${1 + wobble})`,
        filter: `blur(${p.size > 10 ? 1 : 0}px)`,
      }}
    />
  );
}

function renderRain(
  p: ParticleState,
  t: number,
  i: number,
  intensity: number,
  h: number,
): ReactElement {
  const fallSpeed = 300 * p.speed * intensity;
  const y = -20 + ((t * fallSpeed) % (h + 40));
  return (
    <div
      key={i}
      style={{
        position: 'absolute',
        left: p.x,
        top: y,
        width: 2,
        height: p.size * 2,
        backgroundColor: p.color,
        opacity: p.opacity * 0.4,
        borderRadius: 1,
        transform: 'rotate(15deg)',
      }}
    />
  );
}

function renderBokeh(p: ParticleState, t: number, i: number, _intensity: number): ReactElement {
  const pulse = 0.7 + Math.sin(t * 0.5 + p.phase) * 0.3;
  const drift = Math.sin(t * 0.2 + p.phase) * 20;
  return (
    <div
      key={i}
      style={{
        position: 'absolute',
        left: p.x + drift,
        top: p.y + drift * 0.5,
        width: p.size * 3,
        height: p.size * 3,
        borderRadius: '50%',
        backgroundColor: p.color,
        opacity: p.opacity * pulse * 0.2,
        filter: `blur(${p.size * 0.8}px)`,
        transform: `scale(${pulse})`,
      }}
    />
  );
}

export const particlesClip: ClipDefinition<unknown> = defineFrameClip<ParticlesProps>({
  kind: 'particles',
  component: Particles,
  propsSchema: particlesPropsSchema,
  // No themeSlots — particle palettes are deliberately style-driven (snow
  // is white, sparkles are gold, etc.). Callers that want palette-tied
  // colours pass `color` or `colors` explicitly.
});
