// packages/frame-runtime/src/sequence.test.tsx
// Unit tests for <Sequence>.

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  FrameProvider,
  type VideoConfig,
  useCurrentFrame,
  useVideoConfig,
} from './frame-context.js';
import { Sequence } from './sequence.js';

afterEach(cleanup);

const CONFIG: VideoConfig = {
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 300,
};

function FrameLabel({ testid = 'frame' }: { testid?: string }): React.ReactNode {
  const frame = useCurrentFrame();
  return <span data-testid={testid}>{frame}</span>;
}

function withParent(parentFrame: number, children: React.ReactNode): React.ReactElement {
  return (
    <FrameProvider frame={parentFrame} config={CONFIG}>
      {children}
    </FrameProvider>
  );
}

describe('Sequence — mount gate', () => {
  it('does not mount children before `from`', () => {
    const { queryByTestId } = render(
      withParent(
        2,
        <Sequence from={5}>
          <FrameLabel />
        </Sequence>,
      ),
    );
    expect(queryByTestId('frame')).toBeNull();
  });

  it('mounts children at parentFrame === from with inner frame 0', () => {
    const { getByTestId } = render(
      withParent(
        5,
        <Sequence from={5}>
          <FrameLabel />
        </Sequence>,
      ),
    );
    expect(getByTestId('frame').textContent).toBe('0');
  });

  it('does not mount children after from + durationInFrames', () => {
    const { queryByTestId } = render(
      withParent(
        10,
        <Sequence from={5} durationInFrames={3}>
          <FrameLabel />
        </Sequence>,
      ),
    );
    // last active parent frame is 7 (5 + 3 - 1); parent=10 is past end.
    expect(queryByTestId('frame')).toBeNull();
  });

  it('mounts at parentFrame === from + durationInFrames - 1 (inclusive end)', () => {
    const { getByTestId } = render(
      withParent(
        7,
        <Sequence from={5} durationInFrames={3}>
          <FrameLabel />
        </Sequence>,
      ),
    );
    expect(getByTestId('frame').textContent).toBe('2');
  });

  it('does not mount at parentFrame === from + durationInFrames (exclusive end)', () => {
    const { queryByTestId } = render(
      withParent(
        8,
        <Sequence from={5} durationInFrames={3}>
          <FrameLabel />
        </Sequence>,
      ),
    );
    expect(queryByTestId('frame')).toBeNull();
  });
});

describe('Sequence — frame remap', () => {
  it('remaps parentFrame by subtracting from', () => {
    const { getByTestId } = render(
      withParent(
        10,
        <Sequence from={3}>
          <FrameLabel />
        </Sequence>,
      ),
    );
    expect(getByTestId('frame').textContent).toBe('7');
  });

  it('default from=0 is a pass-through', () => {
    const { getByTestId } = render(
      withParent(
        42,
        <Sequence>
          <FrameLabel />
        </Sequence>,
      ),
    );
    expect(getByTestId('frame').textContent).toBe('42');
  });

  it('default durationInFrames=Infinity keeps children mounted at high parent frames', () => {
    const { getByTestId } = render(
      withParent(
        100_000,
        <Sequence from={0}>
          <FrameLabel />
        </Sequence>,
      ),
    );
    expect(getByTestId('frame').textContent).toBe('100000');
  });

  it('negative from allows a pre-clipped window (inner frame is parent - from)', () => {
    // from=-3, parentFrame=0 → sequenceFrame=3 (past the "virtual" start)
    const { getByTestId } = render(
      withParent(
        0,
        <Sequence from={-3}>
          <FrameLabel />
        </Sequence>,
      ),
    );
    expect(getByTestId('frame').textContent).toBe('3');
  });

  it('nested sequences compose additively', () => {
    const { getByTestId } = render(
      withParent(
        20,
        <Sequence from={10}>
          <Sequence from={5}>
            <FrameLabel />
          </Sequence>
        </Sequence>,
      ),
    );
    // outer: inner frame = 10; inner sequence from=5 → deepest frame = 5.
    expect(getByTestId('frame').textContent).toBe('5');
  });
});

