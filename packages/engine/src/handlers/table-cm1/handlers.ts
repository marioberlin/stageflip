// packages/engine/src/handlers/table-cm1/handlers.ts
// `table-cm1` bundle — 6 write-tier tools for table-element content
// mutation: per-cell upsert/clear, and row / column insert / delete
// with automatic coordinate-shift of the sparse `cells` array. Slide-mode
// only. Handlers type against `MutationContext`; mutations flow as
// JSON-Patch ops.
//
// Table elements store cells sparsely — one entry per non-default cell,
// addressed by `{row, col}`. Inserting a row at index R shifts every
// cell with row ≥ R up by one; deleting a row at R drops cells with
// row = R and shifts cells with row > R down by one. Same logic for
// columns. All row/column edits emit a single wholesale `replace` op
// on both `cells` and `rows`/`columns` to keep the sparse array and
// the declared grid in sync.

import type { LLMToolDefinition } from '@stageflip/llm-abstraction';
import { tableCellSchema } from '@stageflip/schema';
import { z } from 'zod';
import type { MutationContext, ToolHandler } from '../../router/types.js';

export const TABLE_CM1_BUNDLE_NAME = 'table-cm1';

// ---------------------------------------------------------------------------
// Shared locators
// ---------------------------------------------------------------------------

interface TableCellShape {
  row: number;
  col: number;
  content: string;
  color?: unknown;
  background?: unknown;
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
  colspan?: number;
  rowspan?: number;
}

interface TableLocation {
  slideIndex: number;
  elementIndex: number;
  element: {
    id: string;
    type: string;
    rows: number;
    columns: number;
    cells: readonly TableCellShape[];
  } & Record<string, unknown>;
}

type LocateFail = 'wrong_mode' | 'slide_not_found' | 'element_not_found' | 'wrong_element_type';

function locateTable(
  ctx: MutationContext,
  slideId: string,
  elementId: string,
): TableLocation | LocateFail {
  if (ctx.document.content.mode !== 'slide') return 'wrong_mode';
  const slideIndex = ctx.document.content.slides.findIndex((s) => s.id === slideId);
  if (slideIndex === -1) return 'slide_not_found';
  const slide = ctx.document.content.slides[slideIndex];
  if (!slide) return 'slide_not_found';
  const elementIndex = slide.elements.findIndex((e) => e.id === elementId);
  if (elementIndex === -1) return 'element_not_found';
  const element = slide.elements[elementIndex] as unknown as Record<string, unknown>;
  if (!element) return 'element_not_found';
  if (element.type !== 'table') return 'wrong_element_type';
  return {
    slideIndex,
    elementIndex,
    element: element as unknown as TableLocation['element'],
  };
}

function tablePath(loc: TableLocation): string {
  return `/content/slides/${loc.slideIndex}/elements/${loc.elementIndex}`;
}

function findCellIndex(cells: readonly TableCellShape[], row: number, col: number): number {
  return cells.findIndex((c) => c.row === row && c.col === col);
}

// ---------------------------------------------------------------------------
// 1 — set_cell
// ---------------------------------------------------------------------------

const cellPatchSchema = z
  .object({
    content: z.string(),
    color: tableCellSchema.shape.color,
    background: tableCellSchema.shape.background,
    bold: z.boolean().optional(),
    align: z.enum(['left', 'center', 'right']).optional(),
    colspan: z.number().int().positive().optional(),
    rowspan: z.number().int().positive().optional(),
  })
  .strict();

const setCellInput = z
  .object({
    slideId: z.string().min(1),
    elementId: z.string().min(1),
    row: z.number().int().nonnegative(),
    col: z.number().int().nonnegative(),
    cell: cellPatchSchema,
  })
  .strict();
const setCellOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      elementId: z.string(),
      row: z.number().int().nonnegative(),
      col: z.number().int().nonnegative(),
      action: z.enum(['added', 'replaced']),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum([
        'wrong_mode',
        'slide_not_found',
        'element_not_found',
        'wrong_element_type',
        'out_of_bounds',
      ]),
      detail: z.string().optional(),
    })
    .strict(),
]);

