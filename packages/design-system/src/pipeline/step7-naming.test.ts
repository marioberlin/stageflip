// packages/design-system/src/pipeline/step7-naming.test.ts
// AC #21-23.

import { describe, expect, it } from 'vitest';
import { hexToLab } from '../color/lab-space.js';
import { buildTestState, makeDoc } from '../test-helpers.js';
import { runStep7 } from './step7-naming.js';

describe('step 7 — token naming', () => {
  it('AC #21: largest cluster → primary', () => {
    const doc = makeDoc([{}]);
    const state = buildTestState(doc);
    // Mid-lightness colors so background/foreground heuristics don't trigger.
    state.paletteClusters = [
      { id: 'c0', centroid: '#cc4444', weight: 10, lab: hexToLab('#cc4444') },
      { id: 'c1', centroid: '#4477bb', weight: 5, lab: hexToLab('#4477bb') },
    ];
    const r = runStep7(state);
    expect(r.paletteNames.c0).toBe('primary');
    expect(r.paletteNames.c1).toBe('secondary');
  });

  it('AC #22: lightness > 0.85 → background, < 0.20 → foreground', () => {
    const doc = makeDoc([{}]);
    const state = buildTestState(doc);
    state.paletteClusters = [
      { id: 'c0', centroid: '#ff0000', weight: 10, lab: hexToLab('#ff0000') },
      { id: 'c1', centroid: '#ffffff', weight: 5, lab: hexToLab('#ffffff') },
      { id: 'c2', centroid: '#000000', weight: 3, lab: hexToLab('#000000') },
    ];
    const r = runStep7(state);
    expect(r.paletteNames.c1).toBe('background');
    expect(r.paletteNames.c2).toBe('foreground');
    expect(r.paletteNames.c0).toBe('primary');
  });

  it('AC #23: equally-large clusters → emits LF-DESIGN-SYSTEM-AMBIGUOUS-CLUSTER', () => {
    const doc = makeDoc([{}]);
    const state = buildTestState(doc);
    state.paletteClusters = [
      { id: 'c0', centroid: '#ff0000', weight: 5, lab: hexToLab('#ff0000') },
      { id: 'c1', centroid: '#0000ff', weight: 5, lab: hexToLab('#0000ff') },
    ];
    const r = runStep7(state);
    expect(r.lossFlags.length).toBe(1);
    expect(r.lossFlags[0]?.code).toBe('LF-DESIGN-SYSTEM-AMBIGUOUS-CLUSTER');
    expect(r.diagnostic.ambiguousClusters).toBe(1);
  });

  it('typography: most-frequent → body', () => {
    const doc = makeDoc([{}]);
    const state = buildTestState(doc);
    state.typographyClusters = [
      {
        id: 't0',
        token: { fontFamily: 'Roboto', fontSize: 12, fontWeight: 400, italic: false },
        weight: 10,
      },
      {
        id: 't1',
        token: { fontFamily: 'Roboto', fontSize: 36, fontWeight: 700, italic: false },
        weight: 2,
      },
    ];
    const r = runStep7(state);
    expect(r.typographyNames.t0).toBe('body');
    expect(r.typographyNames.t1).toBe('display');
  });
});