describe('Sequence — layout', () => {
  it("'absolute-fill' wraps children in a positioned div", () => {
    const { container } = render(
      withParent(
        0,
        <Sequence from={0} layout="absolute-fill">
          <span data-testid="child">hi</span>
        </Sequence>,
      ),
    );
    const wrapper = container.querySelector('div');
    expect(wrapper).not.toBeNull();
    expect((wrapper as HTMLElement).style.position).toBe('absolute');
    expect((wrapper as HTMLElement).style.top).toBe('0px');
    expect((wrapper as HTMLElement).style.left).toBe('0px');
    expect((wrapper as HTMLElement).style.right).toBe('0px');
    expect((wrapper as HTMLElement).style.bottom).toBe('0px');
  });

  it("'none' renders children without a wrapper div", () => {
    const { container } = render(
      withParent(
        0,
        <Sequence from={0} layout="none">
          <span data-testid="child">hi</span>
        </Sequence>,
      ),
    );
    expect(container.querySelector('div')).toBeNull();
    expect(container.querySelector('[data-testid="child"]')).not.toBeNull();
  });

  it("defaults layout to 'absolute-fill'", () => {
    const { container } = render(
      withParent(
        0,
        <Sequence from={0}>
          <span>hi</span>
        </Sequence>,
      ),
    );
    expect(container.querySelector('div')).not.toBeNull();
  });

  it('name prop is exposed on the wrapper for debugging', () => {
    const { container } = render(
      withParent(
        0,
        <Sequence from={0} name="intro">
          <span>hi</span>
        </Sequence>,
      ),
    );
    const wrapper = container.querySelector('div');
    expect(wrapper?.getAttribute('data-stageflip-sequence')).toBe('intro');
  });
});

describe('Sequence — VideoConfig passthrough', () => {
  it('preserves the parent VideoConfig inside the sequence', () => {
    function ConfigLabel(): React.ReactNode {
      const cfg = useVideoConfig();
      return <span data-testid="cfg">{`${cfg.width}x${cfg.height}@${cfg.fps}`}</span>;
    }
    const { getByTestId } = render(
      withParent(
        0,
        <Sequence from={0}>
          <ConfigLabel />
        </Sequence>,
      ),
    );
    expect(getByTestId('cfg').textContent).toBe('1920x1080@30');
  });
});

describe('Sequence — validation', () => {
  it('throws on non-integer from', () => {
    expect(() =>
      render(
        withParent(
          0,
          <Sequence from={1.5}>
            <span>hi</span>
          </Sequence>,
        ),
      ),
    ).toThrow(/from.*integer/);
  });

  it('throws on non-integer finite durationInFrames', () => {
    expect(() =>
      render(
        withParent(
          0,
          <Sequence from={0} durationInFrames={2.5}>
            <span>hi</span>
          </Sequence>,
        ),
      ),
    ).toThrow(/durationInFrames.*integer/);
  });

  it('throws on negative durationInFrames', () => {
    expect(() =>
      render(
        withParent(
          0,
          <Sequence from={0} durationInFrames={-1}>
            <span>hi</span>
          </Sequence>,
        ),
      ),
    ).toThrow(/durationInFrames.*non-negative/);
  });

  it('durationInFrames === 0 is valid but never mounts', () => {
    const { queryByTestId } = render(
      withParent(
        0,
        <Sequence from={0} durationInFrames={0}>
          <FrameLabel />
        </Sequence>,
      ),
    );
    expect(queryByTestId('frame')).toBeNull();
  });

  it('throws when used outside a FrameProvider (inherits from useCurrentFrame)', () => {
    expect(() =>
      render(
        <Sequence from={0}>
          <span>hi</span>
        </Sequence>,
      ),
    ).toThrow(/FrameProvider missing/);
  });
});
