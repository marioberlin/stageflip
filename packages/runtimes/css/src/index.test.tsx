// packages/runtimes/css/src/index.test.tsx
// Unit tests for the css runtime.

import type { Theme } from '@stageflip/schema';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  type ClipRenderContext,
  __clearRuntimeRegistry,
  findClip,
  registerRuntime,
  resolveClipDefaultsForTheme,
} from '@stageflip/runtimes-contract';

import {
  type GradientBackgroundProps,
  createCssRuntime,
  defineCssClip,
  gradientBackgroundClip,
  gradientBackgroundPropsSchema,
  solidBackgroundClip,
} from './index.js';

afterEach(() => {
  cleanup();
  __clearRuntimeRegistry();
});

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

describe('css runtime — contract-registry round-trip', () => {
  it('registers cleanly and findClip resolves its demo kind', () => {
    const rt = createCssRuntime([solidBackgroundClip]);
    registerRuntime(rt);
    const found = findClip('solid-background');
    expect(found?.runtime).toBe(rt);
    expect(found?.clip).toBe(solidBackgroundClip);
  });
});

describe('defineCssClip — propsSchema + themeSlots passthrough (T-131a)', () => {
  it('forwards propsSchema onto the produced ClipDefinition', () => {
    const schema = z.object({ label: z.string() }).strict();
    const clip = defineCssClip<z.infer<typeof schema>>({
      kind: 'with-schema',
      render: () => <div />,
      propsSchema: schema,
    });
    expect(clip.propsSchema).toBe(schema);
  });

  it('forwards themeSlots onto the produced ClipDefinition', () => {
    const slots = { bg: { kind: 'palette' as const, role: 'primary' as const } };
    const clip = defineCssClip<{ bg?: string }>({
      kind: 'with-slots',
      render: () => <div />,
      themeSlots: slots,
    });
    expect(clip.themeSlots).toBe(slots);
  });

  it('omits both fields when not declared (no accidental keys)', () => {
    const clip = defineCssClip<BgProps>({ kind: 'bare', render: () => <div /> });
    expect(clip.propsSchema).toBeUndefined();
    expect(clip.themeSlots).toBeUndefined();
  });
});

describe('gradientBackgroundClip — demo clip (T-131a)', () => {
  it("is a ClipDefinition with kind 'gradient-background' and a propsSchema", () => {
    expect(gradientBackgroundClip.kind).toBe('gradient-background');
    expect(gradientBackgroundClip.propsSchema).toBe(gradientBackgroundPropsSchema);
  });

  it('declares themeSlots that bind from→primary and to→background', () => {
    expect(gradientBackgroundClip.themeSlots).toEqual({
      from: { kind: 'palette', role: 'primary' },
      to: { kind: 'palette', role: 'background' },
    });
  });

  it('renders a linear-gradient with the supplied colors and direction', () => {
    const props: GradientBackgroundProps = {
      from: '#ff0000',
      to: '#0000ff',
      direction: 'vertical',
    };
    const el = gradientBackgroundClip.render({
      frame: 0,
      fps: 30,
      width: 1920,
      height: 1080,
      clipFrom: 0,
      clipDurationInFrames: 30,
      props,
    });
    const { container } = render(el as React.ReactElement);
    const div = container.querySelector('div') as HTMLElement;
    expect(div.style.background).toContain('linear-gradient(to bottom');
    expect(div.style.background).toContain('#ff0000');
    expect(div.style.background).toContain('#0000ff');
  });

  it('falls back to deterministic colors when from/to are undefined and no theme is applied', () => {
    const props: GradientBackgroundProps = {
      from: undefined,
      to: undefined,
      direction: 'horizontal',
    };
    const el = gradientBackgroundClip.render({
      frame: 0,
      fps: 30,
      width: 1920,
      height: 1080,
      clipFrom: 0,
      clipDurationInFrames: 30,
      props,
    });
    const { container } = render(el as React.ReactElement);
    const div = container.querySelector('div') as HTMLElement;
    expect(div.style.background).toContain('#0c1116');
    expect(div.style.background).toContain('#ffffff');
  });

  it('requires an explicit direction — Zod default would widen the ZodType<P> input side', () => {
    expect(
      gradientBackgroundPropsSchema.safeParse({ from: '#abcdef', to: '#fedcba' }).success,
    ).toBe(false);
    const parsed = gradientBackgroundPropsSchema.parse({
      from: '#abcdef',
      to: '#fedcba',
      direction: 'vertical',
    });
    expect(parsed.direction).toBe('vertical');
  });

  it('rejects unknown direction values via the propsSchema', () => {
    expect(gradientBackgroundPropsSchema.safeParse({ direction: 'spiral' }).success).toBe(false);
  });

  it('integrates with resolveClipDefaultsForTheme — palette swap re-flows from/to', () => {
    const theme: Theme = {
      palette: { primary: '#0a84ff', background: '#0c1116' },
      tokens: {},
    };
    const resolved = resolveClipDefaultsForTheme(
      gradientBackgroundClip as unknown as Parameters<
        typeof resolveClipDefaultsForTheme<GradientBackgroundProps>
      >[0],
      theme,
      { direction: 'diagonal' } as GradientBackgroundProps,
    );
    expect(resolved.from).toBe('#0a84ff');
    expect(resolved.to).toBe('#0c1116');
    expect(resolved.direction).toBe('diagonal');
  });
});
