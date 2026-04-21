// packages/runtimes/css/src/index.test.tsx
// Unit tests for the css runtime.

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { ClipRenderContext } from '@stageflip/runtimes-contract';

import { createCssRuntime, defineCssClip, solidBackgroundClip } from './index.js';

afterEach(cleanup);

interface BgProps {
  color: string;
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

describe('createCssRuntime — runtime shape', () => {
  it("produces a ClipRuntime with id 'css' and tier 'live'", () => {
    const rt = createCssRuntime();
    expect(rt.id).toBe('css');
    expect(rt.tier).toBe('live');
    expect(rt.clips.size).toBe(0);
  });

  it('accepts clips at construction time', () => {
    const clip = defineCssClip<BgProps>({
      kind: 'fill',
      render: ({ color }) => <div style={{ background: color }} />,
    });
    const rt = createCssRuntime([clip]);
    expect(rt.clips.get('fill')).toBe(clip);
  });

  it('throws on duplicate kind', () => {
    const a = defineCssClip<BgProps>({ kind: 'dup', render: () => <div /> });
    const b = defineCssClip<BgProps>({ kind: 'dup', render: () => <div /> });
    expect(() => createCssRuntime([a, b])).toThrow(/duplicate/);
  });
});

describe('defineCssClip — window gating', () => {
  it('returns null before the clip window', () => {
    const clip = defineCssClip<BgProps>({ kind: 'fill', render: () => <div /> });
    const el = clip.render(makeCtx<BgProps>({ frame: 4, clipFrom: 5, props: { color: '#fff' } }));
    expect(el).toBeNull();
  });

  it('returns null at the exclusive end of the clip window', () => {
    const clip = defineCssClip<BgProps>({ kind: 'fill', render: () => <div /> });
    const el = clip.render(
      makeCtx<BgProps>({
        frame: 10,
        clipFrom: 5,
        clipDurationInFrames: 5,
        props: { color: '#fff' },
      }),
    );
    expect(el).toBeNull();
  });

  it('renders inside the window', () => {
    const clip = defineCssClip<BgProps>({
      kind: 'fill',
      render: ({ color }) => <div data-testid="fill" style={{ background: color }} />,
    });
    const el = clip.render(makeCtx<BgProps>({ frame: 5, clipFrom: 5, props: { color: 'red' } }));
    expect(el).not.toBeNull();
    const { getByTestId } = render(el as React.ReactElement);
    expect((getByTestId('fill') as HTMLElement).style.background).toBe('red');
  });
});

describe('defineCssClip — static render signature', () => {
  it('does not expose ClipRenderContext to the render callback', () => {
    let received: unknown = null;
    const clip = defineCssClip<BgProps>({
      kind: 'probe',
      render: (props) => {
        received = props;
        return <div />;
      },
    });
    clip.render(makeCtx<BgProps>({ frame: 30, props: { color: '#fff' } }));
    expect(received).toEqual({ color: '#fff' });
  });

  it('receives the exact same props across different frames (no frame-driven change)', () => {
    const props = { color: 'blue' } as const;
    const snapshots: unknown[] = [];
    const clip = defineCssClip<BgProps>({
      kind: 'snap',
      render: (p) => {
        snapshots.push(p);
        return <div />;
      },
    });
    clip.render(makeCtx<BgProps>({ frame: 0, props }));
    clip.render(makeCtx<BgProps>({ frame: 15, props }));
    clip.render(makeCtx<BgProps>({ frame: 30, props }));
    for (const s of snapshots) {
      expect(s).toEqual({ color: 'blue' });
    }
  });
});

describe('defineCssClip — fontRequirements passthrough', () => {
  it('forwards user-declared fontRequirements', () => {
    const clip = defineCssClip<{ family: string }>({
      kind: 'font-probe',
      render: () => <div />,
      fontRequirements: (props) => [{ family: props.family }],
    });
    expect(clip.fontRequirements?.({ family: 'Inter' })).toEqual([{ family: 'Inter' }]);
  });

  it('omits the field when not declared', () => {
    const clip = defineCssClip<BgProps>({ kind: 'fill', render: () => <div /> });
    expect(clip.fontRequirements).toBeUndefined();
  });
});

describe('solidBackgroundClip — demo clip', () => {
  it("is a ClipDefinition with kind 'solid-background'", () => {
    expect(solidBackgroundClip.kind).toBe('solid-background');
  });

  it('renders an absolutely-positioned div with the given background', () => {
    const el = solidBackgroundClip.render(makeCtx({ props: { color: '#ff00aa' } }));
    const { container } = render(el as React.ReactElement);
    const div = container.querySelector('div') as HTMLElement;
    expect(div).not.toBeNull();
    expect(div.style.background).toBe('#ff00aa');
    expect(div.style.position).toBe('absolute');
    expect(div.style.top).toBe('0px');
    expect(div.style.left).toBe('0px');
    expect(div.style.right).toBe('0px');
    expect(div.style.bottom).toBe('0px');
  });
});
