// packages/runtimes/gsap/src/index.test.tsx
// Unit tests for the gsap runtime and the motion-text-gsap demo clip.

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ClipRenderContext } from '@stageflip/runtimes-contract';

import {
  type MotionTextGsapProps,
  createGsapRuntime,
  defineGsapClip,
  motionTextGsap,
} from './index.js';

afterEach(cleanup);

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

describe('createGsapRuntime — runtime shape', () => {
  it("produces a ClipRuntime with id 'gsap' and tier 'live'", () => {
    const rt = createGsapRuntime();
    expect(rt.id).toBe('gsap');
    expect(rt.tier).toBe('live');
    expect(rt.clips.size).toBe(0);
  });

  it('accepts clips at construction time', () => {
    const rt = createGsapRuntime([motionTextGsap]);
    expect(rt.clips.get('motion-text-gsap')).toBe(motionTextGsap);
  });

  it('throws on duplicate kind', () => {
    const a = defineGsapClip<MotionTextGsapProps>({
      kind: 'dup',
      render: () => <span />,
      build: () => {
        /* noop */
      },
    });
    const b = defineGsapClip<MotionTextGsapProps>({
      kind: 'dup',
      render: () => <span />,
      build: () => {
        /* noop */
      },
    });
    expect(() => createGsapRuntime([a, b])).toThrow(/duplicate/);
  });
});

describe('defineGsapClip — window gating', () => {
  const noopBuild: Parameters<typeof defineGsapClip<MotionTextGsapProps>>[0]['build'] = () => {
    /* noop */
  };

  it('returns null before the clip window', () => {
    const clip = defineGsapClip<MotionTextGsapProps>({
      kind: 'gated',
      render: () => <span />,
      build: noopBuild,
    });
    const el = clip.render(
      makeCtx<MotionTextGsapProps>({ frame: 4, clipFrom: 5, props: { text: 'x' } }),
    );
    expect(el).toBeNull();
  });

  it('returns null at the exclusive end of the clip window', () => {
    const clip = defineGsapClip<MotionTextGsapProps>({
      kind: 'gated',
      render: () => <span />,
      build: noopBuild,
    });
    const el = clip.render(
      makeCtx<MotionTextGsapProps>({
        frame: 10,
        clipFrom: 5,
        clipDurationInFrames: 5,
        props: { text: 'x' },
      }),
    );
    expect(el).toBeNull();
  });

  it('renders at inclusive start', () => {
    const clip = defineGsapClip<MotionTextGsapProps>({
      kind: 'gated',
      render: () => <span data-testid="t" />,
      build: noopBuild,
    });
    const el = clip.render(
      makeCtx<MotionTextGsapProps>({ frame: 5, clipFrom: 5, props: { text: 'x' } }),
    );
    expect(el).not.toBeNull();
  });
});

describe('defineGsapClip — timeline lifecycle', () => {
  it('calls build() exactly once per mount with a paused timeline', () => {
    const build = vi.fn((props, timeline, _container) => {
      // The timeline GSAP hands us should be paused — isActive === false when
      // nothing is playing.
      expect(timeline.paused()).toBe(true);
      expect(props).toEqual({ text: 'hello' });
    });
    const clip = defineGsapClip<MotionTextGsapProps>({
      kind: 'lifecycle-probe',
      render: (props) => <span data-testid="t">{props.text}</span>,
      build,
    });
    const el = clip.render(makeCtx<MotionTextGsapProps>({ props: { text: 'hello' } }));
    render(el as React.ReactElement);
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('render(props) receives the clip props', () => {
    const clip = defineGsapClip<MotionTextGsapProps>({
      kind: 'render-probe',
      render: (props) => <span data-testid="t">{props.text}</span>,
      build: () => {
        /* noop */
      },
    });
    const el = clip.render(makeCtx<MotionTextGsapProps>({ props: { text: 'probe-text' } }));
    const { getByTestId } = render(el as React.ReactElement);
    expect(getByTestId('t').textContent).toBe('probe-text');
  });
});

describe('motionTextGsap — demo clip', () => {
  it("has the canonical kind 'motion-text-gsap'", () => {
    expect(motionTextGsap.kind).toBe('motion-text-gsap');
  });

  it('renders a span carrying the supplied text', () => {
    const el = motionTextGsap.render(makeCtx({ props: { text: 'hello world' } }));
    const { container } = render(el as React.ReactElement);
    const span = container.querySelector('[data-motion-text]') as HTMLElement | null;
    expect(span).not.toBeNull();
    expect(span?.textContent).toBe('hello world');
  });

  it('inlines the expected typographic styles', () => {
    const el = motionTextGsap.render(makeCtx({ props: { text: 'x' } }));
    const { container } = render(el as React.ReactElement);
    const span = container.querySelector('[data-motion-text]') as HTMLElement;
    expect(span.style.fontSize).toBe('96px');
    expect(span.style.fontWeight).toBe('700');
    expect(span.style.color).toBe('#fff');
  });
});
