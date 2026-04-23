// packages/runtimes/frame-runtime-bridge/src/clips/audio-visualizer.tsx
// T-131f.1 port of reference/slidemotion/.../clips/audio-visualizer.tsx
// (simulated path only).
//
// The reference clip has two execution paths:
//   1. SimulatedVisualizer — pseudo-random bar heights derived from
//      sin/cos over composition time. No real audio. Bridge-eligible.
//   2. AudioVisualizerReactive — lazy-loaded variant that plays a real
//      audio source via Remotion's <Audio> component and reads FFT data
//      via @remotion/media-utils. Forbidden per CLAUDE.md §3.
//
// This port ships only path 1. Real-audio reactivity is deferred to a
// future task once we have a non-Remotion <Audio> equivalent. The
// `audioSrc` prop is intentionally absent from this port's schema —
// callers who need it must wait for that follow-up.

import { interpolate, useCurrentFrame, useVideoConfig } from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

const visualizerStyleSchema = z.enum(['bars', 'wave', 'circular']);
export type VisualizerStyle = z.infer<typeof visualizerStyleSchema>;

export const audioVisualizerPropsSchema = z
  .object({
    barCount: z.number().int().positive().max(256).optional(),
    color: z.string().optional(),
    style: visualizerStyleSchema.optional(),
    title: z.string().optional(),
    background: z.string().optional(),
    titleColor: z.string().optional(),
  })
  .strict();

export type AudioVisualizerProps = z.infer<typeof audioVisualizerPropsSchema>;

const CANVAS_W = 1920;
const CANVAS_H = 1080;

export function AudioVisualizer({
  barCount = 32,
  color = '#0072e5',
  style = 'bars',
  title,
  background = '#080f15',
  titleColor = '#ebf1fa',
}: AudioVisualizerProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bars = generateBars(frame, fps, barCount);
  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      data-testid="audio-visualizer-clip"
      style={{ width: '100%', height: '100%', position: 'relative' }}
    >
      {style === 'circular' ? (
        <CircularViz
          bars={bars}
          barCount={barCount}
          color={color}
          title={title}
          fadeIn={fadeIn}
          background={background}
          titleColor={titleColor}
        />
      ) : style === 'wave' ? (
        <WaveViz
          bars={bars}
          barCount={barCount}
          color={color}
          title={title}
          fadeIn={fadeIn}
          background={background}
          titleColor={titleColor}
        />
      ) : (
        <BarsViz
          bars={bars}
          barCount={barCount}
          color={color}
          title={title}
          fadeIn={fadeIn}
          background={background}
          titleColor={titleColor}
        />
      )}
    </div>
  );
}

// Exported for test coverage of the deterministic-bar generator.
export function generateBars(frame: number, fps: number, barCount: number): number[] {
  return Array.from({ length: barCount }, (_, i) => {
    const t = frame / fps;
    const freq1 = Math.sin(t * 3.5 + i * 0.7) * 0.3;
    const freq2 = Math.sin(t * 5.2 + i * 1.3) * 0.25;
    const freq3 = Math.sin(t * 8.1 + i * 0.4) * 0.15;
    const bass = i < barCount * 0.2 ? 0.3 : 0;
    const treble = i > barCount * 0.7 ? 0.15 : 0;
    return Math.max(0.05, Math.min(1, 0.2 + bass - treble + freq1 + freq2 + freq3));
  });
}

export interface VizProps {
  bars: number[];
  barCount: number;
  color: string;
  // `string | undefined` (not `title?: string`) so spread-call sites can pass
  // a possibly-undefined value under exactOptionalPropertyTypes — `title?:`
  // would refuse the explicit `undefined` we get from destructuring.
  title: string | undefined;
  fadeIn: number;
  background: string;
  titleColor: string;
}

