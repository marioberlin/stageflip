// packages/design-system/src/pipeline/step8-writeback.test.ts
// AC #24-26.

import { describe, expect, it } from 'vitest';
import { hexToLab } from '../color/lab-space.js';
import { buildTestState, makeDoc } from '../test-helpers.js';
import { runStep8 } from './step8-writeback.js';

describe('step 8 — writeback', () => {
  it('AC #24: shape fill matching a centroid → theme:color.<token> ref', () => {
    const doc = makeDoc([{ fills: ['#ff0000'] }]);
    const state = buildTestState(doc);
    state.paletteClusters = [
      { id: 'c0', centroid: '#ff0000', weight: 1, lab: hexToLab('#ff0000') },
    ];
    state.paletteNames = { c0: 'primary' };
    runStep8(state);
    if (doc.content.mode !== 'slide') throw new Error();
    const fill = (doc.content.slides[0]?.elements[0] as { fill: string }).fill;
    expect(fill).toBe('theme:color.primary');
  });

  it('AC #25: hex not within ΔE < 5 of any cluster stays as literal', () => {
    const doc = makeDoc([{ fills: ['#ff0000', '#00aaff'] }]);
    const state = buildTestState(doc);
    state.paletteClusters = [
      { id: 'c0', centroid: '#ff0000', weight: 1, lab: hexToLab('#ff0000') },
    ];
    state.paletteNames = { c0: 'primary' };
    runStep8(state);
    if (doc.content.mode !== 'slide') throw new Error();
    const fill0 = (doc.content.slides[0]?.elements[0] as { fill: string }).fill;
    const fill1 = (doc.content.slides[0]?.elements[1] as { fill: string }).fill;
    expect(fill0).toBe('theme:color.primary');
    expect(fill1).toBe('#00aaff'); // unchanged literal
  });

  it('AC #26: re-running on already-tokenized doc is idempotent', () => {
    const doc = makeDoc([{ fills: ['#ff0000'] }]);
    const state1 = buildTestState(doc);
    state1.paletteClusters = [
      { id: 'c0', centroid: '#ff0000', weight: 1, lab: hexToLab('#ff0000') },
    ];
    state1.paletteNames = { c0: 'primary' };
    runStep8(state1);
    const after1 = JSON.stringify(doc);
    // Run again with the same state.
    const state2 = buildTestState(doc);
    state2.paletteClusters = state1.paletteClusters;
    state2.paletteNames = state1.paletteNames;
    runStep8(state2);
    expect(JSON.stringify(doc)).toBe(after1);
  });

  it('replaces text colors and slide backgrounds', () => {
    const doc = makeDoc([{ textColors: ['#ff0000'], background: '#ffffff' }]);
    const state = buildTestState(doc);
    state.paletteClusters = [
      { id: 'c0', centroid: '#ff0000', weight: 1, lab: hexToLab('#ff0000') },
      { id: 'c1', centroid: '#ffffff', weight: 1, lab: hexToLab('#ffffff') },
    ];
    state.paletteNames = { c0: 'primary', c1: 'background' };
    runStep8(state);
    if (doc.content.mode !== 'slide') throw new Error();
    const slide = doc.content.slides[0];
    if (!slide) throw new Error();
    const text = slide.elements[0] as { color: string };
    expect(text.color).toBe('theme:color.primary');
    if (slide.background?.kind !== 'color') throw new Error();
    expect(slide.background.value).toBe('theme:color.background');
  });

  it('replaces text run colors and table cell colors', () => {
    const doc = makeDoc([{}]);
    if (doc.content.mode !== 'slide') throw new Error();
    doc.content.slides[0]?.elements.push({
      id: 's1-text',
      type: 'text',
      text: 'hi',
      align: 'left',
      transform: { x: 0, y: 0, width: 100, height: 20, rotation: 0, opacity: 1 },
      visible: true,
      locked: false,
      animations: [],
      runs: [{ text: 'a', color: '#ff0000' }],
    });
    doc.content.slides[0]?.elements.push({
      id: 's1-table',
      type: 'table',
      rows: 1,
      columns: 1,
      headerRow: false,
      cells: [
        {
          row: 0,
          col: 0,
          content: 'x',
          background: '#ff0000',
          color: '#ff0000',
          align: 'left',
          colspan: 1,
          rowspan: 1,
        },
      ],
      transform: { x: 0, y: 100, width: 100, height: 20, rotation: 0, opacity: 1 },
      visible: true,
      locked: false,
      animations: [],
    });
    const state = buildTestState(doc);
    state.paletteClusters = [
      { id: 'c0', centroid: '#ff0000', weight: 1, lab: hexToLab('#ff0000') },
    ];
    state.paletteNames = { c0: 'primary' };
    runStep8(state);
    const slide = doc.content.slides[0];
    if (!slide) throw new Error();
    const text = slide.elements[0] as { runs: Array<{ color: string }> };
    expect(text.runs[0]?.color).toBe('theme:color.primary');
    const table = slide.elements[1] as { cells: Array<{ background: string; color: string }> };
    expect(table.cells[0]?.background).toBe('theme:color.primary');
    expect(table.cells[0]?.color).toBe('theme:color.primary');
  });

  it('skips theme refs (idempotent)', () => {
    const doc = makeDoc([{ fills: ['theme:color.primary'] }]);
    const state = buildTestState(doc);
    state.paletteClusters = [
      { id: 'c0', centroid: '#ff0000', weight: 1, lab: hexToLab('#ff0000') },
    ];
    state.paletteNames = { c0: 'primary' };
    const before = JSON.stringify(doc);
    runStep8(state);
    expect(JSON.stringify(doc)).toBe(before);
  });

  it('replaces stroke colors as well', () => {
    const doc = makeDoc([{ strokes: ['#ff0000'] }]);
    const state = buildTestState(doc);
    state.paletteClusters = [
      { id: 'c0', centroid: '#ff0000', weight: 1, lab: hexToLab('#ff0000') },
    ];
    state.paletteNames = { c0: 'primary' };
    runStep8(state);
    if (doc.content.mode !== 'slide') throw new Error();
    const el = doc.content.slides[0]?.elements[0];
    expect((el as { stroke: { color: string } }).stroke.color).toBe('theme:color.primary');
  });
});
