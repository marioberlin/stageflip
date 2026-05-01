// packages/runtimes/frame-runtime-bridge/src/clips/chart/line.tsx
// T-406 D-T406-4 — line chart renderer. Each series renders one
// <path> animated L→R via stroke-dasharray = pathLength + decreasing
// stroke-dashoffset. Pure function of `(frame, props, palette)` per
// AC #19. SVG only; no inline hex literals (AC #16).

import { interpolate, useCurrentFrame, useVideoConfig } from '@stageflip/frame-runtime';
import type { ReactElement } from 'react';

import type { ChartData } from '@stageflip/schema';

import { Axes } from './axes.js';
import { Legend } from './legend.js';
import {
  CANVAS_H,
  CANVAS_W,
  DEFAULT_PALETTE,
  EASE_OUT_EXPO,
  ENTRANCE_FRACTION,
  PADDING,
  type Palette,
  STAGGER_FRAMES,
} from './constants.js';

export interface LineChartProps {
  data: ChartData;
  legend: boolean;
  axes: boolean;
  palette?: Palette;
}

interface SeriesPath {
  d: string;
  totalLength: number;
}

function computePath(values: readonly (number | null)[], padding: typeof PADDING): SeriesPath {
  const numeric = values.map((v) => (typeof v === 'number' ? v : 0));
  const chartW = CANVAS_W - padding.left - padding.right;
  const chartH = CANVAS_H - padding.top - padding.bottom;
  const maxV = numeric.length === 0 ? 1 : Math.max(...numeric);
  const minV = numeric.length === 0 ? 0 : Math.min(...numeric);
  const range = maxV - minV || 1;
  const points = numeric.map((v, i) => ({
    x:
      numeric.length === 1
        ? padding.left + chartW / 2
        : padding.left + (i / (numeric.length - 1)) * chartW,
    y: padding.top + chartH - ((v - minV) / range) * chartH,
  }));
  let totalLength = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    if (prev === undefined || cur === undefined) continue;
    const dx = cur.x - prev.x;
    const dy = cur.y - prev.y;
    totalLength += Math.sqrt(dx * dx + dy * dy);
  }
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  return { d, totalLength };
}

export function LineChart({
  data,
  legend,
  axes,
  palette = DEFAULT_PALETTE,
}: LineChartProps): ReactElement {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const seriesList = data.series;
  // Compute buildFrames so the LAST staggered series's animation
  // completes at exactly floor(ENTRANCE_FRACTION * durationInFrames),
  // satisfying AC #13. Per-series stagger eats into the build window.
  const targetEnd = Math.floor(durationInFrames * ENTRANCE_FRACTION);
  const lastStaggerDelay = Math.max(0, seriesList.length - 1) * STAGGER_FRAMES;
  const buildFrames = Math.max(1, targetEnd - lastStaggerDelay);

  const allNumeric = seriesList.flatMap((s) =>
    s.values.filter((v): v is number => typeof v === 'number'),
  );
  const minVal = allNumeric.length === 0 ? 0 : Math.min(...allNumeric);
  const maxVal = allNumeric.length === 0 ? 1 : Math.max(...allNumeric);

  return (
    <svg
      data-testid="chart-line"
      width="100%"
      height="100%"
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      role="img"
    >
      <title>Line chart</title>
      {axes && (
        <Axes
          width={CANVAS_W}
          height={CANVAS_H}
          padding={PADDING}
          minVal={minVal}
          maxVal={maxVal}
          labels={data.labels}
          axisColor={palette.axis}
          gridColor={palette.gridline}
          textColor={palette.text}
        />
      )}
      {seriesList.map((series, seriesIndex) => {
        const path = computePath(series.values, PADDING);
        const delay = seriesIndex * STAGGER_FRAMES;
        const drawProgress = interpolate(frame, [delay, delay + buildFrames], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: EASE_OUT_EXPO,
        });
        const dashOffset = path.totalLength * (1 - drawProgress);
        return (
          <path
            // biome-ignore lint/suspicious/noArrayIndexKey: positional series identity is stable.
            key={seriesIndex}
            data-testid={`chart-line-path-${seriesIndex}`}
            d={path.d}
            fill="none"
            stroke={palette.series[seriesIndex % palette.series.length]}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={path.totalLength}
            strokeDashoffset={dashOffset}
          />
        );
      })}
      {legend && (
        <Legend
          x={CANVAS_W - 220}
          y={PADDING.top}
          entries={seriesList.map((s, i) => ({
            name: s.name,
            color: palette.series[i % palette.series.length] as string,
          }))}
          textColor={palette.text}
        />
      )}
    </svg>
  );
}
