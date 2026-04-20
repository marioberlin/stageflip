// packages/schema/src/elements/table.ts
// Table element — rows/columns/cells. CM1 (conditional-message) annotations
// arrive with T-163 (table-cm1 bundle).

import { z } from 'zod';
import { colorValueSchema } from '../primitives.js';
import { elementBaseSchema } from './base.js';

export const tableCellSchema = z
  .object({
    row: z.number().int().nonnegative(),
    col: z.number().int().nonnegative(),
    content: z.string(),
    color: colorValueSchema.optional(),
    background: colorValueSchema.optional(),
    bold: z.boolean().optional(),
    align: z.enum(['left', 'center', 'right']).default('left'),
    colspan: z.number().int().positive().default(1),
    rowspan: z.number().int().positive().default(1),
  })
  .strict();

export const tableElementSchema = elementBaseSchema
  .merge(
    z.object({
      type: z.literal('table'),
      rows: z.number().int().positive(),
      columns: z.number().int().positive(),
      headerRow: z.boolean().default(true),
      cells: z.array(tableCellSchema),
    }),
  )
  .strict();

export type TableCell = z.infer<typeof tableCellSchema>;
export type TableElement = z.infer<typeof tableElementSchema>;
