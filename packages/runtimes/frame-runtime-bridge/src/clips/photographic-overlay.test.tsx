// packages/runtimes/frame-runtime-bridge/src/clips/photographic-overlay.test.tsx
// T-321d — PhotographicOverlay clip behaviour + propsSchema +
// per-mode SVG filter primitives + alpha-blend chain + static-render
// determinism. Mirrors the structural posture of `grain.test.tsx`
// (single-object schema, no `discriminatedUnion`, byte-stable render
// output). Static (no frame counter); per D-T321d-8 the clip is a
// constant render given (mode, intensity, position).

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

// Import the barrel first to avoid the circular-import order issue
// (mirrors the workaround documented in `grain.test.tsx` /
// `qr-code-bounce.test.tsx` / `link-sticker.test.tsx`).
import {
  ALL_BRIDGE_CLIPS,
  PhotographicOverlay,
  type PhotographicOverlayProps,
  photographicOverlayClip,
  photographicOverlayPropsSchema,
} from './index.js';

afterEach(cleanup);

const MIN_PROPS: PhotographicOverlayProps = { mode: 'sepia' };

function renderAt(
  frame: number,
  props: PhotographicOverlayProps,
  config: { width?: number; height?: number; fps?: number; durationInFrames?: number } = {},
) {
  // Cluster D canon — 24 fps cinematic; 1920 × 1080 16:9.
  const { width = 1920, height = 1080, fps = 24, durationInFrames = 1200 } = config;
  return render(
    <FrameProvider frame={frame} config={{ width, height, fps, durationInFrames }}>
      <PhotographicOverlay {...props} />
    </FrameProvider>,
  );
}

describe('photographicOverlayPropsSchema — sealed mode enum', () => {
  it('accepts each of the 4 sealed modes', () => {
    for (const mode of ['sepia', 'cross-process', 'cinematic-lut', 'fade'] as const) {
      expect(photographicOverlayPropsSchema.safeParse({ mode }).success).toBe(true);
    }
  });

  it('rejects unknown modes (sealed enum)', () => {
    expect(photographicOverlayPropsSchema.safeParse({ mode: 'unknown' }).success).toBe(false);
    expect(photographicOverlayPropsSchema.safeParse({ mode: 'noir' }).success).toBe(false);
    expect(photographicOverlayPropsSchema.safeParse({ mode: 'kodachrome' }).success).toBe(false);
  });

  it('rejects missing mode (required)', () => {
    expect(photographicOverlayPropsSchema.safeParse({}).success).toBe(false);
  });
});

describe('photographicOverlayPropsSchema — field rejections', () => {
  it('accepts intensity in [0, 1]', () => {
    expect(photographicOverlayPropsSchema.safeParse({ mode: 'sepia', intensity: 0 }).success).toBe(
      true,
    );
    expect(
      photographicOverlayPropsSchema.safeParse({ mode: 'sepia', intensity: 0.5 }).success,
    ).toBe(true);
    expect(photographicOverlayPropsSchema.safeParse({ mode: 'sepia', intensity: 1 }).success).toBe(
      true,
    );
  });

  it('rejects out-of-range intensity (< 0 or > 1)', () => {
    expect(
      photographicOverlayPropsSchema.safeParse({ mode: 'sepia', intensity: -0.1 }).success,
    ).toBe(false);
    expect(
      photographicOverlayPropsSchema.safeParse({ mode: 'sepia', intensity: 1.1 }).success,
    ).toBe(false);
  });

  it('rejects out-of-range position', () => {
    expect(
      photographicOverlayPropsSchema.safeParse({
        mode: 'sepia',
        position: { x: 0, y: 0, width: 0, height: 1080 },
      }).success,
    ).toBe(false);
    expect(
      photographicOverlayPropsSchema.safeParse({
        mode: 'sepia',
        position: { x: 0, y: 0, width: 1921, height: 1080 },
      }).success,
    ).toBe(false);
    expect(
      photographicOverlayPropsSchema.safeParse({
        mode: 'sepia',
        position: { x: 0, y: 0, width: 1920, height: 1081 },
      }).success,
    ).toBe(false);
  });

  it('rejects extra unknown field (strict mode)', () => {
    expect(photographicOverlayPropsSchema.safeParse({ mode: 'sepia', mystery: true }).success).toBe(
      false,
    );
  });

  it('accepts a fully-specified payload', () => {
    expect(
      photographicOverlayPropsSchema.safeParse({
        mode: 'cinematic-lut',
        intensity: 0.7,
        position: { x: 0, y: 0, width: 1920, height: 1080 },
      }).success,
    ).toBe(true);
  });
});

