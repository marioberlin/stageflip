// packages/runtimes/frame-runtime-bridge/src/clips/gif-player.test.tsx
// T-131e.1 — gifPlayerClip behaviour + propsSchema + themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { resolveClipDefaultsForTheme } from '@stageflip/runtimes-contract';
import type { Theme } from '@stageflip/schema';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  GifPlayer,
  type GifPlayerProps,
  gifPlayerClip,
  gifPlayerPropsSchema,
} from './gif-player.js';

afterEach(cleanup);

function renderAt(frame: number, props: GifPlayerProps, durationInFrames = 90) {
  return render(
    <FrameProvider frame={frame} config={{ width: 640, height: 360, fps: 30, durationInFrames }}>
      <GifPlayer {...props} />
    </FrameProvider>,
  );
}

describe('GifPlayer component (T-131e.1)', () => {
  it('renders an <img> pointing at src when src is provided', () => {
    const { container } = renderAt(30, { src: '/animated.gif' });
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('/animated.gif');
  });

  it('renders a placeholder when src is empty', () => {
    renderAt(0, { src: '' });
    expect(screen.getByTestId('gif-player-placeholder')).toBeDefined();
  });

  it('fades in over frames 0..15 on the outer container', () => {
    renderAt(0, { src: '/a.gif' });
    const outer0 = screen.getByTestId('gif-player') as HTMLElement;
    expect(Number(outer0.style.opacity)).toBe(0);
    cleanup();
    renderAt(15, { src: '/a.gif' });
    const outer1 = screen.getByTestId('gif-player') as HTMLElement;
    expect(Number(outer1.style.opacity)).toBe(1);
  });

  it('scales up from 0.9 → 1.0 over frames 0..20 on the inner wrapper', () => {
    renderAt(0, { src: '/a.gif' });
    const inner0 = screen.getByTestId('gif-player-wrapper') as HTMLElement;
    expect(inner0.style.transform).toContain('scale(0.9)');
    cleanup();
    renderAt(20, { src: '/a.gif' });
    const inner1 = screen.getByTestId('gif-player-wrapper') as HTMLElement;
    expect(inner1.style.transform).toContain('scale(1)');
  });

  it('renders a title when supplied', () => {
    renderAt(30, { src: '/a.gif', title: 'Demo' });
    expect(screen.getByTestId('gif-player-title').textContent).toBe('Demo');
  });

  it('omits the title when absent', () => {
    renderAt(30, { src: '/a.gif' });
    expect(screen.queryByTestId('gif-player-title')).toBeNull();
  });

  it('applies objectFit from the fit prop', () => {
    const { container } = renderAt(30, { src: '/a.gif', fit: 'cover' });
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.style.objectFit).toBe('cover');
  });

  it('defaults fit to "contain" when omitted', () => {
    const { container } = renderAt(30, { src: '/a.gif' });
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.style.objectFit).toBe('contain');
  });
});

describe('gifPlayerClip definition (T-131e.1)', () => {
  it("registers under kind 'gif-player' with a propsSchema", () => {
    expect(gifPlayerClip.kind).toBe('gif-player');
    expect(gifPlayerClip.propsSchema).toBe(gifPlayerPropsSchema);
  });

  it('declares themeSlots binding backgroundColor → background, titleColor → foreground', () => {
    expect(gifPlayerClip.themeSlots).toEqual({
      backgroundColor: { kind: 'palette', role: 'background' },
      titleColor: { kind: 'palette', role: 'foreground' },
    });
  });

  it('font requirements are conditional on the title prop (avoid preloading an unused font)', () => {
    expect(gifPlayerClip.fontRequirements?.({}) ?? []).toEqual([]);
    expect(gifPlayerClip.fontRequirements?.({ title: 'Demo' }) ?? []).toEqual([
      { family: 'Plus Jakarta Sans', weight: 700 },
    ]);
  });

  it('propsSchema accepts an empty-props payload (all optional)', () => {
    expect(gifPlayerPropsSchema.safeParse({}).success).toBe(true);
  });

  it('propsSchema rejects unknown fit values', () => {
    expect(gifPlayerPropsSchema.safeParse({ src: '/a.gif', fit: 'bogus' }).success).toBe(false);
  });

  it('propsSchema rejects unknown props (strict mode)', () => {
    expect(gifPlayerPropsSchema.safeParse({ bogus: true }).success).toBe(false);
  });

  it('integrates with resolveClipDefaultsForTheme — palette swap re-flows background + title', () => {
    const theme: Theme = {
      palette: { background: '#080f15', foreground: '#ebf1fa' },
      tokens: {},
    };
    const out = resolveClipDefaultsForTheme(
      gifPlayerClip as unknown as Parameters<typeof resolveClipDefaultsForTheme<GifPlayerProps>>[0],
      theme,
      { src: '/a.gif' } as GifPlayerProps,
    );
    expect(out.backgroundColor).toBe('#080f15');
    expect(out.titleColor).toBe('#ebf1fa');
  });
});
