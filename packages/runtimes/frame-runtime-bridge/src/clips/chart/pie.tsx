// packages/runtimes/frame-runtime-bridge/src/clips/chart/pie.tsx
// T-406 D-T406-4 — pie chart renderer. One <path> per slice; each slice
// terminal angle animates from 0 to its proportional share. Pure
// function of `(frame, props, palette)` per AC #19. SVG only; no inline
// hex literals (AC #16).

import { interpolate, useCurrentFrame, useVideoConfig } from '@stageflip/frame-runtime';
import type { ReactElement } from 'react';

import type { ChartData } from '@stageflip/schema';

import {
  CANVAS_H,
  CANVAS_W,
  DEFAULT_PALETTE,
  EASE_OUT_EXPO,
  ENTRANCE_FRACTION,
  type Palette,
  STAGGER_FRAMES,
} from './constants.js';
import { Legend } from './legend.js';

export interface PieChartProps {
  data: ChartData;
  legend: boolean;
  /** Pie has no axes; accepted for dispatcher uniformity but ignored. */
  axes?: boolean;
  palette?: Palette;
}

/**
 * Build an SVG arc path for a slice covering [startAngle, endAngle]
 * (radians, clockwise from -π/2). Returns empty when the sweep is 0
 * so the renderer can short-circuit at frame 0.
 */
function arcPath(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number,
): string {
  if (endAngle - startAngle <= 0) return '';
  const x0 = cx + outerRadius * Math.cos(startAngle);
  const y0 = cy + outerRadius * Math.sin(startAngle);
  const x1 = cx + outerRadius * Math.cos(endAngle);
  const y1 = cy + outerRadius * Math.sin(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  if (innerRadius <= 0) {
    return `M ${cx} ${cy} L ${x0} ${y0} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x1} ${y1} Z`;
  }
  const ix0 = cx + innerRadius * Math.cos(startAngle);
  const iy0 = cy + innerRadius * Math.sin(startAngle);
  const ix1 = cx + innerRadius * Math.cos(endAngle);
  const iy1 = cy + innerRadius * Math.sin(endAngle);
  return [
    `M ${x0} ${y0}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x1} ${y1}`,
    `L ${ix1} ${iy1}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix0} ${iy0}`,
    'Z',
  ].join(' ');
}

export function renderPieOrDonut(
  data: ChartData,
  legend: boolean,
  palette: Palette,
  innerRadiusFraction: number,
  testIdPrefix: string,
  titleText: string,
  frame: number,
  durationInFrames: number,
): ReactElement {
  const series = data.series[0];
  const values = series?.values ?? [];
  const numericValues = values.map((v) => (typeof v === 'number' ? v : 0));
  const total = numericValues.reduce((a, b) => a + b, 0) || 1;

  const cx = CANVAS_W / 2;
  const cy = CANVAS_H / 2;
  const outerRadius = Math.min(CANVAS_W, CANVAS_H) / 2 - 80;
  const innerRadius = outerRadius * innerRadiusFraction;

  const targetEnd = Math.floor(durationInFrames * ENTRANCE_FRACTION);
  const lastStaggerDelay = Math.max(0, numericValues.length - 1) * STAGGER_FRAMES;
  const buildFrames = Math.max(1, targetEnd - lastStaggerDelay);

  // Cumulative start angles per slice (full-share basis), in radians,
  // measured clockwise from -π/2 so slice 0 starts at 12 o'clock.
  const startAngleBase = -Math.PI / 2;
  const sliceShares = numericValues.map((v) => (v / total) * Math.PI * 2);
  const cumStarts: number[] = [];
  let acc = startAngleBase;
  for (const share of sliceShares) {
    cumStarts.push(acc);
    acc += share;
  }

  return (
    <svg
      data-testid={`chart-${testIdPrefix}`}
      width="100%"
      height="100%"
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      role="img"
    >
      <title>{titleText}</title>
      {numericValues.map((_, i) => {
        const delay = i * STAGGER_FRAMES;
        const progress = interpolate(frame, [delay, delay + buildFrames], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: EASE_OUT_EXPO,
        });
        const sliceShare = sliceShares[i] ?? 0;
        const start = cumStarts[i] ?? startAngleBase;
        const end = start + sliceShare * progress;
        const d = arcPath(cx, cy, outerRadius, innerRadius, start, end);
        return (
          <path
            // biome-ignore lint/suspicious/noArrayIndexKey: positional slice identity stable.
            key={i}
            data-testid={`chart-${testIdPrefix}-slice-${i}`}
            d={d}
            fill={palette.series[i % palette.series.length]}
          />
        );
      })}
      {legend && (
        <Legend
          x={CANVAS_W - 220}
          y={80}
          entries={(data.labels ?? numericValues.map((_, i) => `Slice ${i + 1}`)).map(
            (label, i) => ({
              name: label,
              color: palette.series[i % palette.series.length] as string,
            }),
          )}
          textColor={palette.text}
        />
      )}
    </svg>
  );
}

export function PieChart({ data, legend, palette = DEFAULT_PALETTE }: PieChartProps): ReactElement {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return renderPieOrDonut(data, legend, palette, 0, 'pie', 'Pie chart', frame, durationInFrames);
}
