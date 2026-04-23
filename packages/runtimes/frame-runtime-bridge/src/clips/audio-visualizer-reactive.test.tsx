// packages/runtimes/frame-runtime-bridge/src/clips/audio-visualizer-reactive.test.tsx
// T-131e.2 — audioVisualizerReactiveClip behaviour + propsSchema + themeSlots.
// Web Audio is mocked via a stub AudioContext factory so tests run under
// happy-dom (which has no AudioContext).

import { FrameProvider } from '@stageflip/frame-runtime';
import { resolveClipDefaultsForTheme } from '@stageflip/runtimes-contract';
import type { Theme } from '@stageflip/schema';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AudioVisualizerReactive,
  type AudioVisualizerReactiveProps,
  audioVisualizerReactiveClip,
  audioVisualizerReactivePropsSchema,
  frequencyToBars,
} from './audio-visualizer-reactive.js';

afterEach(() => {
  cleanup();
  // Clean up the global stub so it does not leak across test files in
  // a shared Vitest worker. See the matching `beforeEach` below.
  // biome-ignore lint/suspicious/noExplicitAny: test shim — globalThis is untyped here.
  (globalThis as any).AudioContext = undefined;
});

// happy-dom does not ship AudioContext — stub it so the visualizer hook
// does not throw when the clip mounts. We don't assert analyser behaviour
// here (the hook's own tests cover that); we just verify the clip wires
// itself correctly.
beforeEach(() => {
  const stubAnalyser = {
    fftSize: 256,
    smoothingTimeConstant: 0.8,
    frequencyBinCount: 128,
    connect: vi.fn(),
    disconnect: vi.fn(),
    getByteFrequencyData: vi.fn(),
    getByteTimeDomainData: vi.fn(),
  };
  const stubContext = {
    createAnalyser: vi.fn(() => stubAnalyser),
    createMediaElementSource: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() })),
    destination: {},
    close: vi.fn(() => Promise.resolve()),
  };
  // biome-ignore lint/suspicious/noExplicitAny: test shim for a globally-missing constructor under happy-dom.
  (globalThis as any).AudioContext = vi.fn(() => stubContext);
});

function renderAt(frame: number, props: AudioVisualizerReactiveProps, durationInFrames = 120) {
  return render(
    <FrameProvider frame={frame} config={{ width: 1920, height: 1080, fps: 30, durationInFrames }}>
      <AudioVisualizerReactive {...props} />
    </FrameProvider>,
  );
}

describe('AudioVisualizerReactive component (T-131e.2)', () => {
  it('mounts an <audio> element pointing at audioUrl', () => {
    const { container } = renderAt(0, { audioUrl: '/narration.mp3' });
    const audio = container.querySelector('audio');
    expect(audio).not.toBeNull();
    expect(audio?.getAttribute('src')).toBe('/narration.mp3');
  });

  it('defaults to the bars style and renders the bars container', () => {
    renderAt(15, { audioUrl: '/a.mp3' });
    expect(screen.getByTestId('audio-visualizer-bars')).toBeDefined();
  });

  it('switches to the wave style when style=wave', () => {
    renderAt(15, { audioUrl: '/a.mp3', style: 'wave' });
    expect(screen.getByTestId('audio-visualizer-wave')).toBeDefined();
  });

  it('switches to the circular style when style=circular', () => {
    renderAt(15, { audioUrl: '/a.mp3', style: 'circular' });
    expect(screen.getByTestId('audio-visualizer-circular')).toBeDefined();
  });

  it('fades in over frames 0..15 (opacity on the bars container)', () => {
    renderAt(0, { audioUrl: '/a.mp3' });
    const bars0 = screen.getByTestId('audio-visualizer-bars') as HTMLElement;
    expect(Number(bars0.style.opacity)).toBe(0);
    cleanup();
    renderAt(15, { audioUrl: '/a.mp3' });
    const bars1 = screen.getByTestId('audio-visualizer-bars') as HTMLElement;
    expect(Number(bars1.style.opacity)).toBe(1);
  });

  it('renders a title when supplied', () => {
    const { container } = renderAt(15, { audioUrl: '/a.mp3', title: 'Live' });
    // Title sits inside the viz container; assert by text content.
    expect(container.textContent).toContain('Live');
  });

  it('the <audio> element is hidden (non-display) so the bars are the only visible surface', () => {
    const { container } = renderAt(0, { audioUrl: '/a.mp3' });
    const audio = container.querySelector('audio') as HTMLAudioElement;
    // We don't assert any particular CSS impl — just that the <audio>
    // element is not laid out as a visible UI control. A minimal check
    // is that it has no controls attribute (default) or has style.display=none.
    expect(audio.controls).toBe(false);
  });
});

