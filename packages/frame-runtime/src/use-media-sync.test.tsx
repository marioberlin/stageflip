// packages/frame-runtime/src/use-media-sync.test.tsx
// Unit tests for useMediaSync(). Uses a stub HTMLVideoElement so tests
// work without a real media backend.

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FrameProvider, type VideoConfig } from './frame-context.js';
import { type UseMediaSyncOptions, useMediaSync } from './use-media-sync.js';

afterEach(cleanup);

const CONFIG: VideoConfig = {
  width: 1920,
  height: 1080,
  fps: 60,
  durationInFrames: 600,
};

/** Minimal stub with the media API surface useMediaSync touches. */
interface MediaStub {
  currentTime: number;
  paused: boolean;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
}

function makeStub(): MediaStub {
  const stub: MediaStub = {
    currentTime: 0,
    paused: true,
    play: vi.fn(() => {
      stub.paused = false;
      return Promise.resolve();
    }),
    pause: vi.fn(() => {
      stub.paused = true;
    }),
  };
  return stub;
}

/**
 * Test harness: renders a FrameProvider with a controlled frame, mounts a
 * component that calls useMediaSync, returns a rerender function.
 */
function renderWithFrame(
  stub: MediaStub,
  initialFrame: number,
  options: UseMediaSyncOptions = {},
): { rerender: (frame: number) => void } {
  const ref = { current: stub as unknown as HTMLVideoElement };

  function Harness({ frame }: { frame: number }): React.ReactNode {
    useMediaSync(ref, options);
    return <span data-testid="frame">{frame}</span>;
  }

  function Wrapper({ frame }: { frame: number }): React.ReactNode {
    return (
      <FrameProvider frame={frame} config={CONFIG}>
        <Harness frame={frame} />
      </FrameProvider>
    );
  }

  const { rerender } = render(<Wrapper frame={initialFrame} />);
  return {
    rerender: (frame) => rerender(<Wrapper frame={frame} />),
  };
}

describe('useMediaSync — in-window sync', () => {
  it('seeks currentTime to the frame-derived target', () => {
    const stub = makeStub();
    renderWithFrame(stub, 30);
    // frame=30 at fps=60 → 0.5s
    expect(stub.currentTime).toBeCloseTo(0.5, 6);
  });

  it('plays the media when first entering the window', () => {
    const stub = makeStub();
    renderWithFrame(stub, 0);
    expect(stub.play).toHaveBeenCalled();
    expect(stub.paused).toBe(false);
  });

  it('does not re-seek when drift is within half a frame', () => {
    const stub = makeStub();
    const { rerender } = renderWithFrame(stub, 0);
    // After frame=0 effect, currentTime should be 0 and play has fired.
    // Simulate natural playback: the browser would advance currentTime;
    // hand-set it close to the next frame's target.
    stub.currentTime = 1 / 60 - 0.001; // ≈ target for frame=1 within half-frame
    rerender(1);
    // Target for frame=1 is 1/60 ≈ 0.01667. Drift = 0.001 < 0.5/60 ≈ 0.00833 → no seek.
    expect(stub.currentTime).toBeCloseTo(1 / 60 - 0.001, 6);
  });

  it('re-seeks when drift exceeds half a frame', () => {
    const stub = makeStub();
    const { rerender } = renderWithFrame(stub, 0);
    stub.currentTime = 0; // drift = 2/60 from frame=2's target
    rerender(2);
    expect(stub.currentTime).toBeCloseTo(2 / 60, 6);
  });
});

