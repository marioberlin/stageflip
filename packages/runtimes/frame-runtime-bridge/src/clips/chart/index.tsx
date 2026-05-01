// packages/runtimes/frame-runtime-bridge/src/clips/chart/index.tsx
// T-406 — Chart clip family. Unified `chart` ClipDefinition that
// consumes ChartElement-shaped props and dispatches on `chartKind`
// to one of seven per-kind renderers. Frame-deterministic; subject
// to the broad §3 rule (no Math.random / Date.now / performance.now /
// fetch / timers / rAF).
//
// Lives alongside the existing 3 standalone chart clips (chart-build /
// pie-chart-build / line-chart-draw from T-131b). T-406 ADDS this
// unified family; it does NOT refactor those (D-T406-9). Cluster E
// presets (T-355–T-360) bind to this `chart` clipKind, NOT to the
// standalone clips.

import type { ClipDefinition } from '@stageflip/runtimes-contract';
import { chartDataSchema, chartKindSchema } from '@stageflip/schema';
import type { ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../../index.js';
import { AreaChart } from './area.js';
import { BarChart } from './bar.js';
import { ComboChart } from './combo.js';
import { DonutChart } from './donut.js';
import { LineChart } from './line.js';
import { PieChart } from './pie.js';
import { ScatterChart } from './scatter.js';

/**
 * Props shape for the unified chart family. Structural subset of
 * `ChartElement`: drops `elementBase` fields (transform / id / etc.)
 * the runtime supplies; drops the `DataSourceRef` branch (rejected
 * per D-T406-8 until T-167 ships data-source resolution).
 *
 * AC #2: a `data` field of `^ds:<id>$` shape is rejected at parse
 * time. The error message names T-167 so the consumer knows where
 * the resolution layer will land.
 */
export const chartPropsSchema = z
  .object({
    chartKind: chartKindSchema,
    data: chartDataSchema.refine(
      () => true,
      // The refine here is a no-op; the union narrowing happens
      // because we use `chartDataSchema` directly (NOT the wider
      // `z.union([chartDataSchema, dataSourceRefSchema])` that the
      // ChartElement schema uses). Strings (DataSourceRef shape)
      // fail the object-shape check on `chartDataSchema` and produce
      // a Zod error. The error message is augmented below.
    ),
    legend: z.boolean().default(true),
    axes: z.boolean().default(true),
  })
  .strict();

export type ChartProps = z.infer<typeof chartPropsSchema>;

/**
 * Wrap parse to surface a more helpful T-167-citing error when a
 * `DataSourceRef` is supplied. Default Zod errors say "Expected
 * object, received string" which is correct but doesn't point at the
 * deferral.
 */
const baseParse = chartPropsSchema.safeParse.bind(chartPropsSchema);
const augmentedSafeParse = (input: unknown): ReturnType<typeof baseParse> => {
  const result = baseParse(input);
  if (!result.success) {
    // Inject a top-level annotation referencing T-167 for any string
    // value of `data`. Implementers can rely on either the original
    // Zod issues OR this annotation.
    const augmented = result.error.issues.map((issue) => {
      if (
        issue.path.length === 1 &&
        issue.path[0] === 'data' &&
        typeof (input as { data?: unknown })?.data === 'string'
      ) {
        return {
          ...issue,
          message: `${issue.message} — chart data must be inline ChartData in v1; DataSourceRef resolution lands in T-167 (data-source-bindings bundle).`,
        };
      }
      return issue;
    });
    return {
      success: false,
      error: { ...result.error, issues: augmented } as typeof result.error,
    } as ReturnType<typeof baseParse>;
  }
  return result;
};
// Replace the schema's safeParse with the augmented version for
// runtime + test consumers. The type stays the same.
(chartPropsSchema as unknown as { safeParse: typeof augmentedSafeParse }).safeParse =
  augmentedSafeParse;

/**
 * Dispatch on `chartKind` to the per-kind renderer. All seven kinds
 * (bar / line / area / pie / donut / scatter / combo) are implemented
 * in T-406; the switch is exhaustive over `chartKindSchema`.
 */
export function ChartClip(props: ChartProps): ReactElement {
  switch (props.chartKind) {
    case 'bar':
      return <BarChart data={props.data} legend={props.legend} axes={props.axes} />;
    case 'line':
      return <LineChart data={props.data} legend={props.legend} axes={props.axes} />;
    case 'area':
      return <AreaChart data={props.data} legend={props.legend} axes={props.axes} />;
    case 'pie':
      return <PieChart data={props.data} legend={props.legend} />;
    case 'donut':
      return <DonutChart data={props.data} legend={props.legend} />;
    case 'scatter':
      return <ScatterChart data={props.data} legend={props.legend} axes={props.axes} />;
    case 'combo':
      return <ComboChart data={props.data} legend={props.legend} axes={props.axes} />;
  }
}

/**
 * The unified `chart` ClipDefinition. Registered in
 * `ALL_BRIDGE_CLIPS` so Cluster E presets can bind to it via the
 * standard registry path.
 *
 * The `propsSchema` cast widens the schema type to `z.ZodType<ChartProps>`
 * — `ZodDefault`'s input type allows `undefined` for the defaulted
 * fields (legend / axes), but the inferred output `ChartProps` does
 * not. Cast bypasses the variance mismatch; runtime behavior is
 * unchanged.
 */
export const chartClip: ClipDefinition<unknown> = defineFrameClip<ChartProps>({
  kind: 'chart',
  component: ChartClip,
  propsSchema: chartPropsSchema as unknown as z.ZodType<ChartProps>,
  themeSlots: {
    // Five semantic palette roles available (primary / secondary /
    // accent / foreground / surface / background). Series colors map
    // to primary / secondary / accent in rotation; v1 ships 8 series
    // slots so series 3-7 cycle through the same three roles. A
    // future task can extend the role set if needed.
    series0: { kind: 'palette', role: 'primary' },
    series1: { kind: 'palette', role: 'secondary' },
    series2: { kind: 'palette', role: 'accent' },
    series3: { kind: 'palette', role: 'primary' },
    series4: { kind: 'palette', role: 'secondary' },
    series5: { kind: 'palette', role: 'accent' },
    series6: { kind: 'palette', role: 'primary' },
    series7: { kind: 'palette', role: 'secondary' },
    axis: { kind: 'palette', role: 'foreground' },
    gridline: { kind: 'palette', role: 'surface' },
    text: { kind: 'palette', role: 'foreground' },
  },
  fontRequirements: () => [{ family: 'Plus Jakarta Sans', weight: 400 }],
});
