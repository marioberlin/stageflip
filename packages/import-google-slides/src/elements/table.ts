// packages/import-google-slides/src/elements/table.ts
// Convert Slides API `pageElement.table` into a canonical TableElement,
// preserving rowSpan/columnSpan as the schema's `rowspan` / `colspan`.
// Internally inconsistent spans (overlapping or zero) trigger
// LF-GSLIDES-TABLE-MERGE-LOST and a fallback to per-slot independent cells.

import type { TableCell, TableElement } from '@stageflip/schema';
import type { ApiPageElement } from '../api/types.js';
import type { BboxPx } from '../geometry/affine.js';
import { emitLossFlag } from '../loss-flags.js';
import { extractApiText } from '../matching/match.js';
import type { LossFlag } from '../types.js';
import { makeElementId, transformFromBbox } from './shared.js';

interface SpanCheckResult {
  ok: boolean;
  reason?: string;
}

/**
 * Validate that the API table's rowSpan/columnSpan are internally consistent
 * — no overlap, no zero spans. Returns `{ok: false, reason}` on failure.
 */
function validateSpans(apiElement: ApiPageElement, rows: number, cols: number): SpanCheckResult {
  const tbl = apiElement.table;
  if (!tbl) return { ok: false, reason: 'table missing' };
  if (rows <= 0 || cols <= 0) return { ok: false, reason: 'rows/columns non-positive' };
  const occupied: boolean[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => false),
  );
  const tableRows = tbl.tableRows ?? [];
  for (let r = 0; r < tableRows.length; r += 1) {
    const row = tableRows[r];
    if (!row) continue;
    const cells = row.tableCells ?? [];
    for (const cell of cells) {
      const ci = cell.location?.columnIndex ?? 0;
      const ri = cell.location?.rowIndex ?? r;
      const rs = cell.rowSpan ?? 1;
      const cs = cell.columnSpan ?? 1;
      if (rs < 1 || cs < 1) return { ok: false, reason: `zero or negative span at (${ri},${ci})` };
      // Overlap check.
      for (let dr = 0; dr < rs; dr += 1) {
        for (let dc = 0; dc < cs; dc += 1) {
          const rr = ri + dr;
          const cc = ci + dc;
          if (rr >= rows || cc >= cols) {
            return { ok: false, reason: `span overflow at (${ri},${ci}) rs=${rs} cs=${cs}` };
          }
          if (occupied[rr]?.[cc]) {
            return { ok: false, reason: `overlapping span at (${rr},${cc})` };
          }
          if (occupied[rr]) (occupied[rr] as boolean[])[cc] = true;
        }
      }
    }
  }
  return { ok: true };
}

export function emitTableElement(args: {
  apiElement: ApiPageElement;
  worldBbox: BboxPx;
  slideId: string;
  fallback: string;
}): { element: TableElement; flags: LossFlag[] } {
  const { apiElement, worldBbox, slideId, fallback } = args;
  const id = makeElementId(apiElement.objectId, fallback);
  const flags: LossFlag[] = [];
  const tbl = apiElement.table ?? {};
  const rows = tbl.rows ?? tbl.tableRows?.length ?? 1;
  const cols = tbl.columns ?? tbl.tableRows?.[0]?.tableCells?.length ?? 1;

  const spanCheck = validateSpans(apiElement, rows, cols);
  const cells: TableCell[] = [];

  if (!spanCheck.ok) {
    flags.push(
      emitLossFlag({
        code: 'LF-GSLIDES-TABLE-MERGE-LOST',
        location: { slideId, elementId: id },
        message: `table spans inconsistent (${spanCheck.reason}); falling back to per-slot cells`,
      }),
    );
    // Per-slot independent cells; no rowspan/colspan.
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const apiCell = tbl.tableRows?.[r]?.tableCells?.[c];
        const text = apiCell ? extractApiText(apiCell.text) : null;
        cells.push({
          row: r,
          col: c,
          content: text ?? '',
          align: 'left',
          colspan: 1,
          rowspan: 1,
        });
      }
    }
  } else {
    const tableRows = tbl.tableRows ?? [];
    for (let r = 0; r < tableRows.length; r += 1) {
      const row = tableRows[r];
      if (!row) continue;
      for (const apiCell of row.tableCells ?? []) {
        const ri = apiCell.location?.rowIndex ?? r;
        const ci = apiCell.location?.columnIndex ?? 0;
        const rs = apiCell.rowSpan ?? 1;
        const cs = apiCell.columnSpan ?? 1;
        const text = extractApiText(apiCell.text);
        cells.push({
          row: ri,
          col: ci,
          content: text ?? '',
          align: 'left',
          colspan: cs,
          rowspan: rs,
        });
      }
    }
  }

  const element: TableElement = {
    id,
    transform: transformFromBbox(worldBbox),
    visible: true,
    locked: false,
    animations: [],
    type: 'table',
    rows,
    columns: cols,
    headerRow: true,
    cells,
  };
  return { element, flags };
}
