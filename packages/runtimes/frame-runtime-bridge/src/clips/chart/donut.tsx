// packages/runtimes/frame-runtime-bridge/src/clips/chart/donut.tsx
// T-406 D-T406-4 — donut chart renderer. Identical animation contract to
// pie; differs only by inner-radius hole. Pure function of `(frame,
// props, palette)` per AC #19.

import { useCurrentFrame, useVideoConfig } from '@stageflip/frame-runtime';
import type { ReactElement } from 'react';

import type { ChartData } from '@stageflip/schema';

import { DEFAULT_PALETTE, type Palette } from './constants.js';
import { renderPieOrDonut } from './pie.js';

/**
 * Inner-radius fraction of outer radius for v1 donut. 0.55 produces a
 * donut hole roughly the size of a label band; tuning lives in T-406
 * follow-up if the design system asks for more flexibility.
 */
export const INNER_RADIUS_FRACTION = 0.55;

export interface DonutChartProps {
  data: ChartData;
  legend: boolean;
  /** Donut has no axes; accepted for dispatcher uniformity but ignored. */
  axes?: boolean;
  palette?: Palette;
}

export function DonutChart({
  data,
  legend,
  palette = DEFAULT_PALETTE,
}: DonutChartProps): ReactElement {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return renderPieOrDonut(
    data,
    legend,
    palette,
    INNER_RADIUS_FRACTION,
    'donut',
    'Donut chart',
    frame,
    durationInFrames,
  );
}