type SetCellInput = z.infer<typeof setCellInput>;
type SetCellOutput = z.infer<typeof setCellOutput>;

const setCell: ToolHandler<SetCellInput, SetCellOutput, MutationContext> = {
  name: 'set_cell',
  bundle: TABLE_CM1_BUNDLE_NAME,
  description:
    "Upsert a cell at `(row, col)`. If a cell already exists at those coordinates, it's wholesale-replaced; otherwise it's appended to the sparse `cells` array. Refuses `out_of_bounds` if `row >= table.rows` or `col >= table.columns`. The cell payload is Zod-validated against the per-cell shape (content required; color / background / bold / align / colspan / rowspan optional).",
  inputSchema: setCellInput as unknown as z.ZodType<SetCellInput>,
  outputSchema: setCellOutput,
  handle: (input, ctx) => {
    const loc = locateTable(ctx, input.slideId, input.elementId);
    if (typeof loc === 'string') return { ok: false, reason: loc };
    if (input.row >= loc.element.rows || input.col >= loc.element.columns) {
      return {
        ok: false,
        reason: 'out_of_bounds',
        detail: `cell (${input.row}, ${input.col}) outside ${loc.element.rows}×${loc.element.columns}`,
      };
    }
    const cells = loc.element.cells;
    const existingIndex = findCellIndex(cells, input.row, input.col);
    const cellValue = { row: input.row, col: input.col, ...input.cell };
    if (existingIndex === -1) {
      ctx.patchSink.push({
        op: 'add',
        path: `${tablePath(loc)}/cells/-`,
        value: cellValue,
      });
      return {
        ok: true,
        elementId: input.elementId,
        row: input.row,
        col: input.col,
        action: 'added',
      };
    }
    ctx.patchSink.push({
      op: 'replace',
      path: `${tablePath(loc)}/cells/${existingIndex}`,
      value: cellValue,
    });
    return {
      ok: true,
      elementId: input.elementId,
      row: input.row,
      col: input.col,
      action: 'replaced',
    };
  },
};

// ---------------------------------------------------------------------------
// 2 — clear_cell
// ---------------------------------------------------------------------------

const clearCellInput = z
  .object({
    slideId: z.string().min(1),
    elementId: z.string().min(1),
    row: z.number().int().nonnegative(),
    col: z.number().int().nonnegative(),
  })
  .strict();
const clearCellOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      elementId: z.string(),
      row: z.number().int().nonnegative(),
      col: z.number().int().nonnegative(),
      wasSet: z.boolean(),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['wrong_mode', 'slide_not_found', 'element_not_found', 'wrong_element_type']),
    })
    .strict(),
]);

const clearCell: ToolHandler<
  z.infer<typeof clearCellInput>,
  z.infer<typeof clearCellOutput>,
  MutationContext
> = {
  name: 'clear_cell',
  bundle: TABLE_CM1_BUNDLE_NAME,
  description:
    "Remove a cell entry at `(row, col)` from the sparse `cells` array. Reports `wasSet: false` when no cell was present (noop — no patch emitted). Out-of-bounds coordinates silently noop too, since a missing coordinate and an out-of-bounds coordinate both mean 'no cell to clear'.",
  inputSchema: clearCellInput,
  outputSchema: clearCellOutput,
  handle: (input, ctx) => {
    const loc = locateTable(ctx, input.slideId, input.elementId);
    if (typeof loc === 'string') return { ok: false, reason: loc };
    const existingIndex = findCellIndex(loc.element.cells, input.row, input.col);
    if (existingIndex === -1) {
      return {
        ok: true,
        elementId: input.elementId,
        row: input.row,
        col: input.col,
        wasSet: false,
      };
    }
    ctx.patchSink.push({
      op: 'remove',
      path: `${tablePath(loc)}/cells/${existingIndex}`,
    });
    return {
      ok: true,
      elementId: input.elementId,
      row: input.row,
      col: input.col,
      wasSet: true,
    };
  },
};

