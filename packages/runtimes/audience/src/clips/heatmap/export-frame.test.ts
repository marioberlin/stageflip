// packages/runtimes/audience/src/clips/heatmap/export-frame.test.ts
// T-472 — Tests for the heatmap SVG export-frame emitter.

import type { HeatmapAggregation } from '@stageflip/audience-contract';
import type { HeatmapClipElement } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';

import { colormap, formatTotalTapsLabel, renderHeatmapExportFrame } from './export-frame.js';

const ELEMENT: HeatmapClipElement = {
  id: 'el-9',
  transform: { x: 0, y: 0, width: 1280, height: 720, rotation: 0, opacity: 1 },
  visible: true,
  locked: false,
  animations: [],
  type: 'heatmap',
  permissions: ['audience-network'],
  props: {
    prompt: 'Where did you click?',
    imageRef: 'cache://img',
    maxIntensity: 1,
    gridResolution: { w: 64, h: 36 },
  },
};

const SNAPSHOT: HeatmapAggregation = {
  kind: 'heatmap',
  taps: [
    { x: 0.25, y: 0.5, intensity: 1 },
    { x: 0.75, y: 0.5, intensity: 2 },
  ],
  totalTaps: 2,
  gridResolution: { w: 64, h: 36 },
};

describe('formatTotalTapsLabel', () => {
  it('singular at 1', () => {
    expect(formatTotalTapsLabel(1)).toBe('1 tap');
  });
  it('plural otherwise', () => {
    expect(formatTotalTapsLabel(2)).toBe('2 taps');
  });
});

describe('colormap', () => {
  it('returns rgb(0, 0, 0) for v <= 0', () => {
    expect(colormap(0)).toBe('rgb(0, 0, 0)');
  });
  it('returns red at the top of the ramp', () => {
    expect(colormap(1)).toBe('rgb(255, 0, 0)');
  });
  it('interpolates blue→green in the first bucket', () => {
    const out = colormap(0.125);
    expect(out).toContain('rgb(0');
  });
});

describe('renderHeatmapExportFrame', () => {
  it('emits a well-formed SVG', () => {
    const out = renderHeatmapExportFrame(SNAPSHOT, ELEMENT);
    expect(out.svg.startsWith('<svg ')).toBe(true);
    expect(out.svg.endsWith('</svg>')).toBe(true);
    expect(out.svg).toContain('viewBox="0 0 1280 720"');
  });

  it('renders one circle per tap', () => {
    const out = renderHeatmapExportFrame(SNAPSHOT, ELEMENT);
    const matches = out.svg.match(/<circle/g);
    expect(matches?.length).toBe(2);
  });

  it('renders a "Waiting" placeholder when there are no taps', () => {
    const out = renderHeatmapExportFrame(
      { kind: 'heatmap', taps: [], totalTaps: 0, gridResolution: { w: 64, h: 36 } },
      ELEMENT,
    );
    expect(out.svg).toContain('Waiting for taps');
    expect(out.svg).not.toContain('<circle');
  });

  it('renders the prompt and total label', () => {
    const out = renderHeatmapExportFrame(SNAPSHOT, ELEMENT);
    expect(out.svg).toContain('Where did you click?');
    expect(out.svg).toContain('2 taps');
  });

  it('is byte-deterministic', () => {
    const a = renderHeatmapExportFrame(SNAPSHOT, ELEMENT);
    const b = renderHeatmapExportFrame(SNAPSHOT, ELEMENT);
    expect(a.svg).toBe(b.svg);
  });
});
