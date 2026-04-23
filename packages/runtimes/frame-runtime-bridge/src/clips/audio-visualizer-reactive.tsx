// packages/runtimes/frame-runtime-bridge/src/clips/audio-visualizer-reactive.tsx
// T-131e.2 port of reference/slidemotion/.../clips/audio-visualizer-reactive.tsx.
// The real-audio variant of T-131f.1's simulated audio-visualizer.
//
// Unlike its sibling, this clip requires an audioUrl and drives bar
// heights from a live Web Audio AnalyserNode (via
// `useAudioVisualizer`) attached to a native <audio> element kept in
// sync with the FrameClock (via `useMediaSync`). We bypass the
// <FrameAudio> wrapper because the hook contract needs a concrete ref
// — FrameAudio encapsulates its ref internally, which is the right
// choice for simple playback but not for analyser-driven visuals.
//
// Determinism: `useAudioVisualizer` reads the AnalyserNode at render
// time, which depends on how much audio the browser has decoded —
// wall-clock-driven. The hook is explicitly marked
// "editor / preview only". Deterministic export pre-decodes samples
// through the bake runtime (T-131e dispatcher work, tracked
// separately) and swaps in the baked visualization at capture time.

import {
  interpolate,
  useAudioVisualizer,
  useCurrentFrame,
  useMediaSync,
  useVideoConfig,
} from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import { type ReactElement, useRef } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';
import {
  BarsViz,
  CircularViz,
  type VisualizerStyle,
  type VizProps,
  WaveViz,
} from './audio-visualizer.js';

const visualizerStyleSchema: z.ZodType<VisualizerStyle> = z.enum(['bars', 'wave', 'circular']);

export const audioVisualizerReactivePropsSchema = z
  .object({
    audioUrl: z.string(),
    barCount: z.number().int().positive().max(256).optional(),
    color: z.string().optional(),
    style: visualizerStyleSchema.optional(),
    title: z.string().optional(),
    background: z.string().optional(),
    titleColor: z.string().optional(),
  })
  .strict();

export type AudioVisualizerReactiveProps = z.infer<typeof audioVisualizerReactivePropsSchema>;

export function AudioVisualizerReactive({
  audioUrl,
  barCount = 32,
  color = '#0072e5',
  style = 'bars',
  title,
  background = '#080f15',
  titleColor = '#ebf1fa',
}: AudioVisualizerReactiveProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const audioRef = useRef<HTMLAudioElement>(null);
  useMediaSync(audioRef);
  const { frequency } = useAudioVisualizer(audioRef);

  const bars = frequencyToBars(frequency, barCount);
  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const vizProps: VizProps = {
    bars,
    barCount,
    color,
    title,
    fadeIn,
    background,
    titleColor,
  };

  // Silence warnings about unused fps in strict builds while keeping the
  // import stable — the bake-path orchestrator reads fps off videoConfig
  // via its own code path.
  void fps;

  return (
    <div
      data-testid="audio-visualizer-reactive"
      style={{ width: '100%', height: '100%', position: 'relative' }}
    >
      {/* biome-ignore lint/a11y/useMediaCaption: narration audio ships caption markup at the deck level, not the clip level. */}
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="auto"
        style={{ position: 'absolute', width: 0, height: 0, opacity: 0 }}
      />

      {style === 'circular' ? (
        <CircularViz {...vizProps} />
      ) : style === 'wave' ? (
        <WaveViz {...vizProps} />
      ) : (
        <BarsViz {...vizProps} />
      )}
    </div>
  );
}

/**
 * Map a Uint8Array of FFT magnitudes (0..255) onto `barCount` normalised
 * bar heights in [0.02, 1]. Empty / all-zero input (hook mount before
 * first analyser tick) gets a flat 0.1 baseline so bars stay visible.
 */
function frequencyToBars(frequency: Uint8Array, barCount: number): number[] {
  if (frequency.length === 0) return new Array(barCount).fill(0.1);
  let hasSignal = false;
  for (let i = 0; i < frequency.length; i++) {
    if ((frequency[i] as number) > 0) {
      hasSignal = true;
      break;
    }
  }
  if (!hasSignal) return new Array(barCount).fill(0.1);
  const out: number[] = new Array(barCount);
  for (let i = 0; i < barCount; i++) {
    const idx = Math.floor((i / barCount) * frequency.length);
    const v = ((frequency[idx] as number) ?? 0) / 255;
    out[i] = Math.max(0.02, Math.min(1, v));
  }
  return out;
}

export const audioVisualizerReactiveClip: ClipDefinition<unknown> =
  defineFrameClip<AudioVisualizerReactiveProps>({
    kind: 'audio-visualizer-reactive',
    component: AudioVisualizerReactive,
    propsSchema: audioVisualizerReactivePropsSchema,
    themeSlots: {
      color: { kind: 'palette', role: 'primary' },
      background: { kind: 'palette', role: 'background' },
      titleColor: { kind: 'palette', role: 'foreground' },
    },
    fontRequirements: (props) =>
      props.title !== undefined ? [{ family: 'Plus Jakarta Sans', weight: 700 }] : [],
  });
