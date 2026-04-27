// packages/export-google-slides/src/diff/observe.test.ts
// Pins region-to-element matching: nearby-region union, no-overlap
// fallback to canonical bbox.

import type { Element } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';
import type { DiffRegion } from './connected-components.js';
import { deriveObservations } from './observe.js';

function shape(id: string, x: number, y: number, w: number, h: number): Element {
  return {
    id,
    type: 'shape',
    shape: 'rect',
    transform: { x, y, width: w, height: h, rotation: 0, opacity: 1 },
    visible: true,
    locked: false,
    animations: [],
  } as Element;
}

describe('deriveObservations', () => {
  it('no regions → every element observed at canonical bbox (zero delta)', () => {
    const els = { e1: shape('e1', 100, 100, 50, 30) };
    const obs = deriveObservations({ elementsById: els, regions: [] });
    expect(obs).toHaveLength(1);
    expect(obs[0]).toMatchObject({ elementId: 'e1', x: 100, y: 100, width: 50, height: 30 });
  });

  it('region inside element bbox unions to a wider observed', () => {
    const els = { e1: shape('e1', 100, 100, 50, 30) };
    const region: DiffRegion = {
      label: 1,
      x: 105,
      y: 100,
      width: 60,
      height: 30,
      pixelCount: 1500,
    };
    const obs = deriveObservations({ elementsById: els, regions: [region] });
    expect(obs[0]).toMatchObject({
      elementId: 'e1',
      x: 100, // min(100, 105)
      y: 100,
      width: 65, // 105+60-100 = 65
      height: 30,
    });
  });

  it('region far outside expansion radius → element observed at canonical bbox', () => {
    const els = { e1: shape('e1', 100, 100, 50, 30) };
    const distant: DiffRegion = {
      label: 1,
      x: 800,
      y: 800,
      width: 10,
      height: 10,
      pixelCount: 100,
    };
    const obs = deriveObservations({ elementsById: els, regions: [distant], expansionPx: 32 });
    expect(obs[0]).toMatchObject({ elementId: 'e1', x: 100, y: 100, width: 50, height: 30 });
  });

  it('horizontal-shift case: left strip + right strip union to a shifted observed bbox', () => {
    const els = { e1: shape('e1', 100, 100, 200, 50) };
    // The classical "shifted by 30 px right" diff signal: golden's left
    // edge becomes a left-strip diff, api's right-edge spillover becomes
    // a right-strip diff.
    const leftStrip: DiffRegion = {
      label: 1,
      x: 100,
      y: 100,
      width: 30,
      height: 50,
      pixelCount: 1500,
    };
    const rightStrip: DiffRegion = {
      label: 2,
      x: 300,
      y: 100,
      width: 30,
      height: 50,
      pixelCount: 1500,
    };
    const obs = deriveObservations({ elementsById: els, regions: [leftStrip, rightStrip] });
    // Both regions' centers fall within expanded bbox; observed unions
    // to (100, 100, 230, 50).
    expect(obs[0]).toMatchObject({ elementId: 'e1', x: 100, y: 100, width: 230, height: 50 });
  });

  it('multiple elements: each gets its own observed (regions only contribute to overlapping element)', () => {
    const els = {
      e1: shape('e1', 100, 100, 50, 30),
      e2: shape('e2', 800, 800, 50, 30),
    };
    const region: DiffRegion = {
      label: 1,
      x: 105,
      y: 105,
      width: 30,
      height: 30,
      pixelCount: 900,
    };
    const obs = deriveObservations({ elementsById: els, regions: [region] });
    const e1 = obs.find((o) => o.elementId === 'e1');
    const e2 = obs.find((o) => o.elementId === 'e2');
    expect(e1?.width).toBe(50); // unchanged width — region within bbox
    expect(e1?.height).toBe(35); // 105+30-100 = 35
    expect(e2).toMatchObject({ x: 800, y: 800, width: 50, height: 30 }); // canonical
  });
});