export function BarsViz({
  bars,
  barCount,
  color,
  title,
  fadeIn,
  background,
  titleColor,
}: VizProps): ReactElement {
  const barWidth = (CANVAS_W - 160) / barCount;
  const gap = barWidth * 0.2;
  return (
    <div
      data-testid="audio-visualizer-bars"
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: background,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: 80,
        opacity: fadeIn,
      }}
    >
      {title !== undefined && title.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 40,
            left: 80,
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 28,
            fontWeight: 700,
            color: titleColor,
          }}
        >
          {title}
        </div>
      )}
      {bars.map((val, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: positional bar slot — slot i is the same bar across renders.
          key={i}
          data-testid={`audio-visualizer-bar-${i}`}
          style={{
            width: barWidth - gap,
            height: `${val * 80}%`,
            backgroundColor: color,
            borderRadius: '4px 4px 0 0',
            marginRight: gap,
            opacity: 0.5 + val * 0.5,
          }}
        />
      ))}
    </div>
  );
}

export function WaveViz({
  bars,
  barCount,
  color,
  title,
  fadeIn,
  background,
  titleColor,
}: VizProps): ReactElement {
  const points = bars
    .map((val, i) => {
      // Guard against barCount === 1 (schema permits it). Without this,
      // `i / (barCount - 1)` divides by zero and produces NaN, which
      // breaks the SVG polyline.
      const x = barCount <= 1 ? CANVAS_W / 2 : (i / (barCount - 1)) * CANVAS_W;
      const y = CANVAS_H / 2 + (val - 0.5) * 600;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <div
      data-testid="audio-visualizer-wave"
      style={{ width: '100%', height: '100%', backgroundColor: background, opacity: fadeIn }}
    >
      {title !== undefined && title.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 40,
            left: 80,
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 28,
            fontWeight: 700,
            color: titleColor,
          }}
        >
          {title}
        </div>
      )}
      <svg
        width={CANVAS_W}
        height={CANVAS_H}
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        style={{ width: '100%', height: '100%' }}
        role="img"
        aria-label="audio waveform"
      >
        <title>audio waveform</title>
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinejoin="round"
        />
        <polyline points={`0,${CANVAS_H} ${points} ${CANVAS_W},${CANVAS_H}`} fill={`${color}20`} />
      </svg>
    </div>
  );
}

export function CircularViz({
  bars,
  barCount,
  color,
  title,
  fadeIn,
  background,
  titleColor,
}: VizProps): ReactElement {
  return (
    <div
      data-testid="audio-visualizer-circular"
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: fadeIn,
      }}
    >
      {title !== undefined && title.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 40,
            width: '100%',
            textAlign: 'center',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 28,
            fontWeight: 700,
            color: titleColor,
          }}
        >
          {title}
        </div>
      )}
      <svg
        width="800"
        height="800"
        viewBox="0 0 800 800"
        role="img"
        aria-label="audio circular visualization"
      >
        <title>audio circular visualization</title>
        {bars.map((val, i) => {
          const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;
          const innerR = 150;
          const outerR = innerR + val * 200;
          return (
            <line
              // biome-ignore lint/suspicious/noArrayIndexKey: positional bar slot — slot i is the same bar across renders.
              key={i}
              x1={400 + Math.cos(angle) * innerR}
              y1={400 + Math.sin(angle) * innerR}
              x2={400 + Math.cos(angle) * outerR}
              y2={400 + Math.sin(angle) * outerR}
              stroke={color}
              strokeWidth={8}
              strokeLinecap="round"
              opacity={0.6 + val * 0.4}
            />
          );
        })}
        <circle
          cx={400}
          cy={400}
          r={148}
          fill="none"
          stroke={color}
          strokeWidth={2}
          opacity={0.3}
        />
      </svg>
    </div>
  );
}

export const audioVisualizerClip: ClipDefinition<unknown> = defineFrameClip<AudioVisualizerProps>({
  kind: 'audio-visualizer',
  component: AudioVisualizer,
  propsSchema: audioVisualizerPropsSchema,
  themeSlots: {
    color: { kind: 'palette', role: 'primary' },
    background: { kind: 'palette', role: 'background' },
    titleColor: { kind: 'palette', role: 'foreground' },
  },
  fontRequirements: () => [{ family: 'Plus Jakarta Sans', weight: 700 }],
});
