// packages/frame-runtime/src/loop.test.tsx
// Unit tests for <Loop>.

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { FrameProvider, type VideoConfig, useCurrentFrame } from './frame-context.js';
import { Loop } from './loop.js';

afterEach(cleanup);

const CONFIG: VideoConfig = {
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 300,
};

function FrameLabel(): React.ReactNode {
  const frame = useCurrentFrame();
  return <span data-testid="frame">{frame}</span>;
}

function withParent(parentFrame: number, children: React.ReactNode): React.ReactElement {
  return (
    <FrameProvider frame={parentFrame} config={CONFIG}>
      {children}
    </FrameProvider>
  );
}

describe('Loop — frame wrap', () => {
  it('pass-through at start of first iteration', () => {
    const { getByTestId } = render(
      withParent(
        0,
        <Loop durationInFrames={10}>
          <FrameLabel />
        </Loop>,
      ),
    );
    expect(getByTestId('frame').textContent).toBe('0');
  });

  it('pass-through at last frame of first iteration', () => {
    const { getByTestId } = render(
      withParent(
        9,
        <Loop durationInFrames={10}>
          <FrameLabel />
        </Loop>,
      ),
    );
    expect(getByTestId('frame').textContent).toBe('9');
  });

  it('wraps at start of second iteration', () => {
    const { getByTestId } = render(
      withParent(
        10,
        <Loop durationInFrames={10}>
          <FrameLabel />
        </Loop>,
      ),
    );
    expect(getByTestId('frame').textContent).toBe('0');
  });

  it('wraps mid-iteration', () => {
    const { getByTestId } = render(
      withParent(
        25,
        <Loop durationInFrames={10}>
          <FrameLabel />
        </Loop>,
      ),
    );
    expect(getByTestId('frame').textContent).toBe('5');
  });
});

describe('Loop — finite times', () => {
  it('mounts on the last frame of the last iteration', () => {
    const { getByTestId } = render(
      withParent(
        29,
        <Loop durationInFrames={10} times={3}>
          <FrameLabel />
        </Loop>,
      ),
    );
    expect(getByTestId('frame').textContent).toBe('9');
  });

  it('does not mount past the final iteration (exclusive end)', () => {
    const { queryByTestId } = render(
      withParent(
        30,
        <Loop durationInFrames={10} times={3}>
          <FrameLabel />
        </Loop>,
      ),
    );
    expect(queryByTestId('frame')).toBeNull();
  });

  it('does not mount for times === 0', () => {
    const { queryByTestId } = render(
      withParent(
        0,
        <Loop durationInFrames={10} times={0}>
          <FrameLabel />
        </Loop>,
      ),
    );
    expect(queryByTestId('frame')).toBeNull();
  });
});

describe('Loop — default Infinity', () => {
  it('mounts even at very high parent frames', () => {
    const { getByTestId } = render(
      withParent(
        1_000_000 + 3,
        <Loop durationInFrames={10}>
          <FrameLabel />
        </Loop>,
      ),
    );
    expect(getByTestId('frame').textContent).toBe('3');
  });
});

describe('Loop — negative parent frame', () => {
  it('does not mount when parentFrame is negative', () => {
    const { queryByTestId } = render(
      withParent(
        -1,
        <Loop durationInFrames={10}>
          <FrameLabel />
        </Loop>,
      ),
    );
    expect(queryByTestId('frame')).toBeNull();
  });
});

describe('Loop — layout', () => {
  it("'absolute-fill' wraps in a positioned div with data-attr", () => {
    const { container } = render(
      withParent(
        0,
        <Loop durationInFrames={10} name="tick">
          <span>hi</span>
        </Loop>,
      ),
    );
    const wrapper = container.querySelector('div');
    expect(wrapper).not.toBeNull();
    expect((wrapper as HTMLElement).style.position).toBe('absolute');
    expect(wrapper?.getAttribute('data-stageflip-loop')).toBe('tick');
  });

  it("'none' renders children without a wrapper div", () => {
    const { container } = render(
      withParent(
        0,
        <Loop durationInFrames={10} layout="none">
          <span>hi</span>
        </Loop>,
      ),
    );
    expect(container.querySelector('div')).toBeNull();
  });
});

describe('Loop — validation', () => {
  it('throws on non-integer durationInFrames', () => {
    expect(() =>
      render(
        withParent(
          0,
          <Loop durationInFrames={1.5}>
            <span>hi</span>
          </Loop>,
        ),
      ),
    ).toThrow(/durationInFrames.*integer/);
  });

  it('throws on durationInFrames <= 0', () => {
    expect(() =>
      render(
        withParent(
          0,
          <Loop durationInFrames={0}>
            <span>hi</span>
          </Loop>,
        ),
      ),
    ).toThrow(/durationInFrames.*positive/);
  });

  it('throws on non-integer finite times', () => {
    expect(() =>
      render(
        withParent(
          0,
          <Loop durationInFrames={10} times={2.5}>
            <span>hi</span>
          </Loop>,
        ),
      ),
    ).toThrow(/times.*integer/);
  });

  it('throws on negative times', () => {
    expect(() =>
      render(
        withParent(
          0,
          <Loop durationInFrames={10} times={-1}>
            <span>hi</span>
          </Loop>,
        ),
      ),
    ).toThrow(/times.*non-negative/);
  });

  it('throws outside a FrameProvider', () => {
    expect(() =>
      render(
        <Loop durationInFrames={10}>
          <span>hi</span>
        </Loop>,
      ),
    ).toThrow(/FrameProvider missing/);
  });
});
