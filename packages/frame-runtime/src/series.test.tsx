// packages/frame-runtime/src/series.test.tsx
// Unit tests for <Series> and <Series.Sequence>.

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { FrameProvider, type VideoConfig, useCurrentFrame } from './frame-context.js';
import { Series } from './series.js';

afterEach(cleanup);

const CONFIG: VideoConfig = {
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 300,
};

function FrameLabel({ testid }: { testid: string }): React.ReactNode {
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

describe('Series — chains sequences by cumulative duration', () => {
  it('first child is active at frame 0', () => {
    const { getByTestId, queryByTestId } = render(
      withParent(
        0,
        <Series>
          <Series.Sequence durationInFrames={10}>
            <FrameLabel testid="a" />
          </Series.Sequence>
          <Series.Sequence durationInFrames={10}>
            <FrameLabel testid="b" />
          </Series.Sequence>
        </Series>,
      ),
    );
    expect(getByTestId('a').textContent).toBe('0');
    expect(queryByTestId('b')).toBeNull();
  });

  it('second child starts exactly when first ends', () => {
    const { queryByTestId, getByTestId } = render(
      withParent(
        10,
        <Series>
          <Series.Sequence durationInFrames={10}>
            <FrameLabel testid="a" />
          </Series.Sequence>
          <Series.Sequence durationInFrames={10}>
            <FrameLabel testid="b" />
          </Series.Sequence>
        </Series>,
      ),
    );
    expect(queryByTestId('a')).toBeNull();
    expect(getByTestId('b').textContent).toBe('0');
  });

  it('third child is offset by sum of prior durations', () => {
    const { getByTestId } = render(
      withParent(
        25,
        <Series>
          <Series.Sequence durationInFrames={10}>
            <FrameLabel testid="a" />
          </Series.Sequence>
          <Series.Sequence durationInFrames={10}>
            <FrameLabel testid="b" />
          </Series.Sequence>
          <Series.Sequence durationInFrames={10}>
            <FrameLabel testid="c" />
          </Series.Sequence>
        </Series>,
      ),
    );
    // parentFrame=25, third sequence from=20, inner=5
    expect(getByTestId('c').textContent).toBe('5');
  });

  it('past the final sequence: nothing mounted (for finite durations)', () => {
    const { queryByTestId } = render(
      withParent(
        30,
        <Series>
          <Series.Sequence durationInFrames={10}>
            <FrameLabel testid="a" />
          </Series.Sequence>
          <Series.Sequence durationInFrames={10}>
            <FrameLabel testid="b" />
          </Series.Sequence>
          <Series.Sequence durationInFrames={10}>
            <FrameLabel testid="c" />
          </Series.Sequence>
        </Series>,
      ),
    );
    expect(queryByTestId('a')).toBeNull();
    expect(queryByTestId('b')).toBeNull();
    expect(queryByTestId('c')).toBeNull();
  });
});

describe('Series — offset shifts subsequent children', () => {
  it('positive offset introduces a gap', () => {
    // b.from = 10 (duration of a) + 5 (offset) = 15
    const { queryByTestId, getByTestId } = render(
      withParent(
        12,
        <Series>
          <Series.Sequence durationInFrames={10}>
            <FrameLabel testid="a" />
          </Series.Sequence>
          <Series.Sequence durationInFrames={10} offset={5}>
            <FrameLabel testid="b" />
          </Series.Sequence>
        </Series>,
      ),
    );
    // at 12 a has ended (0..9), b hasn't started (starts at 15), gap → nothing
    expect(queryByTestId('a')).toBeNull();
    expect(queryByTestId('b')).toBeNull();

    // at 15 b starts
    cleanup();
    const mounted = render(
      withParent(
        15,
        <Series>
          <Series.Sequence durationInFrames={10}>
            <FrameLabel testid="a" />
          </Series.Sequence>
          <Series.Sequence durationInFrames={10} offset={5}>
            <FrameLabel testid="b" />
          </Series.Sequence>
        </Series>,
      ),
    );
    expect(mounted.getByTestId('b').textContent).toBe('0');
  });

  it('negative offset overlaps prior sequence', () => {
    // b.from = 10 (duration of a) + (-3) = 7
    const { getByTestId } = render(
      withParent(
        8,
        <Series>
          <Series.Sequence durationInFrames={10}>
            <FrameLabel testid="a" />
          </Series.Sequence>
          <Series.Sequence durationInFrames={10} offset={-3}>
            <FrameLabel testid="b" />
          </Series.Sequence>
        </Series>,
      ),
    );
    expect(getByTestId('a').textContent).toBe('8');
    expect(getByTestId('b').textContent).toBe('1');
  });

  it('offset on the first child shifts its `from`', () => {
    // a.from = 0 + 3 = 3
    const { queryByTestId, getByTestId } = render(
      withParent(
        2,
        <Series>
          <Series.Sequence durationInFrames={10} offset={3}>
            <FrameLabel testid="a" />
          </Series.Sequence>
        </Series>,
      ),
    );
    expect(queryByTestId('a')).toBeNull();

    cleanup();
    const mounted = render(
      withParent(
        3,
        <Series>
          <Series.Sequence durationInFrames={10} offset={3}>
            <FrameLabel testid="a" />
          </Series.Sequence>
        </Series>,
      ),
    );
    expect(mounted.getByTestId('a').textContent).toBe('0');
  });
});

describe('Series — Infinity only allowed on final child', () => {
  it('Infinity on the last child keeps mounting at high frames', () => {
    const { getByTestId } = render(
      withParent(
        10_000,
        <Series>
          <Series.Sequence durationInFrames={10}>
            <FrameLabel testid="a" />
          </Series.Sequence>
          <Series.Sequence durationInFrames={Number.POSITIVE_INFINITY}>
            <FrameLabel testid="b" />
          </Series.Sequence>
        </Series>,
      ),
    );
    expect(getByTestId('b').textContent).toBe('9990');
  });

  it('throws when Infinity is used on a non-final child', () => {
    expect(() =>
      render(
        withParent(
          0,
          <Series>
            <Series.Sequence durationInFrames={Number.POSITIVE_INFINITY}>
              <span>a</span>
            </Series.Sequence>
            <Series.Sequence durationInFrames={10}>
              <span>b</span>
            </Series.Sequence>
          </Series>,
        ),
      ),
    ).toThrow(/Infinity.*last/);
  });
});

describe('Series — ignores falsy children (conditional rendering)', () => {
  it('null / false / undefined children are skipped', () => {
    const show = false;
    const { getByTestId } = render(
      withParent(
        0,
        <Series>
          <Series.Sequence durationInFrames={10}>
            <FrameLabel testid="a" />
          </Series.Sequence>
          {show ? (
            <Series.Sequence durationInFrames={10}>
              <FrameLabel testid="gone" />
            </Series.Sequence>
          ) : null}
          <Series.Sequence durationInFrames={10}>
            <FrameLabel testid="c" />
          </Series.Sequence>
        </Series>,
      ),
    );
    // b is skipped → c starts at 10
    expect(getByTestId('a').textContent).toBe('0');

    cleanup();
    const mounted = render(
      withParent(
        10,
        <Series>
          <Series.Sequence durationInFrames={10}>
            <FrameLabel testid="a" />
          </Series.Sequence>
          {show ? (
            <Series.Sequence durationInFrames={10}>
              <FrameLabel testid="gone" />
            </Series.Sequence>
          ) : null}
          <Series.Sequence durationInFrames={10}>
            <FrameLabel testid="c" />
          </Series.Sequence>
        </Series>,
      ),
    );
    expect(mounted.getByTestId('c').textContent).toBe('0');
  });
});

describe('Series — child validation', () => {
  it('throws when a child is not a Series.Sequence', () => {
    expect(() =>
      render(
        withParent(
          0,
          <Series>
            <span>not-a-sequence</span>
          </Series>,
        ),
      ),
    ).toThrow(/Series.*children.*Series.Sequence/);
  });

  it('throws on non-integer durationInFrames', () => {
    expect(() =>
      render(
        withParent(
          0,
          <Series>
            <Series.Sequence durationInFrames={1.5}>
              <span>a</span>
            </Series.Sequence>
          </Series>,
        ),
      ),
    ).toThrow(/durationInFrames.*integer/);
  });

  it('throws on non-positive durationInFrames', () => {
    expect(() =>
      render(
        withParent(
          0,
          <Series>
            <Series.Sequence durationInFrames={0}>
              <span>a</span>
            </Series.Sequence>
          </Series>,
        ),
      ),
    ).toThrow(/durationInFrames.*positive/);
  });

  it('throws on non-integer offset', () => {
    expect(() =>
      render(
        withParent(
          0,
          <Series>
            <Series.Sequence durationInFrames={10} offset={1.5}>
              <span>a</span>
            </Series.Sequence>
          </Series>,
        ),
      ),
    ).toThrow(/offset.*integer/);
  });
});

describe('Series.Sequence — standalone use', () => {
  it('throws when rendered outside a Series', () => {
    expect(() =>
      render(
        withParent(
          0,
          <Series.Sequence durationInFrames={10}>
            <span>a</span>
          </Series.Sequence>,
        ),
      ),
    ).toThrow(/Series\.Sequence.*Series/);
  });
});