// ---------------------------------------------------------------------------
// 3 — insert_row
// ---------------------------------------------------------------------------

const insertRowInput = z
  .object({
    slideId: z.string().min(1),
    elementId: z.string().min(1),
    at: z.number().int().nonnegative(),
  })
  .strict();
const insertRowOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      elementId: z.string(),
      at: z.number().int().nonnegative(),
      rowsAfter: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum([
        'wrong_mode',
        'slide_not_found',
        'element_not_found',
        'wrong_element_type',
        'out_of_bounds',
      ]),
      detail: z.string().optional(),
    })
    .strict(),
]);

const insertRow: ToolHandler<
  z.infer<typeof insertRowInput>,
  z.infer<typeof insertRowOutput>,
  MutationContext
> = {
  name: 'insert_row',
  bundle: TABLE_CM1_BUNDLE_NAME,
  description:
    'Insert a blank row at index `at`. Shifts every cell whose row ≥ at up by one, and increments `table.rows`. `at = table.rows` appends at the bottom; `at > table.rows` refuses with `out_of_bounds`. Atomic: emits one replace op for `cells` and one for `rows`.',
  inputSchema: insertRowInput,
  outputSchema: insertRowOutput,
  handle: (input, ctx) => {
    const loc = locateTable(ctx, input.slideId, input.elementId);
    if (typeof loc === 'string') return { ok: false, reason: loc };
    if (input.at > loc.element.rows) {
      return {
        ok: false,
        reason: 'out_of_bounds',
        detail: `at=${input.at} > rows=${loc.element.rows}`,
      };
    }
    const shifted = loc.element.cells.map((c) =>
      c.row >= input.at ? { ...c, row: c.row + 1 } : c,
    );
    ctx.patchSink.push({
      op: 'replace',
      path: `${tablePath(loc)}/cells`,
      value: shifted,
    });
    ctx.patchSink.push({
      op: 'replace',
      path: `${tablePath(loc)}/rows`,
      value: loc.element.rows + 1,
    });
    return {
      ok: true,
      elementId: input.elementId,
      at: input.at,
      rowsAfter: loc.element.rows + 1,
    };
  },
};

// ---------------------------------------------------------------------------
// 4 — delete_row
// ---------------------------------------------------------------------------

const deleteRowInput = z
  .object({
    slideId: z.string().min(1),
    elementId: z.string().min(1),
    at: z.number().int().nonnegative(),
  })
  .strict();
const deleteRowOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      elementId: z.string(),
      at: z.number().int().nonnegative(),
      rowsAfter: z.number().int().positive(),
      cellsRemoved: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum([
        'wrong_mode',
        'slide_not_found',
        'element_not_found',
        'wrong_element_type',
        'out_of_bounds',
        'last_row',
      ]),
      detail: z.string().optional(),
    })
    .strict(),
]);

const deleteRow: ToolHandler<
  z.infer<typeof deleteRowInput>,
  z.infer<typeof deleteRowOutput>,
  MutationContext