describe('<PhotographicOverlay> render — defaults + region', () => {
  it('renders an absolutely-positioned <svg> at the configured region', () => {
    renderAt(0, { mode: 'sepia', position: { x: 100, y: 200, width: 320, height: 240 } });
    const svg = screen.getByTestId('photographic-overlay');
    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect((svg as HTMLElement).style.left).toBe('100px');
    expect((svg as HTMLElement).style.top).toBe('200px');
    expect((svg as HTMLElement).style.width).toBe('320px');
    expect((svg as HTMLElement).style.height).toBe('240px');
    expect((svg as HTMLElement).style.position).toBe('absolute');
  });

  it('fills the full canvas when position is absent (defaults via useVideoConfig)', () => {
    renderAt(0, MIN_PROPS);
    const svg = screen.getByTestId('photographic-overlay');
    expect(svg.getAttribute('width')).toBe('1920');
    expect(svg.getAttribute('height')).toBe('1080');
    expect((svg as HTMLElement).style.left).toBe('0px');
    expect((svg as HTMLElement).style.top).toBe('0px');
  });

  it('records mode + intensity on the svg dataset', () => {
    renderAt(0, { mode: 'fade', intensity: 0.5 });
    const svg = screen.getByTestId('photographic-overlay');
    expect((svg as HTMLElement).dataset.mode).toBe('fade');
    expect((svg as HTMLElement).dataset.intensity).toBe('0.5');
  });

  it('defaults intensity to 1 when prop absent', () => {
    renderAt(0, MIN_PROPS);
    const svg = screen.getByTestId('photographic-overlay');
    expect((svg as HTMLElement).dataset.intensity).toBe('1');
  });
});

describe('<PhotographicOverlay> render — per-mode SVG filter primitives', () => {
  it("'sepia' renders a <feColorMatrix type='matrix'> with the canonical 5×4 sepia values", () => {
    const { container } = renderAt(0, { mode: 'sepia' });
    const matrix = container.querySelector('feColorMatrix');
    expect(matrix).not.toBeNull();
    expect(matrix?.getAttribute('type')).toBe('matrix');
    const values = matrix?.getAttribute('values') ?? '';
    expect(values).toContain('0.393');
    expect(values).toContain('0.769');
    expect(values).toContain('0.189');
    expect(values).toContain('0.349');
    expect(values).toContain('0.686');
    expect(values).toContain('0.272');
  });

  it("'cinematic-lut' renders a <feColorMatrix> with teal-and-orange values", () => {
    const { container } = renderAt(0, { mode: 'cinematic-lut' });
    const matrix = container.querySelector('feColorMatrix');
    expect(matrix).not.toBeNull();
    const values = matrix?.getAttribute('values') ?? '';
    expect(values).toContain('1.10');
    expect(values).toContain('1.05');
    expect(values).toContain('-0.05');
  });

  it("'cross-process' renders <feComponentTransfer> with R/G/B table tableValues", () => {
    const { container } = renderAt(0, { mode: 'cross-process' });
    const xfer = container.querySelector('feComponentTransfer');
    expect(xfer).not.toBeNull();
    const r = xfer?.querySelector('feFuncR');
    const g = xfer?.querySelector('feFuncG');
    const b = xfer?.querySelector('feFuncB');
    expect(r?.getAttribute('type')).toBe('table');
    expect(r?.getAttribute('tableValues')).toBe('0.1 0.2 0.5 0.8 1.0');
    expect(g?.getAttribute('tableValues')).toBe('0.0 0.3 0.5 0.7 1.0');
    expect(b?.getAttribute('tableValues')).toBe('0.2 0.4 0.6 0.7 0.9');
  });

  it("'fade' renders <feComponentTransfer> with R/G/B linear slope+intercept", () => {
    const { container } = renderAt(0, { mode: 'fade' });
    const xfer = container.querySelector('feComponentTransfer');
    expect(xfer).not.toBeNull();
    const r = xfer?.querySelector('feFuncR');
    expect(r?.getAttribute('type')).toBe('linear');
    expect(r?.getAttribute('slope')).toBe('0.85');
    expect(r?.getAttribute('intercept')).toBe('0.1');
    const g = xfer?.querySelector('feFuncG');
    expect(g?.getAttribute('slope')).toBe('0.85');
    const b = xfer?.querySelector('feFuncB');
    expect(b?.getAttribute('slope')).toBe('0.85');
  });

  it("pins color-interpolation-filters='sRGB' on every filter element", () => {
    for (const mode of ['sepia', 'cross-process', 'cinematic-lut', 'fade'] as const) {
      cleanup();
      const { container } = renderAt(0, { mode });
      // Filter element itself
      const filter = container.querySelector('filter');
      expect(filter?.getAttribute('color-interpolation-filters')).toBe('sRGB');
      // The primary primitive (feColorMatrix or feComponentTransfer)
      const primitive =
        container.querySelector('filter > feColorMatrix') ??
        container.querySelector('filter > feComponentTransfer');
      expect(primitive?.getAttribute('color-interpolation-filters')).toBe('sRGB');
    }
  });
});

