// packages/runtimes/audience/src/clips/heatmap/static-fallback.test.ts
// T-469 — Static-fallback tests for the `heatmap` clip. Asserts:
//   - Pure-function determinism (same input → structurally-equal trees).
//   - `formatTotalTapsLabel` singular/plural.
//   - Idle-state routing (zero taps + zero totalTaps).
//   - Aggregated-state routing.
//   - `<img>` `src` matches `imageRef` and `alt` matches the prompt.
//   - HeatmapCanvasOverlay effect drives putImageData (covered via a
//     local DOM harness with a stubbed canvas 2D context).

/**
 * @vitest-environment happy-dom
 */

import type { HeatmapAggregation } from '@stageflip/audience-contract';
import { describe, expect, it } from 'vitest';

import { formatTotalTapsLabel, renderHeatmapStaticFallback } from './static-fallback.js';

const FULL_SNAPSHOT: HeatmapAggregation = {
  kind: 'heatmap',
  taps: [
    { x: 0.5, y: 0.5, intensity: 5 },
    { x: 0.3, y: 0.4, intensity: 3 },
  ],
  totalTaps: 8,
  gridResolution: { w: 32, h: 32 },
};

const EMPTY_SNAPSHOT: HeatmapAggregation = {
  kind: 'heatmap',
  taps: [],
  totalTaps: 0,
  gridResolution: { w: 32, h: 32 },
};

const CTX = {
  width: 800,
  height: 600,
  prompt: 'Tap where you focus',
  imageRef: 'https://example.com/img.png',
};

describe('formatTotalTapsLabel', () => {
  it('uses singular for exactly 1 tap', () => {
    expect(formatTotalTapsLabel(1)).toBe('1 tap');
  });
  it('uses plural for 0 / >1 taps', () => {
    expect(formatTotalTapsLabel(0)).toBe('0 taps');
    expect(formatTotalTapsLabel(8)).toBe('8 taps');
  });
});

describe('renderHeatmapStaticFallback — aggregated shape', () => {
  it('returns a ReactElement marked as the heatmap root', () => {
    const out = renderHeatmapStaticFallback({ snapshot: FULL_SNAPSHOT, context: CTX });
    expect(out.type).toBe('div');
    expect((out.props as { 'data-stageflip-clip': string })['data-stageflip-clip']).toBe('heatmap');
    expect((out.props as { 'data-state': string })['data-state']).toBe('aggregated');
  });

  it('is deterministic — same input produces structurally-equal trees', () => {
    const a = renderHeatmapStaticFallback({ snapshot: FULL_SNAPSHOT, context: CTX });
    const b = renderHeatmapStaticFallback({ snapshot: FULL_SNAPSHOT, context: CTX });
    // React function components render to opaque types; serialise via JSON
    // after dropping the function refs.
    const replacer = (_k: string, v: unknown): unknown => (typeof v === 'function' ? '[fn]' : v);
    expect(JSON.stringify(a, replacer)).toEqual(JSON.stringify(b, replacer));
  });

  it('renders the prompt text', () => {
    const out = renderHeatmapStaticFallback({ snapshot: FULL_SNAPSHOT, context: CTX });
    const json = JSON.stringify(out, (_k, v) => (typeof v === 'function' ? '[fn]' : v));
    expect(json).toContain('Tap where you focus');
  });

  it('renders an <img> child with src matching imageRef', () => {
    const out = renderHeatmapStaticFallback({ snapshot: FULL_SNAPSHOT, context: CTX });
    const json = JSON.stringify(out, (_k, v) => (typeof v === 'function' ? '[fn]' : v));
    expect(json).toContain('https://example.com/img.png');
  });

  it('renders the total-taps label with correct plural', () => {
    const out = renderHeatmapStaticFallback({ snapshot: FULL_SNAPSHOT, context: CTX });
    const json = JSON.stringify(out, (_k, v) => (typeof v === 'function' ? '[fn]' : v));
    expect(json).toContain('8 taps');
  });
});

describe('HeatmapCanvasOverlay effect (via static-fallback tree)', () => {
  it('paints into the canvas 2d context via putImageData', async () => {
    // Dynamic import to defer happy-dom env activation to this block.
    // The test mounts the real React tree and stubs the canvas
    // getContext + putImageData to exercise the effect's happy path.
    const { JSDOMReactHarness } = await import('./__harness.js');
    const calls: number[] = [];
    const harness = await JSDOMReactHarness.create({
      onPutImageData: () => {
        calls.push(1);
      },
    });
    harness.render(renderHeatmapStaticFallback({ snapshot: FULL_SNAPSHOT, context: CTX }));
    await harness.flushEffects();
    expect(calls.length).toBeGreaterThan(0);
    harness.dispose();
  });

  it('swallows putImageData errors thrown by limited 2d backends', async () => {
    const { JSDOMReactHarness } = await import('./__harness.js');
    const harness = await JSDOMReactHarness.create({
      onPutImageData: () => {
        throw new Error('not supported in this backend');
      },
    });
    expect(() => {
      harness.render(renderHeatmapStaticFallback({ snapshot: FULL_SNAPSHOT, context: CTX }));
    }).not.toThrow();
    await harness.flushEffects();
    harness.dispose();
  });
});

describe('renderHeatmapStaticFallback — idle shape', () => {
  it('renders the "Waiting…" placeholder when taps + totalTaps are empty', () => {
    const out = renderHeatmapStaticFallback({ snapshot: EMPTY_SNAPSHOT, context: CTX });
    expect((out.props as { 'data-state': string })['data-state']).toBe('waiting');
    const json = JSON.stringify(out, (_k, v) => (typeof v === 'function' ? '[fn]' : v));
    expect(json).toContain('Waiting for taps…');
  });

  it('still renders the <img> child in the idle state', () => {
    const out = renderHeatmapStaticFallback({ snapshot: EMPTY_SNAPSHOT, context: CTX });
    const json = JSON.stringify(out, (_k, v) => (typeof v === 'function' ? '[fn]' : v));
    expect(json).toContain('https://example.com/img.png');
  });

  it('still renders the prompt in the idle state', () => {
    const out = renderHeatmapStaticFallback({ snapshot: EMPTY_SNAPSHOT, context: CTX });
    const json = JSON.stringify(out, (_k, v) => (typeof v === 'function' ? '[fn]' : v));
    expect(json).toContain('Tap where you focus');
  });
});
