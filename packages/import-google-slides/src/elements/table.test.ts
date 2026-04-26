// packages/import-google-slides/src/elements/table.test.ts
// Pin AC #32 (rowSpan: 2 → rowspan: 2) and AC #24 (LF-GSLIDES-TABLE-MERGE-LOST
// on inconsistent spans → fallback to per-slot cells).

import { describe, expect, it } from 'vitest';
import { emitTableElement } from './table.js';

const bbox = { x: 0, y: 0, width: 400, height: 200 };

describe('emitTableElement (AC #32)', () => {
  it('rowSpan:2 maps to rowspan:2 on the cell', () => {
    const out = emitTableElement({
      apiElement: {
        objectId: 't1',
        table: {
          rows: 2,
          columns: 2,
          tableRows: [
            {
              tableCells: [
                {
                  rowSpan: 2,
                  columnSpan: 1,
                  location: { rowIndex: 0, columnIndex: 0 },
                  text: { textElements: [{ textRun: { content: 'span' } }] },
                },
                {
                  rowSpan: 1,
                  columnSpan: 1,
                  location: { rowIndex: 0, columnIndex: 1 },
                  text: { textElements: [{ textRun: { content: 'b' } }] },
                },
              ],
            },
            {
              // Row 2 has only one cell because col 0 is occupied by the rowspan above.
              tableCells: [
                {
                  rowSpan: 1,
                  columnSpan: 1,
                  location: { rowIndex: 1, columnIndex: 1 },
                  text: { textElements: [{ textRun: { content: 'd' } }] },
                },
              ],
            },
          ],
        },
      },
      worldBbox: bbox,
      slideId: 's1',
      fallback: 'fb',
    });
    expect(out.flags).toHaveLength(0);
    expect(out.element.cells).toHaveLength(3);
    const spanned = out.element.cells.find((c) => c.row === 0 && c.col === 0);
    expect(spanned?.rowspan).toBe(2);
    expect(spanned?.content).toBe('span');
  });
});

describe('emitTableElement — span inconsistency (AC #24)', () => {
  it('rowSpan:2 on a 1-row table → LF-GSLIDES-TABLE-MERGE-LOST + per-slot fallback', () => {
    const out = emitTableElement({
      apiElement: {
        objectId: 't2',
        table: {
          rows: 1,
          columns: 2,
          tableRows: [
            {
              tableCells: [
                {
                  rowSpan: 2, // overflow!
                  columnSpan: 1,
                  location: { rowIndex: 0, columnIndex: 0 },
                  text: { textElements: [{ textRun: { content: 'a' } }] },
                },
                {
                  rowSpan: 1,
                  columnSpan: 1,
                  location: { rowIndex: 0, columnIndex: 1 },
                  text: { textElements: [{ textRun: { content: 'b' } }] },
                },
              ],
            },
          ],
        },
      },
      worldBbox: bbox,
      slideId: 's1',
      fallback: 'fb',
    });
    expect(out.flags).toHaveLength(1);
    expect(out.flags[0]?.code).toBe('LF-GSLIDES-TABLE-MERGE-LOST');
    expect(out.flags[0]?.severity).toBe('error');
    // Fallback: rows*cols cells, all 1×1.
    expect(out.element.cells).toHaveLength(2);
    for (const c of out.element.cells) {
      expect(c.rowspan).toBe(1);
      expect(c.colspan).toBe(1);
    }
  });
});
