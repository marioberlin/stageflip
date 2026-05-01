// packages/runtimes/frame-runtime-bridge/src/clips/chart/scatter.tsx
// T-406 D-T406-4 — scatter chart renderer. One <circle> per (series,
// valueIndex). Each point fades in with a per-point stagger; positions
// are deterministic (no jitter — D-T406-7 defers jitter to v2). Pure
// function of `(frame, props, palette)` per AC #19. SVG only; no
// inline hex literals (AC #16).

import { interpolate, useCurrentFrame, useVideoConfig } from '@stageflip/frame-runtime';
import type { ReactElement } from 'react';

import type { ChartData } from '@stageflip/schema';

import { Axes } from './axes.js';
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
import { Legend } from './legend.js';

export interface ScatterChartProps {
  data: ChartData;
  legend: boolean;
  axes: boolean;
  palette?: Palette;
}

export function ScatterChart({
  data,
  legend,
  axes,
  palette = DEFAULT_PALETTE,
}: ScatterChartProps): ReactElement {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const seriesList = data.series;

  const allNumeric = seriesList.flatMap((s) =>
    s.values.filter((v): v is number => typeof v === 'number'),
  );
  const minVal = allNumeric.length === 0 ? 0 : Math.min(...allNumeric);
  const maxVal = allNumeric.length === 0 ? 1 : Math.max(...allNumeric);
  const range = maxVal - minVal || 1;

  const chartW = CANVAS_W - PADDING.left - PADDING.right;
  const chartH = CANVAS_H - PADDING.top - PADDING.bottom;

  // Total point count drives stagger budget so the LAST point's fade-in
  // completes at floor(0.6 * durationInFrames) per AC #13.
  const totalPoints = seriesList.reduce((sum, s) => sum + s.values.length, 0);
  const targetEnd = Math.floor(durationInFrames * ENTRANCE_FRACTION);
  const lastStaggerDelay = Math.max(0, totalPoints - 1) * STAGGER_FRAMES;
  const buildFrames = Math.max(1, targetEnd - lastStaggerDelay);

  // Flatten (series, valueIndex) pairs in stagger order: serialize by
  // series first, then by index within series. Stagger index = global
  // position so later points appear later regardless of series.
  let staggerIndex = 0;
  const flattened: Array<{
    seriesIndex: number;
    valueIndex: number;
    x: number;
    y: number;
    stagger: number;
  }> = [];
  for (let s = 0; s < seriesList.length; s++) {
    const series = seriesList[s];
    if (series === undefined) continue;
    const values = series.values;
    for (let i = 0; i < values.length; i++) {
      const rawVal = values[i];
      const val = typeof rawVal === 'number' ? rawVal : 0;
      const x =
        values.length === 1
          ? PADDING.left + chartW / 2
          : PADDING.left + (i / (values.length - 1)) * chartW;
      const y = PADDING.top + chartH - ((val - minVal) / range) * chartH;
      flattened.push({ seriesIndex: s, valueIndex: i, x, y, stagger: staggerIndex });
      staggerIndex++;
    }
  }

  return (
    <svg
      data-testid="chart-scatter"
      width="100%"
      height="100%"
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      role="img"
    >
      <title>Scatter chart</title>
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
      {flattened.map((p) => {
        const delay = p.stagger * STAGGER_FRAMES;
        const opacity = interpolate(frame, [delay, delay + buildFrames], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: EASE_OUT_EXPO,
        });
        return (
          <circle
            key={`${p.seriesIndex}-${p.valueIndex}`}
            data-testid={`chart-scatter-point-${p.seriesIndex}-${p.valueIndex}`}
            cx={p.x}
            cy={p.y}
            r={6}
            fill={palette.series[p.seriesIndex % palette.series.length]}
            opacity={opacity}
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