describe('useMediaSync — offsetMs + durationMs window', () => {
  it('stays paused and does not seek when before the window', () => {
    const stub = makeStub();
    renderWithFrame(stub, 0, { offsetMs: 1000 }); // window starts at 1s
    // frame=0 → currentMs = 0 < 1000 → out of window.
    expect(stub.paused).toBe(true);
    expect(stub.currentTime).toBe(0);
    expect(stub.play).not.toHaveBeenCalled();
  });

  it('stays paused and does not seek when after the window end', () => {
    const stub = makeStub();
    renderWithFrame(stub, 120, { offsetMs: 0, durationMs: 1000 });
    // frame=120 at fps=60 → 2000ms, durationMs=1000 → endMs=1000, out of window.
    expect(stub.paused).toBe(true);
    expect(stub.currentTime).toBe(0);
    expect(stub.play).not.toHaveBeenCalled();
  });

  it('is in window exactly at offsetMs (inclusive start)', () => {
    const stub = makeStub();
    renderWithFrame(stub, 60, { offsetMs: 1000 });
    // frame=60 → 1000ms === offsetMs. Inside.
    expect(stub.currentTime).toBeCloseTo(0, 6);
    expect(stub.play).toHaveBeenCalled();
  });

  it('is out of window at offsetMs + durationMs (exclusive end)', () => {
    const stub = makeStub();
    renderWithFrame(stub, 60, { offsetMs: 0, durationMs: 1000 });
    // frame=60 → 1000ms. 1000 < 1000 is false → out of window.
    expect(stub.paused).toBe(true);
    expect(stub.play).not.toHaveBeenCalled();
  });

  it('default offsetMs=0 and durationMs=undefined means full-duration window', () => {
    const stub = makeStub();
    renderWithFrame(stub, 300);
    expect(stub.paused).toBe(false);
    expect(stub.currentTime).toBeCloseTo(5, 6); // 300/60
  });

  it('target is relative to offsetMs (media local time starts at 0)', () => {
    const stub = makeStub();
    renderWithFrame(stub, 90, { offsetMs: 1000 });
    // currentMs = 1500, startMs = 1000 → mediaTargetSec = 0.5s
    expect(stub.currentTime).toBeCloseTo(0.5, 6);
  });
});

describe('useMediaSync — lifecycle transitions', () => {
  it('plays on entering window and pauses on leaving', () => {
    const stub = makeStub();
    const { rerender } = renderWithFrame(stub, 0, {
      offsetMs: 0,
      durationMs: 1000,
    });
    // frame=0, inside → played.
    expect(stub.play).toHaveBeenCalledTimes(1);

    // Move outside the window at the right end.
    rerender(120);
    expect(stub.pause).toHaveBeenCalled();
    expect(stub.paused).toBe(true);

    // Re-enter the window.
    stub.play.mockClear();
    rerender(30);
    expect(stub.play).toHaveBeenCalled();
    expect(stub.paused).toBe(false);
  });
});

describe('useMediaSync — 60-step scrub stays within ±1 frame of target', () => {
  it('media.currentTime tracks within one frame of the frame-derived target across a 60-step scrub', () => {
    const stub = makeStub();
    const { rerender } = renderWithFrame(stub, 0);
    const oneFrameSec = 1 / 60;

    for (let f = 0; f <= 60; f++) {
      rerender(f);
      const target = f / 60;
      expect(Math.abs(stub.currentTime - target)).toBeLessThanOrEqual(oneFrameSec + 1e-9);
    }
  });
});

describe('useMediaSync — robustness', () => {
  it('handles null ref without throwing', () => {
    const ref = { current: null };
    function Harness(): React.ReactNode {
      useMediaSync(ref);
      return null;
    }
    expect(() =>
      render(
        <FrameProvider frame={0} config={CONFIG}>
          <Harness />
        </FrameProvider>,
      ),
    ).not.toThrow();
  });

  it('swallows play() rejection (autoplay policy)', () => {
    const stub: MediaStub = {
      currentTime: 0,
      paused: true,
      play: vi.fn(() => Promise.reject(new Error('NotAllowedError'))),
      pause: vi.fn(() => {
        /* noop */
      }),
    };
    const ref = { current: stub as unknown as HTMLVideoElement };
    function Harness(): React.ReactNode {
      useMediaSync(ref);
      return null;
    }
    expect(() =>
      render(
        <FrameProvider frame={0} config={CONFIG}>
          <Harness />
        </FrameProvider>,
      ),
    ).not.toThrow();
  });

  it('does not call pause if already paused when leaving window', () => {
    const stub = makeStub();
    stub.paused = true;
    renderWithFrame(stub, 0, { offsetMs: 1000 });
    expect(stub.pause).not.toHaveBeenCalled();
  });
});
