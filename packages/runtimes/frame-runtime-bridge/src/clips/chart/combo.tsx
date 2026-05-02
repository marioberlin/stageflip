// packages/runtimes/frame-runtime-bridge/src/clips/chart/combo.tsx
// T-406 D-T406-4 — combo chart renderer. First series renders as bars
// (rise + fade-in); subsequent series render as draw-on lines. Pure
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

export interface ComboChartProps {
  data: ChartData;
  legend: boolean;
  axes: boolean;
  palette?: Palette;
}

interface PathInfo {
  d: string;
  totalLength: number;
}

function buildLinePath(
  values: readonly (number | null)[],
  minVal: number,
  range: number,
  chartW: number,
  chartH: number,
): PathInfo {
  const numeric = values.map((v) => (typeof v === 'number' ? v : 0));
  const points = numeric.map((v, i) => ({
    x:
      numeric.length === 1
        ? PADDING.left + chartW / 2
        : PADDING.left + (i / (numeric.length - 1)) * chartW,
    y: PADDING.top + chartH - ((v - minVal) / range) * chartH,
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

export function ComboChart({
  data,
  legend,
  axes,
  palette = DEFAULT_PALETTE,
}: ComboChartProps): ReactElement {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const seriesList = data.series;
  const barSeries = seriesList[0];
  const lineSeriesList = seriesList.slice(1);
  const barValues = barSeries?.values ?? [];

  const allNumeric = seriesList.flatMap((s) =>
    s.values.filter((v): v is number => typeof v === 'number'),
  );
  const maxVal = allNumeric.length === 0 ? 1 : Math.max(...allNumeric);
  const minVal = 0;
  const range = maxVal - minVal || 1;

  const chartW = CANVAS_W - PADDING.left - PADDING.right;
  const chartH = CANVAS_H - PADDING.top - PADDING.bottom;
  const barCount = barValues.length;
  const barSpacing = barCount === 0 ? 0 : chartW / barCount;
  const barWidth = barSpacing * 0.5;

  // Stagger budget shared between bars (per-bar) and line series (per-
  // series). The longest stagger drives buildFrames so the LAST staggered
  // entrance completes at floor(0.6 * durationInFrames) per AC #13.
  const longestStaggerCount = Math.max(barCount, lineSeriesList.length);
  const targetEnd = Math.floor(durationInFrames * ENTRANCE_FRACTION);
  const lastStaggerDelay = Math.max(0, longestStaggerCount - 1) * STAGGER_FRAMES;
  const buildFrames = Math.max(1, targetEnd - lastStaggerDelay);

  return (
    <svg
      data-testid="chart-combo"
      width="100%"
      height="100%"
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      role="img"
    >
      <title>Combo chart</title>
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
      {barValues.map((rawVal, i) => {
        const val = typeof rawVal === 'number' ? rawVal : 0;
        const delay = i * STAGGER_FRAMES;
        const heightPx = interpolate(
          frame,
          [delay, delay + buildFrames],
          [0, ((val - minVal) / range) * chartH],
          {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: EASE_OUT_EXPO,
          },
        );
        const opacity = interpolate(frame, [delay, delay + Math.min(buildFrames, 8)], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const x = PADDING.left + i * barSpacing + (barSpacing - barWidth) / 2;
        const y = PADDING.top + chartH - heightPx;
        return (
          <rect
            // biome-ignore lint/suspicious/noArrayIndexKey: positional bar at slot i is the same bar across renders.
            key={i}
            data-testid={`chart-combo-bar-${i}`}
            x={x}
            y={y}
            width={barWidth}
            height={heightPx}
            fill={palette.series[0]}
            opacity={opacity}
            rx={4}
          />
        );
      })}
      {lineSeriesList.map((series, lineIdx) => {
        const seriesIndex = lineIdx + 1; // shift past bar series for palette
        const path = buildLinePath(series.values, minVal, range, chartW, chartH);
        const delay = lineIdx * STAGGER_FRAMES;
        const drawProgress = interpolate(frame, [delay, delay + buildFrames], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: EASE_OUT_EXPO,
        });
        const dashOffset = path.totalLength * (1 - drawProgress);
        return (
          <path
            // biome-ignore lint/suspicious/noArrayIndexKey: positional line series identity stable.
            key={lineIdx}
            data-testid={`chart-combo-line-${lineIdx}`}
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
