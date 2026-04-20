// packages/frame-runtime/src/use-audio-visualizer.test.tsx
// Unit tests for useAudioVisualizer(). Uses fake AudioContext / AnalyserNode
// stubs injected through the hook's `audioContextFactory` option.

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FrameProvider, type VideoConfig } from './frame-context.js';
import { type AudioVisualizerSnapshot, useAudioVisualizer } from './use-audio-visualizer.js';

afterEach(cleanup);

const CONFIG: VideoConfig = {
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 300,
};

interface FakeAnalyser {
  fftSize: number;
  smoothingTimeConstant: number;
  frequencyBinCount: number;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  getByteFrequencyData: ReturnType<typeof vi.fn>;
  getByteTimeDomainData: ReturnType<typeof vi.fn>;
}

interface FakeSource {
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

interface FakeContext {
  destination: Record<string, never>;
  createMediaElementSource: ReturnType<typeof vi.fn>;
  createAnalyser: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  _analyser?: FakeAnalyser;
  _source?: FakeSource;
}

function makeContext(
  opts: {
    fillWaveform?: (buf: Uint8Array) => void;
    fillFrequency?: (buf: Uint8Array) => void;
  } = {},
): FakeContext {
  const analyser: FakeAnalyser = {
    fftSize: 2048,
    smoothingTimeConstant: 0.8,
    get frequencyBinCount() {
      return this.fftSize / 2;
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
    getByteFrequencyData: vi.fn((buf: Uint8Array) => {
      if (opts.fillFrequency) opts.fillFrequency(buf);
    }),
    getByteTimeDomainData: vi.fn((buf: Uint8Array) => {
      if (opts.fillWaveform) opts.fillWaveform(buf);
    }),
  };
  const source: FakeSource = { connect: vi.fn(), disconnect: vi.fn() };
  const ctx: FakeContext = {
    destination: {},
    createMediaElementSource: vi.fn(() => source),
    createAnalyser: vi.fn(() => analyser),
    close: vi.fn(),
    _analyser: analyser,
    _source: source,
  };
  return ctx;
}

interface Harness {
  snapshot: AudioVisualizerSnapshot | null;
}

function renderWithFrame(
  ctx: FakeContext,
  initialFrame: number,
  options: Parameters<typeof useAudioVisualizer>[1] = {},
): { harness: Harness; rerender: (frame: number) => void } {
  const el = {} as HTMLMediaElement;
  const ref = { current: el };
  const harness: Harness = { snapshot: null };

  function Probe({ frame }: { frame: number }): React.ReactNode {
    const snap = useAudioVisualizer(ref, {
      ...options,
      audioContextFactory: () => ctx as unknown as AudioContext,
    });
    harness.snapshot = snap;
    return <span data-testid="f">{frame}</span>;
  }

  function Wrapper({ frame }: { frame: number }): React.ReactNode {
    return (
      <FrameProvider frame={frame} config={CONFIG}>
        <Probe frame={frame} />
      </FrameProvider>
    );
  }

  const { rerender } = render(<Wrapper frame={initialFrame} />);
  return {
    harness,
    rerender: (frame) => rerender(<Wrapper frame={frame} />),
  };
}

describe('useAudioVisualizer — lifecycle', () => {
  it('creates AudioContext + AnalyserNode + MediaElementSource on mount', () => {
    const ctx = makeContext();
    renderWithFrame(ctx, 0);
    expect(ctx.createMediaElementSource).toHaveBeenCalledTimes(1);
    expect(ctx.createAnalyser).toHaveBeenCalledTimes(1);
    expect(ctx._source?.connect).toHaveBeenCalledWith(ctx._analyser);
    expect(ctx._analyser?.connect).toHaveBeenCalledWith(ctx.destination);
  });

  it('closes the AudioContext on unmount', () => {
    const ctx = makeContext();
    const { harness } = renderWithFrame(ctx, 0);
    expect(harness.snapshot).not.toBeNull();
    cleanup();
    expect(ctx.close).toHaveBeenCalledTimes(1);
    expect(ctx._analyser?.disconnect).toHaveBeenCalled();
    expect(ctx._source?.disconnect).toHaveBeenCalled();
  });

  it('does nothing when the ref is null', () => {
    function Probe(): React.ReactNode {
      const ref = { current: null };
      useAudioVisualizer(ref, {
        audioContextFactory: () => {
          throw new Error('should not be called');
        },
      });
      return null;
    }
    expect(() =>
      render(
        <FrameProvider frame={0} config={CONFIG}>
          <Probe />
        </FrameProvider>,
      ),
    ).not.toThrow();
  });
});

describe('useAudioVisualizer — analyser configuration', () => {
  it('applies fftSize and smoothingTimeConstant from options', () => {
    const ctx = makeContext();
    renderWithFrame(ctx, 0, { fftSize: 512, smoothingTimeConstant: 0.5 });
    expect(ctx._analyser?.fftSize).toBe(512);
    expect(ctx._analyser?.smoothingTimeConstant).toBe(0.5);
  });

  it('defaults to fftSize=256 and smoothingTimeConstant=0.8', () => {
    const ctx = makeContext();
    renderWithFrame(ctx, 0);
    expect(ctx._analyser?.fftSize).toBe(256);
    expect(ctx._analyser?.smoothingTimeConstant).toBe(0.8);
  });
});

describe('useAudioVisualizer — snapshot shape', () => {
  it('returns Uint8Arrays sized to the fftSize', () => {
    const ctx = makeContext();
    const { harness, rerender } = renderWithFrame(ctx, 0, { fftSize: 512 });
    rerender(1); // advance past the mount effect so state is populated
    expect(harness.snapshot?.waveform).toBeInstanceOf(Uint8Array);
    expect(harness.snapshot?.waveform.length).toBe(512);
    expect(harness.snapshot?.frequency).toBeInstanceOf(Uint8Array);
    expect(harness.snapshot?.frequency.length).toBe(256);
  });

  it('volume is 0 for a flat waveform (center-biased 128s)', () => {
    const ctx = makeContext({
      fillWaveform: (buf) => buf.fill(128),
    });
    const { harness, rerender } = renderWithFrame(ctx, 0);
    rerender(1);
    expect(harness.snapshot?.volume).toBe(0);
  });

  it('volume is non-zero for non-flat waveform data', () => {
    const ctx = makeContext({
      fillWaveform: (buf) => {
        for (let i = 0; i < buf.length; i++) buf[i] = i % 2 === 0 ? 0 : 255;
      },
    });
    const { harness, rerender } = renderWithFrame(ctx, 0);
    rerender(1);
    expect(harness.snapshot?.volume).toBeGreaterThan(0);
    expect(harness.snapshot?.volume).toBeLessThanOrEqual(1);
  });

  it('first render (pre-effect) returns zeros sized to fftSize', () => {
    const ctx = makeContext();
    const { harness } = renderWithFrame(ctx, 0, { fftSize: 128 });
    // Pre-effect snapshot is the zero placeholder.
    expect(harness.snapshot?.waveform.length).toBe(128);
    expect(harness.snapshot?.frequency.length).toBe(64);
    expect(harness.snapshot?.volume).toBe(0);
  });

  it('reads fresh analyser data on every frame', () => {
    const ctx = makeContext();
    const { rerender } = renderWithFrame(ctx, 0);
    const before = ctx._analyser?.getByteFrequencyData.mock.calls.length ?? 0;
    rerender(1);
    rerender(2);
    rerender(3);
    const after = ctx._analyser?.getByteFrequencyData.mock.calls.length ?? 0;
    expect(after).toBeGreaterThan(before);
  });
});

describe('useAudioVisualizer — validation', () => {
  function renderWithOptions(options: Parameters<typeof useAudioVisualizer>[1]): void {
    const el = {} as HTMLMediaElement;
    const ref = { current: el };
    function Probe(): React.ReactNode {
      useAudioVisualizer(ref, options);
      return null;
    }
    render(
      <FrameProvider frame={0} config={CONFIG}>
        <Probe />
      </FrameProvider>,
    );
  }

  it('throws on non-power-of-two fftSize', () => {
    expect(() =>
      renderWithOptions({
        fftSize: 300,
        audioContextFactory: () => makeContext() as unknown as AudioContext,
      }),
    ).toThrow(/fftSize.*power of 2/);
  });

  it('throws on fftSize below the WebAudio floor', () => {
    expect(() =>
      renderWithOptions({
        fftSize: 16,
        audioContextFactory: () => makeContext() as unknown as AudioContext,
      }),
    ).toThrow(/fftSize.*32/);
  });

  it('throws on fftSize above the WebAudio ceiling', () => {
    expect(() =>
      renderWithOptions({
        fftSize: 65536,
        audioContextFactory: () => makeContext() as unknown as AudioContext,
      }),
    ).toThrow(/fftSize.*32768/);
  });

  it('throws on smoothingTimeConstant outside [0, 1]', () => {
    expect(() =>
      renderWithOptions({
        smoothingTimeConstant: -0.1,
        audioContextFactory: () => makeContext() as unknown as AudioContext,
      }),
    ).toThrow(/smoothing/);
    expect(() =>
      renderWithOptions({
        smoothingTimeConstant: 1.5,
        audioContextFactory: () => makeContext() as unknown as AudioContext,
      }),
    ).toThrow(/smoothing/);
  });
});