describe('<PhotographicOverlay> render — alpha-blend chain', () => {
  it('does NOT emit <feMerge> when intensity is 1 (full filter; no blend)', () => {
    const { container } = renderAt(0, { mode: 'sepia', intensity: 1 });
    expect(container.querySelector('feMerge')).toBeNull();
  });

  it('emits a <feMerge> chain when intensity < 1 (partial blend)', () => {
    const { container } = renderAt(0, { mode: 'sepia', intensity: 0.5 });
    const merge = container.querySelector('feMerge');
    expect(merge).not.toBeNull();
    const nodes = merge?.querySelectorAll('feMergeNode');
    expect(nodes?.length).toBe(2);
    expect(nodes?.[0]?.getAttribute('in')).toBe('SourceGraphic');
    expect(nodes?.[1]?.getAttribute('in')).toBe('blended');
  });

  it("encodes the intensity as the alpha row of a <feColorMatrix in='filtered' result='blended'>", () => {
    const { container } = renderAt(0, { mode: 'sepia', intensity: 0.3 });
    const blended = container.querySelector('feColorMatrix[result="blended"]');
    expect(blended).not.toBeNull();
    expect(blended?.getAttribute('in')).toBe('filtered');
    const values = blended?.getAttribute('values') ?? '';
    // The alpha row coefficient should equal intensity (0.3).
    expect(values).toContain('0.3');
  });

  it('skips <feMerge> at intensity 0 boundary still treated as < 1 (alpha 0 fully transparent overlay)', () => {
    const { container } = renderAt(0, { mode: 'sepia', intensity: 0 });
    expect(container.querySelector('feMerge')).not.toBeNull();
  });
});

describe('<PhotographicOverlay> render — static (no frame-driven state)', () => {
  it('renders byte-identical SVG markup at frame 0 / 60 / 120 for the same props', () => {
    const props: PhotographicOverlayProps = { mode: 'sepia', intensity: 0.5 };
    const { container: a } = renderAt(0, props);
    const html0 = a.innerHTML;
    cleanup();
    const { container: b } = renderAt(60, props);
    const html60 = b.innerHTML;
    cleanup();
    const { container: c } = renderAt(120, props);
    const html120 = c.innerHTML;
    expect(html0).toBe(html60);
    expect(html60).toBe(html120);
  });

  it('renders byte-identical SVG markup for the same props on repeat render', () => {
    const props: PhotographicOverlayProps = { mode: 'cross-process', intensity: 0.7 };
    const { container: a } = renderAt(0, props);
    const htmlA = a.innerHTML;
    cleanup();
    const { container: b } = renderAt(0, props);
    const htmlB = b.innerHTML;
    expect(htmlA).toBe(htmlB);
  });
});

describe('clip registration', () => {
  it('registers as kind "photographic-overlay" and is in ALL_BRIDGE_CLIPS at length 58', () => {
    expect(photographicOverlayClip.kind).toBe('photographic-overlay');
    expect(ALL_BRIDGE_CLIPS).toHaveLength(58);
    expect(ALL_BRIDGE_CLIPS).toContain(photographicOverlayClip);
  });

  it('declares no fontRequirements (per D-T321d — no text surface)', () => {
    expect(photographicOverlayClip.fontRequirements).toBeUndefined();
  });

  it('declares empty themeSlots (per D-T321d-9 — modes are tonal canon, not brand canvas)', () => {
    expect(photographicOverlayClip.themeSlots).toEqual({});
  });
});