describe('frequencyToBars helper (T-131e.2)', () => {
  it('returns a flat 0.1 baseline when frequency is empty', () => {
    expect(frequencyToBars(new Uint8Array(0), 4)).toEqual([0.1, 0.1, 0.1, 0.1]);
  });

  it('returns a flat 0.1 baseline when every bin is zero (pre-first-analyser-tick)', () => {
    expect(frequencyToBars(new Uint8Array([0, 0, 0, 0]), 3)).toEqual([0.1, 0.1, 0.1]);
  });

  it('maps non-zero bins to normalised heights in [0.02, 1] with index averaging', () => {
    // Frequency bins: [0, 255, 128, 64]. With barCount=4 each bar picks
    // index Math.floor((i/4) * 4) = i → exact 1:1 mapping.
    // Output should be [0/255, 255/255, 128/255, 64/255] clamped to [0.02, 1].
    const bars = frequencyToBars(new Uint8Array([0, 255, 128, 64]), 4);
    expect(bars[0]).toBe(0.02); // 0 clamped up to 0.02
    expect(bars[1]).toBe(1);
    expect(bars[2]).toBeCloseTo(128 / 255, 5);
    expect(bars[3]).toBeCloseTo(64 / 255, 5);
  });

  it('downsamples when barCount < frequency.length', () => {
    // 8 bins, 4 bars → each bar reads index floor((i/4) * 8) = i*2.
    const freq = new Uint8Array([10, 0, 40, 0, 80, 0, 160, 0]);
    const bars = frequencyToBars(freq, 4);
    expect(bars.length).toBe(4);
    expect(bars[0]).toBeCloseTo(10 / 255, 5);
    expect(bars[1]).toBeCloseTo(40 / 255, 5);
    expect(bars[2]).toBeCloseTo(80 / 255, 5);
    expect(bars[3]).toBeCloseTo(160 / 255, 5);
  });

  it('upsamples when barCount > frequency.length (each source bin visited repeatedly)', () => {
    // 2 bins, 4 bars. Each bar reads index floor((i/4) * 2) = floor(i/2).
    const bars = frequencyToBars(new Uint8Array([64, 192]), 4);
    expect(bars.length).toBe(4);
    expect(bars[0]).toBeCloseTo(64 / 255, 5);
    expect(bars[1]).toBeCloseTo(64 / 255, 5);
    expect(bars[2]).toBeCloseTo(192 / 255, 5);
    expect(bars[3]).toBeCloseTo(192 / 255, 5);
  });
});

describe('audioVisualizerReactiveClip definition (T-131e.2)', () => {
  it("registers under kind 'audio-visualizer-reactive' with a propsSchema", () => {
    expect(audioVisualizerReactiveClip.kind).toBe('audio-visualizer-reactive');
    expect(audioVisualizerReactiveClip.propsSchema).toBe(audioVisualizerReactivePropsSchema);
  });

  it('declares themeSlots binding color → primary, background → background, titleColor → foreground', () => {
    expect(audioVisualizerReactiveClip.themeSlots).toEqual({
      color: { kind: 'palette', role: 'primary' },
      background: { kind: 'palette', role: 'background' },
      titleColor: { kind: 'palette', role: 'foreground' },
    });
  });

  it('font requirements are conditional on the title prop', () => {
    expect(audioVisualizerReactiveClip.fontRequirements?.({ audioUrl: '/a.mp3' }) ?? []).toEqual(
      [],
    );
    expect(
      audioVisualizerReactiveClip.fontRequirements?.({ audioUrl: '/a.mp3', title: 'Live' }) ?? [],
    ).toEqual([{ family: 'Plus Jakarta Sans', weight: 700 }]);
  });

  it('propsSchema requires audioUrl', () => {
    expect(audioVisualizerReactivePropsSchema.safeParse({}).success).toBe(false);
    expect(audioVisualizerReactivePropsSchema.safeParse({ audioUrl: '/a.mp3' }).success).toBe(true);
  });

  it('propsSchema rejects unknown style values', () => {
    expect(
      audioVisualizerReactivePropsSchema.safeParse({ audioUrl: '/a.mp3', style: 'bogus' }).success,
    ).toBe(false);
  });

  it('propsSchema rejects unknown props (strict mode)', () => {
    expect(
      audioVisualizerReactivePropsSchema.safeParse({ audioUrl: '/a.mp3', bogus: true }).success,
    ).toBe(false);
  });

  it('integrates with resolveClipDefaultsForTheme — palette swap re-flows color + background + title', () => {
    const theme: Theme = {
      palette: { primary: '#0072e5', background: '#080f15', foreground: '#ebf1fa' },
      tokens: {},
    };
    const out = resolveClipDefaultsForTheme(
      audioVisualizerReactiveClip as unknown as Parameters<
        typeof resolveClipDefaultsForTheme<AudioVisualizerReactiveProps>
      >[0],
      theme,
      { audioUrl: '/a.mp3' } as AudioVisualizerReactiveProps,
    );
    expect(out.color).toBe('#0072e5');
    expect(out.background).toBe('#080f15');
    expect(out.titleColor).toBe('#ebf1fa');
  });
});