> = {
  name: 'delete_row',
  bundle: TABLE_CM1_BUNDLE_NAME,
  description:
    'Delete the row at index `at`. Removes every cell whose row equals `at`, shifts cells with row > at down by one, and decrements `table.rows`. Refuses `last_row` when `table.rows == 1` (tables must keep ≥1 row) and `out_of_bounds` when `at >= rows`.',
  inputSchema: deleteRowInput,
  outputSchema: deleteRowOutput,
  handle: (input, ctx) => {
    const loc = locateTable(ctx, input.slideId, input.elementId);
    if (typeof loc === 'string') return { ok: false, reason: loc };
    if (input.at >= loc.element.rows) {
      return {
        ok: false,
        reason: 'out_of_bounds',
        detail: `at=${input.at} >= rows=${loc.element.rows}`,
      };
    }
    if (loc.element.rows <= 1) {
      return { ok: false, reason: 'last_row' };
    }
    const kept = loc.element.cells.filter((c) => c.row !== input.at);
    const removed = loc.element.cells.length - kept.length;
    const shifted = kept.map((c) => (c.row > input.at ? { ...c, row: c.row - 1 } : c));
    ctx.patchSink.push({
      op: 'replace',
      path: `${tablePath(loc)}/cells`,
      value: shifted,
    });
    ctx.patchSink.push({
      op: 'replace',
      path: `${tablePath(loc)}/rows`,
      value: loc.element.rows - 1,
    });
    return {
      ok: true,
      elementId: input.elementId,
      at: input.at,
      rowsAfter: loc.element.rows - 1,
      cellsRemoved: removed,
    };
  },
};

// ---------------------------------------------------------------------------
// 5 — insert_column
// ---------------------------------------------------------------------------

const insertColumnInput = z
  .object({
    slideId: z.string().min(1),
    elementId: z.string().min(1),
    at: z.number().int().nonnegative(),
  })
  .strict();
const insertColumnOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      elementId: z.string(),
      at: z.number().int().nonnegative(),
      columnsAfter: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum([
        'wrong_mode',
        'slide_not_found',
        'element_not_found',
        'wrong_element_type',
        'out_of_bounds',
      ]),
      detail: z.string().optional(),
    })
    .strict(),
]);

const insertColumn: ToolHandler<
  z.infer<typeof insertColumnInput>,
  z.infer<typeof insertColumnOutput>,
  MutationContext
> = {
  name: 'insert_column',
  bundle: TABLE_CM1_BUNDLE_NAME,
  description:
    'Insert a blank column at index `at`. Shifts every cell whose col ≥ at right by one, and increments `table.columns`. `at = table.columns` appends on the right.',
  inputSchema: insertColumnInput,
  outputSchema: insertColumnOutput,
  handle: (input, ctx) => {
    const loc = locateTable(ctx, input.slideId, input.elementId);
    if (typeof loc === 'string') return { ok: false, reason: loc };
    if (input.at > loc.element.columns) {
      return {
        ok: false,
        reason: 'out_of_bounds',
        detail: `at=${input.at} > columns=${loc.element.columns}`,
      };
    }
    const shifted = loc.element.cells.map((c) =>
      c.col >= input.at ? { ...c, col: c.col + 1 } : c,
    );
    ctx.patchSink.push({
      op: 'replace',
      path: `${tablePath(loc)}/cells`,
      value: shifted,
    });
    ctx.patchSink.push({
      op: 'replace',
      path: `${tablePath(loc)}/columns`,
      value: loc.element.columns + 1,
    });
    return {
      ok: true,
      elementId: input.elementId,
      at: input.at,
      columnsAfter: loc.element.columns + 1,
    };
  },
};

// ---------------------------------------------------------------------------
// 6 — delete_column
// ---------------------------------------------------------------------------

const deleteColumnInput = z
  .object({
    slideId: z.string().min(1),
    elementId: z.string().min(1),
    at: z.number().int().nonnegative(),
  })
  .strict();
const deleteColumnOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      elementId: z.string(),
      at: z.number().int().nonnegative(),
      columnsAfter: z.number().int().positive(),
      cellsRemoved: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum([
        'wrong_mode',
        'slide_not_found',
        'element_not_found',
        'wrong_element_type',
        'out_of_bounds',
        'last_column',
      ]),
      detail: z.string().optional(),
    })
    .strict(),
]);

const deleteColumn: ToolHandler<
  z.infer<typeof deleteColumnInput>,
  z.infer<typeof deleteColumnOutput>,
  MutationContext
