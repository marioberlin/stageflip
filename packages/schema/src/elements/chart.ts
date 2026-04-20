// packages/schema/src/elements/chart.ts
// Chart element — data-driven. Data source binding is a stub here; fully
// defined by T-167 (data-source-bindings bundle).

import { z } from 'zod';
import { elementBaseSchema } from './base.js';

export const chartKindSchema = z.enum(['bar', 'line', 'area', 'pie', 'donut', 'scatter', 'combo']);

/**
 * Inline data for a chart. Schema is intentionally loose here; specific
 * per-chart-kind validators land with T-160 (clip/animation bundle).
 */
export const chartDataSchema = z
  .object({
    labels: z.array(z.string()),
    series: z.array(
      z
        .object({
          name: z.string(),
          values: z.array(z.number().nullable()),
        })
        .strict(),
    ),
  })
  .strict();

/** Reference to an external data source. Resolved in T-167. */
export const dataSourceRefSchema = z
  .string()
  .regex(/^ds:[A-Za-z0-9_-]+$/, { message: 'data-source ref must be "ds:<id>"' });

export const chartElementSchema = elementBaseSchema
  .merge(
    z.object({
      type: z.literal('chart'),
      chartKind: chartKindSchema,
      data: z.union([chartDataSchema, dataSourceRefSchema]),
      legend: z.boolean().default(true),
      axes: z.boolean().default(true),
    }),
  )
  .strict();

export type ChartKind = z.infer<typeof chartKindSchema>;
export type ChartData = z.infer<typeof chartDataSchema>;
export type DataSourceRef = z.infer<typeof dataSourceRefSchema>;
export type ChartElement = z.infer<typeof chartElementSchema>;
