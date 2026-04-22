// packages/runtimes/frame-runtime-bridge/src/index.test.tsx
// Unit tests for the frame-runtime bridge.

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { useCurrentFrame, useVideoConfig } from '@stageflip/frame-runtime';
import {
  type ClipRenderContext,
  type ClipRuntime,
  __clearRuntimeRegistry,
  registerRuntime,
} from '@stageflip/runtimes-contract';

import { createFrameRuntimeBridge, defineFrameClip } from './index.js';

afterEach(() => {
  cleanup();
  __clearRuntimeRegistry();
});

interface TextProps {
  label: string;
}

function Text({ label }: TextProps): React.ReactNode {
  const frame = useCurrentFrame();
  const cfg = useVideoConfig();
  return (
    <span data-testid="text">{`${label}@${frame}:${cfg.width}x${cfg.height}@${cfg.fps}/${cfg.durationInFrames}`}</span>
  );
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

describe('createFrameRuntimeBridge — runtime shape', () => {
  it('produces a ClipRuntime with id "frame-runtime" and tier "live"', () => {
    const bridge = createFrameRuntimeBridge();
    expect(bridge.id).toBe('frame-runtime');
    expect(bridge.tier).toBe('live');
    expect(bridge.clips.size).toBe(0);
  });

  it('accepts clips at construction time', () => {
    const clip = defineFrameClip<TextProps>({ kind: 'text', component: Text });
    const bridge = createFrameRuntimeBridge([clip]);
    expect(bridge.clips.size).toBe(1);
    expect(bridge.clips.get('text')).toBe(clip);
  });

  it('throws on duplicate kind', () => {
    const a = defineFrameClip<TextProps>({ kind: 'dup', component: Text });
    const b = defineFrameClip<TextProps>({ kind: 'dup', component: Text });
    expect(() => createFrameRuntimeBridge([a, b])).toThrow(/duplicate/);
  });

  it('registers cleanly with the contract registry', () => {
    const clip = defineFrameClip<TextProps>({ kind: 'text', component: Text });
    const bridge = createFrameRuntimeBridge([clip]);
    registerRuntime(bridge);
    // round-trip sanity
    const got = (bridge as ClipRuntime).clips.get('text');
    expect(got).toBe(clip);
  });
});

describe('defineFrameClip — render wraps in FrameProvider with remapped frame', () => {
  it('useCurrentFrame() inside the clip returns frame - clipFrom', () => {
    const clip = defineFrameClip<TextProps>({ kind: 'text', component: Text });
    const element = clip.render(
      makeCtx<TextProps>({ frame: 25, clipFrom: 10, props: { label: 'x' } }),
    );
    expect(element).not.toBeNull();
    const { getByTestId } = render(element as React.ReactElement);
    // inner frame = 25 - 10 = 15
    expect(getByTestId('text').textContent).toBe('x@15:1920x1080@30/60');
  });

  it('useVideoConfig() inside the clip exposes clipDurationInFrames as durationInFrames', () => {
    const clip = defineFrameClip<TextProps>({ kind: 'text', component: Text });
    const element = clip.render(
      makeCtx<TextProps>({
        frame: 0,
        clipFrom: 0,
        clipDurationInFrames: 90,
        width: 640,
        height: 480,
        fps: 24,
        props: { label: 'x' },
      }),
    );
    const { getByTestId } = render(element as React.ReactElement);
    expect(getByTestId('text').textContent).toBe('x@0:640x480@24/90');
  });

  it('props are passed through to the wrapped component', () => {
    const clip = defineFrameClip<TextProps>({ kind: 'text', component: Text });
    const element = clip.render(makeCtx<TextProps>({ props: { label: 'hello' } }));
    const { getByTestId } = render(element as React.ReactElement);
    expect(getByTestId('text').textContent).toBe('hello@0:1920x1080@30/60');
  });
});

describe('defineFrameClip — window gating', () => {
  it('returns null when frame is before the clip window', () => {
    const clip = defineFrameClip<TextProps>({ kind: 'text', component: Text });
    const element = clip.render(
      makeCtx<TextProps>({ frame: 4, clipFrom: 5, props: { label: 'x' } }),
    );
    expect(element).toBeNull();
  });

  it('returns null when frame is at the exclusive end of the clip window', () => {
    const clip = defineFrameClip<TextProps>({ kind: 'text', component: Text });
    const element = clip.render(
      makeCtx<TextProps>({
        frame: 10,
        clipFrom: 5,
        clipDurationInFrames: 5,
        props: { label: 'x' },
      }),
    );
    expect(element).toBeNull();
  });

  it('renders at frame === clipFrom (inclusive start)', () => {
    const clip = defineFrameClip<TextProps>({ kind: 'text', component: Text });
    const element = clip.render(
      makeCtx<TextProps>({ frame: 5, clipFrom: 5, props: { label: 'x' } }),
    );
    expect(element).not.toBeNull();
  });

  it('renders at the last frame of the clip window', () => {
    const clip = defineFrameClip<TextProps>({ kind: 'text', component: Text });
    const element = clip.render(
      makeCtx<TextProps>({
        frame: 9,
        clipFrom: 5,
        clipDurationInFrames: 5,
        props: { label: 'x' },
      }),
    );
    expect(element).not.toBeNull();
  });

  it('Infinity duration keeps the clip mounted at any frame past clipFrom', () => {
    const clip = defineFrameClip<TextProps>({ kind: 'text', component: Text });
    const element = clip.render(
      makeCtx<TextProps>({
        frame: 1_000_000,
        clipFrom: 0,
        clipDurationInFrames: Number.POSITIVE_INFINITY,
        props: { label: 'forever' },
      }),
    );
    expect(element).not.toBeNull();
  });
});

describe('defineFrameClip — fontRequirements passthrough', () => {
  it('forwards user-declared fontRequirements onto the ClipDefinition', () => {
    const clip = defineFrameClip<TextProps>({
      kind: 'text',
      component: Text,
      fontRequirements: (props) => [{ family: props.label }],
    });
    expect(clip.fontRequirements?.({ label: 'Inter' })).toEqual([{ family: 'Inter' }]);
  });

  it('omits the fontRequirements field when not declared', () => {
    const clip = defineFrameClip<TextProps>({ kind: 'text', component: Text });
    expect(clip.fontRequirements).toBeUndefined();
  });
});

describe('defineFrameClip — propsSchema + themeSlots passthrough (T-131b.1)', () => {
  it('forwards propsSchema onto the produced ClipDefinition', () => {
    const schema = z.object({ label: z.string() }).strict();
    const clip = defineFrameClip<z.infer<typeof schema>>({
      kind: 'with-schema',
      component: Text as unknown as React.ComponentType<z.infer<typeof schema>>,
      propsSchema: schema,
    });
    expect(clip.propsSchema).toBe(schema);
  });

  it('forwards themeSlots onto the produced ClipDefinition', () => {
    const slots = { label: { kind: 'palette' as const, role: 'primary' as const } };
    const clip = defineFrameClip<TextProps>({
      kind: 'with-slots',
      component: Text,
      themeSlots: slots,
    });
    expect(clip.themeSlots).toBe(slots);
  });

  it('omits both fields when not declared', () => {
    const clip = defineFrameClip<TextProps>({ kind: 'bare', component: Text });
    expect(clip.propsSchema).toBeUndefined();
    expect(clip.themeSlots).toBeUndefined();
  });
});