> = {
  name: 'delete_column',
  bundle: TABLE_CM1_BUNDLE_NAME,
  description:
    'Delete the column at index `at`. Removes every cell whose col equals `at`, shifts cells with col > at left by one, and decrements `table.columns`. Refuses `last_column` when `table.columns == 1`.',
  inputSchema: deleteColumnInput,
  outputSchema: deleteColumnOutput,
  handle: (input, ctx) => {
    const loc = locateTable(ctx, input.slideId, input.elementId);
    if (typeof loc === 'string') return { ok: false, reason: loc };
    if (input.at >= loc.element.columns) {
      return {
        ok: false,
        reason: 'out_of_bounds',
        detail: `at=${input.at} >= columns=${loc.element.columns}`,
      };
    }
    if (loc.element.columns <= 1) {
      return { ok: false, reason: 'last_column' };
    }
    const kept = loc.element.cells.filter((c) => c.col !== input.at);
    const removed = loc.element.cells.length - kept.length;
    const shifted = kept.map((c) => (c.col > input.at ? { ...c, col: c.col - 1 } : c));
    ctx.patchSink.push({
      op: 'replace',
      path: `${tablePath(loc)}/cells`,
      value: shifted,
    });
    ctx.patchSink.push({
      op: 'replace',
      path: `${tablePath(loc)}/columns`,
      value: loc.element.columns - 1,
    });
    return {
      ok: true,
      elementId: input.elementId,
      at: input.at,
      columnsAfter: loc.element.columns - 1,
      cellsRemoved: removed,
    };
  },
};

// ---------------------------------------------------------------------------
// Barrel
// ---------------------------------------------------------------------------

export const TABLE_CM1_HANDLERS: readonly ToolHandler<unknown, unknown, MutationContext>[] = [
  setCell,
  clearCell,
  insertRow,
  deleteRow,
  insertColumn,
  deleteColumn,
] as unknown as readonly ToolHandler<unknown, unknown, MutationContext>[];

// ---------------------------------------------------------------------------
// LLM tool definitions
// ---------------------------------------------------------------------------

const nonEmptyString = { type: 'string' as const, minLength: 1 };
const nonNegInt = { type: 'integer' as const, minimum: 0 };
const posInt = { type: 'integer' as const, minimum: 1 };
const colorValue = {
  type: 'string' as const,
  description: 'Hex `#RGB` / `#RRGGBB` / `#RRGGBBAA` or theme ref `theme:<dotted.path>`.',
};

const cellObject = {
  type: 'object' as const,
  required: ['content'],
  additionalProperties: false,
  properties: {
    content: { type: 'string' },
    color: colorValue,
    background: colorValue,
    bold: { type: 'boolean' },
    align: { type: 'string', enum: ['left', 'center', 'right'] },
    colspan: posInt,
    rowspan: posInt,
  },
};

export const TABLE_CM1_TOOL_DEFINITIONS: readonly LLMToolDefinition[] = [
  {
    name: 'set_cell',
    description: setCell.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'elementId', 'row', 'col', 'cell'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        elementId: nonEmptyString,
        row: nonNegInt,
        col: nonNegInt,
        cell: cellObject,
      },
    },
  },
  {
    name: 'clear_cell',
    description: clearCell.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'elementId', 'row', 'col'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        elementId: nonEmptyString,
        row: nonNegInt,
        col: nonNegInt,
      },
    },
  },
  {
    name: 'insert_row',
    description: insertRow.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'elementId', 'at'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        elementId: nonEmptyString,
        at: nonNegInt,
      },
    },
  },
  {
    name: 'delete_row',
    description: deleteRow.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'elementId', 'at'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        elementId: nonEmptyString,
        at: nonNegInt,
      },
    },
  },
  {
    name: 'insert_column',
    description: insertColumn.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'elementId', 'at'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        elementId: nonEmptyString,
        at: nonNegInt,
      },
    },
  },
  {
    name: 'delete_column',
    description: deleteColumn.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'elementId', 'at'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        elementId: nonEmptyString,
        at: nonNegInt,
      },
    },
  },
];
