// packages/runtimes/three/src/index.test.tsx
// Unit tests for the three runtime. Uses pure non-THREE handles to exercise
// the host contract; the demo clip (three-product-reveal) is imported only
// to verify its kind string — its actual WebGL path is deferred to the dev
// harness + T-067 parity fixtures.

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ClipRenderContext } from '@stageflip/runtimes-contract';

import {
  type ThreeClipHandle,
  type ThreeClipRenderArgs,
  type ThreeClipSetupArgs,
  createThreeRuntime,
  defineThreeClip,
  threeProductReveal,
} from './index.js';

afterEach(cleanup);

interface TestProps {
  tag: string;
}

function makeCtx<P>(overrides: Partial<ClipRenderContext<P>> & { props: P }): ClipRenderContext<P> {
  return {
    frame: 0,
    fps: 30,
    width: 1920,
    height: 1080,
    clipFrom: 0,
    clipDurationInFrames: 60,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Runtime shape
// ---------------------------------------------------------------------------

describe('createThreeRuntime — runtime shape', () => {
  it("produces a ClipRuntime with id 'three' and tier 'live'", () => {
    const rt = createThreeRuntime();
    expect(rt.id).toBe('three');
    expect(rt.tier).toBe('live');
    expect(rt.clips.size).toBe(0);
  });

  it('accepts clips at construction time', () => {
    const clip = defineThreeClip<TestProps>({
      kind: 'probe',
      setup: () => ({ render: () => {} }),
    });
    const rt = createThreeRuntime([clip]);
    expect(rt.clips.get('probe')).toBe(clip);
  });

  it('throws on duplicate kind', () => {
    const a = defineThreeClip<TestProps>({
      kind: 'dup',
      setup: () => ({ render: () => {} }),
    });
    const b = defineThreeClip<TestProps>({
      kind: 'dup',
      setup: () => ({ render: () => {} }),
    });
    expect(() => createThreeRuntime([a, b])).toThrow(/duplicate/);
  });
});

// ---------------------------------------------------------------------------
// Window gating
// ---------------------------------------------------------------------------

describe('defineThreeClip — window gating', () => {
  const noopSetup = (): ThreeClipHandle<TestProps> => ({ render: () => {} });

  it('returns null before the clip window', () => {
    const clip = defineThreeClip<TestProps>({ kind: 'gated', setup: noopSetup });
    const el = clip.render(makeCtx<TestProps>({ frame: 4, clipFrom: 5, props: { tag: 'x' } }));
    expect(el).toBeNull();
  });

  it('returns null at the exclusive end', () => {
    const clip = defineThreeClip<TestProps>({ kind: 'gated', setup: noopSetup });
    const el = clip.render(
      makeCtx<TestProps>({
        frame: 10,
        clipFrom: 5,
        clipDurationInFrames: 5,
        props: { tag: 'x' },
      }),
    );
    expect(el).toBeNull();
  });

  it('renders at inclusive start and last frame', () => {
    const clip = defineThreeClip<TestProps>({ kind: 'gated', setup: noopSetup });
    expect(
      clip.render(makeCtx<TestProps>({ frame: 5, clipFrom: 5, props: { tag: 'x' } })),
    ).not.toBeNull();
    expect(
      clip.render(
        makeCtx<TestProps>({
          frame: 9,
          clipFrom: 5,
          clipDurationInFrames: 5,
          props: { tag: 'x' },
        }),
      ),
    ).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Host lifecycle (pure handle, no THREE)
// ---------------------------------------------------------------------------

describe('defineThreeClip — host lifecycle', () => {
  it('calls setup exactly once per mount with the container, width, height, props', () => {
    const setupSpy = vi.fn<(args: ThreeClipSetupArgs<TestProps>) => ThreeClipHandle<TestProps>>(
      () => ({
        render: () => {},
      }),
    );
    const clip = defineThreeClip<TestProps>({ kind: 'lifecycle', setup: setupSpy });
    const el = clip.render(
      makeCtx<TestProps>({
        width: 640,
        height: 480,
        props: { tag: 'instance' },
      }),
    );
    render(el as React.ReactElement);
    expect(setupSpy).toHaveBeenCalledTimes(1);
    const args = setupSpy.mock.calls[0]?.[0];
    expect(args?.width).toBe(640);
    expect(args?.height).toBe(480);
    expect(args?.props).toEqual({ tag: 'instance' });
    expect(args?.container).toBeInstanceOf(HTMLElement);
  });

  it('calls render on every frame change with expected progress + timeSec', () => {
    const renderSpy = vi.fn<(args: ThreeClipRenderArgs<TestProps>) => void>();
    const clip = defineThreeClip<TestProps>({
      kind: 'render-probe',
      setup: () => ({ render: renderSpy }),
    });
    const first = clip.render(
      makeCtx<TestProps>({
        frame: 0,
        fps: 30,
        clipDurationInFrames: 60,
        props: { tag: 'a' },
      }),
    );
    const { rerender } = render(first as React.ReactElement);
    const second = clip.render(
      makeCtx<TestProps>({
        frame: 15,
        fps: 30,
        clipDurationInFrames: 60,
        props: { tag: 'a' },
      }),
    );
    rerender(second as React.ReactElement);
    // mount + second-frame render at least
    expect(renderSpy).toHaveBeenCalled();
    const lastArgs = renderSpy.mock.calls.at(-1)?.[0];
    expect(lastArgs?.progress).toBeCloseTo(0.25, 6);
    expect(lastArgs?.timeSec).toBeCloseTo(0.5, 6);
    expect(lastArgs?.frame).toBe(15);
    expect(lastArgs?.fps).toBe(30);
    expect(lastArgs?.props).toEqual({ tag: 'a' });
  });

  it('calls dispose on unmount', () => {
    const disposeSpy = vi.fn();
    const clip = defineThreeClip<TestProps>({
      kind: 'dispose-probe',
      setup: () => ({
        render: () => {},
        dispose: disposeSpy,
      }),
    });
    const el = clip.render(makeCtx<TestProps>({ props: { tag: 'x' } }));
    const { unmount } = render(el as React.ReactElement);
    unmount();
    expect(disposeSpy).toHaveBeenCalledTimes(1);
  });

  it('renders a container div with data-stageflip-three', () => {
    const clip = defineThreeClip<TestProps>({
      kind: 'marker',
      setup: () => ({ render: () => {} }),
    });
    const el = clip.render(makeCtx<TestProps>({ props: { tag: 'x' } }));
    const { container } = render(el as React.ReactElement);
    const div = container.querySelector('[data-stageflip-three="true"]');
    expect(div).not.toBeNull();
    expect(div?.tagName).toBe('DIV');
  });

  it('progress is 0 when clipDurationInFrames is Infinity', () => {
    const renderSpy = vi.fn<(args: ThreeClipRenderArgs<TestProps>) => void>();
    const clip = defineThreeClip<TestProps>({
      kind: 'infinite',
      setup: () => ({ render: renderSpy }),
    });
    const el = clip.render(
      makeCtx<TestProps>({
        frame: 1000,
        fps: 30,
        clipDurationInFrames: Number.POSITIVE_INFINITY,
        props: { tag: 'x' },
      }),
    );
    render(el as React.ReactElement);
    const lastArgs = renderSpy.mock.calls.at(-1)?.[0];
    expect(lastArgs?.progress).toBe(0);
    expect(lastArgs?.timeSec).toBeCloseTo(1000 / 30, 6);
  });

  it('setup that throws is a silent no-op (e.g. WebGL unavailable)', () => {
    const clip = defineThreeClip<TestProps>({
      kind: 'throwing-setup',
      setup: () => {
        throw new Error('no webgl');
      },
    });
    const el = clip.render(makeCtx<TestProps>({ props: { tag: 'x' } }));
    expect(() => render(el as React.ReactElement)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Demo clip presence
// ---------------------------------------------------------------------------

describe('threeProductReveal — demo clip', () => {
  it("has the canonical kind 'three-product-reveal'", () => {
    expect(threeProductReveal.kind).toBe('three-product-reveal');
  });

  it('imports without throwing (WebGL setup is deferred until render)', () => {
    // Module import was the only concern — if THREE touched WebGL at
    // import time this assertion would never run.
    expect(threeProductReveal).toBeDefined();
  });
});
