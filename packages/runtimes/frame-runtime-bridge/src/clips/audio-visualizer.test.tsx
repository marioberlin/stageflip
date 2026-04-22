// packages/runtimes/frame-runtime-bridge/src/clips/audio-visualizer.test.tsx
// T-131f.1 — audioVisualizerClip behaviour + propsSchema + themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  AudioVisualizer,
  type AudioVisualizerProps,
  audioVisualizerClip,
  audioVisualizerPropsSchema,
  generateBars,
} from './audio-visualizer.js';

afterEach(cleanup);

function renderAt(frame: number, props: AudioVisualizerProps = {}, durationInFrames = 60) {
  return render(
    <FrameProvider frame={frame} config={{ width: 640, height: 360, fps: 30, durationInFrames }}>
      <AudioVisualizer {...props} />
    </FrameProvider>,
  );
}

describe('generateBars — deterministic pseudo-random bar heights (T-131f.1)', () => {
  it('produces `barCount` values, each clamped to [0.05, 1]', () => {
    const bars = generateBars(15, 30, 32);
    expect(bars.length).toBe(32);
    for (const v of bars) {
      expect(v).toBeGreaterThanOrEqual(0.05);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('is purely deterministic — identical inputs produce identical output', () => {
    const a = generateBars(42, 30, 16);
    const b = generateBars(42, 30, 16);
    expect(a).toEqual(b);
  });

  it('different frames produce different output (animated over time)', () => {
    const f0 = generateBars(0, 30, 16);
    const f30 = generateBars(30, 30, 16);
    expect(f0).not.toEqual(f30);
  });
});

describe('AudioVisualizer component (T-131f.1)', () => {
  it('defaults to bar style and renders 32 bars', () => {
    renderAt(30, {});
    expect(screen.getByTestId('audio-visualizer-bars')).toBeDefined();
    expect(screen.getByTestId('audio-visualizer-bar-0')).toBeDefined();
    expect(screen.getByTestId('audio-visualizer-bar-31')).toBeDefined();
    expect(screen.queryByTestId('audio-visualizer-bar-32')).toBeNull();
  });

  it('renders the wave variant when style="wave"', () => {
    renderAt(30, { style: 'wave' });
    expect(screen.getByTestId('audio-visualizer-wave')).toBeDefined();
    expect(screen.queryByTestId('audio-visualizer-bars')).toBeNull();
  });

  it('renders the circular variant when style="circular"', () => {
    renderAt(30, { style: 'circular' });
    expect(screen.getByTestId('audio-visualizer-circular')).toBeDefined();
  });

  it('respects the supplied barCount', () => {
    renderAt(30, { barCount: 8 });
    expect(screen.getByTestId('audio-visualizer-bar-7')).toBeDefined();
    expect(screen.queryByTestId('audio-visualizer-bar-8')).toBeNull();
  });

  it('wave variant renders without NaN coordinates when barCount === 1', () => {
    renderAt(30, { style: 'wave', barCount: 1 });
    const svg = screen.getByTestId('audio-visualizer-wave').querySelector('svg');
    const polyline = svg?.querySelector('polyline');
    const pointsAttr = polyline?.getAttribute('points') ?? '';
    expect(pointsAttr).not.toContain('NaN');
  });
});

describe('audioVisualizerClip definition (T-131f.1)', () => {
  it("registers under kind 'audio-visualizer' with three themeSlots", () => {
    expect(audioVisualizerClip.kind).toBe('audio-visualizer');
    expect(audioVisualizerClip.propsSchema).toBe(audioVisualizerPropsSchema);
    expect(audioVisualizerClip.themeSlots).toEqual({
      color: { kind: 'palette', role: 'primary' },
      background: { kind: 'palette', role: 'background' },
      titleColor: { kind: 'palette', role: 'foreground' },
    });
  });

  it('propsSchema rejects unknown style', () => {
    expect(audioVisualizerPropsSchema.safeParse({ style: 'fft' }).success).toBe(false);
  });

  it('propsSchema caps barCount at 256', () => {
    expect(audioVisualizerPropsSchema.safeParse({ barCount: 300 }).success).toBe(false);
    expect(audioVisualizerPropsSchema.safeParse({ barCount: 256 }).success).toBe(true);
  });

  it('schema does NOT accept `audioSrc` (real-audio path is deferred)', () => {
    expect(audioVisualizerPropsSchema.safeParse({ audioSrc: 'foo.mp3' }).success).toBe(false);
  });
});
