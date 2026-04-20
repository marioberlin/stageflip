// packages/frame-runtime/src/freeze.test.tsx
// Unit tests for <Freeze>.

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  FrameProvider,
  type VideoConfig,
  useCurrentFrame,
  useVideoConfig,
} from './frame-context.js';
import { Freeze } from './freeze.js';

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

describe('Freeze — remaps frame to the frozen value', () => {
  it('substitutes the provided frame regardless of parent', () => {
    const { getByTestId } = render(
      withParent(
        100,
        <Freeze frame={5}>
          <FrameLabel />
        </Freeze>,
      ),
    );
    expect(getByTestId('frame').textContent).toBe('5');
  });

  it('works even when parent frame is 0', () => {
    const { getByTestId } = render(
      withParent(
        0,
        <Freeze frame={42}>
          <FrameLabel />
        </Freeze>,
      ),
    );
    expect(getByTestId('frame').textContent).toBe('42');
  });

  it('allows frame=0', () => {
    const { getByTestId } = render(
      withParent(
        99,
        <Freeze frame={0}>
          <FrameLabel />
        </Freeze>,
      ),
    );
    expect(getByTestId('frame').textContent).toBe('0');
  });
});

describe('Freeze — active flag', () => {
  it('defaults to active=true', () => {
    const { getByTestId } = render(
      withParent(
        100,
        <Freeze frame={5}>
          <FrameLabel />
        </Freeze>,
      ),
    );
    expect(getByTestId('frame').textContent).toBe('5');
  });

  it('active=false is a pass-through', () => {
    const { getByTestId } = render(
      withParent(
        100,
        <Freeze frame={5} active={false}>
          <FrameLabel />
        </Freeze>,
      ),
    );
    expect(getByTestId('frame').textContent).toBe('100');
  });
});

describe('Freeze — VideoConfig passthrough', () => {
  it('preserves the parent VideoConfig', () => {
    function ConfigLabel(): React.ReactNode {
      const cfg = useVideoConfig();
      return <span data-testid="cfg">{`${cfg.width}x${cfg.height}@${cfg.fps}`}</span>;
    }
    const { getByTestId } = render(
      withParent(
        0,
        <Freeze frame={0}>
          <ConfigLabel />
        </Freeze>,
      ),
    );
    expect(getByTestId('cfg').textContent).toBe('1920x1080@30');
  });
});

describe('Freeze — no wrapper DOM node', () => {
  it('does not add a div wrapper', () => {
    const { container } = render(
      withParent(
        0,
        <Freeze frame={0}>
          <span data-testid="child">hi</span>
        </Freeze>,
      ),
    );
    expect(container.querySelector('div')).toBeNull();
    expect(container.querySelector('[data-testid="child"]')).not.toBeNull();
  });
});

describe('Freeze — validation', () => {
  it('throws on non-integer frame', () => {
    expect(() =>
      render(
        withParent(
          0,
          <Freeze frame={1.5}>
            <span>hi</span>
          </Freeze>,
        ),
      ),
    ).toThrow(/frame.*integer/);
  });

  it('throws outside a FrameProvider', () => {
    expect(() =>
      render(
        <Freeze frame={0}>
          <span>hi</span>
        </Freeze>,
      ),
    ).toThrow(/FrameProvider missing/);
  });
});
