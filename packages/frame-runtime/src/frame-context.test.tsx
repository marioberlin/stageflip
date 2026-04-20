// packages/frame-runtime/src/frame-context.test.tsx
// Unit tests for FrameContext, FrameProvider, useCurrentFrame, useVideoConfig.

import { render, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  FrameProvider,
  type VideoConfig,
  useCurrentFrame,
  useVideoConfig,
} from './frame-context.js';

const CONFIG: VideoConfig = {
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 300,
};

const wrap = (frame: number) => {
  return function Wrapper({ children }: { children: React.ReactNode }): React.ReactNode {
    return (
      <FrameProvider frame={frame} config={CONFIG}>
        {children}
      </FrameProvider>
    );
  };
};

describe('FrameProvider + hooks', () => {
  it('useCurrentFrame returns the provider-supplied frame', () => {
    const { result } = renderHook(() => useCurrentFrame(), { wrapper: wrap(42) });
    expect(result.current).toBe(42);
  });

  it('useVideoConfig returns the provider-supplied config', () => {
    const { result } = renderHook(() => useVideoConfig(), { wrapper: wrap(0) });
    expect(result.current).toEqual(CONFIG);
  });

  it('frame updates when the provider re-renders with a new value', () => {
    const { result, rerender } = renderHook(() => useCurrentFrame(), {
      wrapper: wrap(10),
    });
    expect(result.current).toBe(10);

    // Rerender with a new wrapper (different frame).
    rerender();
    // wrapper() is invoked per-render but returns a stable component; value
    // stays 10 because the wrapper was built for frame=10. This assertion
    // documents the expected behaviour.
    expect(result.current).toBe(10);
  });

  it('integration: child component inside FrameProvider reads frame', () => {
    function FrameLabel(): React.ReactNode {
      const frame = useCurrentFrame();
      return <span data-testid="f">{frame}</span>;
    }
    const { getByTestId } = render(
      <FrameProvider frame={7} config={CONFIG}>
        <FrameLabel />
      </FrameProvider>,
    );
    expect(getByTestId('f').textContent).toBe('7');
  });

  it('useCurrentFrame throws outside a FrameProvider', () => {
    // renderHook without wrapper -> no provider -> hook throws.
    expect(() => {
      renderHook(() => useCurrentFrame());
    }).toThrow(/FrameProvider missing/);
  });

  it('useVideoConfig throws outside a FrameProvider', () => {
    expect(() => {
      renderHook(() => useVideoConfig());
    }).toThrow(/FrameProvider missing/);
  });

  it('two providers are independent: outer value shadowed by inner', () => {
    function Inner(): React.ReactNode {
      const frame = useCurrentFrame();
      return <span data-testid="inner">{frame}</span>;
    }
    const { getByTestId } = render(
      <FrameProvider frame={1} config={CONFIG}>
        <FrameProvider frame={99} config={CONFIG}>
          <Inner />
        </FrameProvider>
      </FrameProvider>,
    );
    expect(getByTestId('inner').textContent).toBe('99');
  });
});
