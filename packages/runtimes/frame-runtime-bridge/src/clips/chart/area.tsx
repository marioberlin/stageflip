// packages/runtimes/frame-runtime-bridge/src/clips/chart/area.tsx
// T-406 D-T406-4 — area chart renderer. Each series renders one
// <path> (line) PLUS one <polygon> (filled area). Line draws via
// stroke-dasharray; area fills sweep-reveal via animated polygon
// vertices clipped to the build progress.

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

export interface AreaChartProps {
  data: ChartData;
  legend: boolean;
  axes: boolean;
  palette?: Palette;
}

interface SeriesPoints {
  points: ReadonlyArray<{ x: number; y: number }>;
  baselineY: number;
  totalLength: number;
}

function computePoints(
  values: readonly (number | null)[],
  minVal: number,
  maxVal: number,
): SeriesPoints {
  const numeric = values.map((v) => (typeof v === 'number' ? v : 0));
  const chartW = CANVAS_W - PADDING.left - PADDING.right;
  const chartH = CANVAS_H - PADDING.top - PADDING.bottom;
  const range = maxVal - minVal || 1;
  const points = numeric.map((v, i) => ({
    x:
      numeric.length === 1
        ? PADDING.left + chartW / 2
        : PADDING.left + (i / (numeric.length - 1)) * chartW,
    y: PADDING.top + chartH - ((v - minVal) / range) * chartH,
  }));
  const baselineY = PADDING.top + chartH;
  let totalLength = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    if (prev === undefined || cur === undefined) continue;
    const dx = cur.x - prev.x;
    const dy = cur.y - prev.y;
    totalLength += Math.sqrt(dx * dx + dy * dy);
  }
  return { points, baselineY, totalLength };
}

export function AreaChart({
  data,
  legend,
  axes,
  palette = DEFAULT_PALETTE,
}: AreaChartProps): ReactElement {
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
      data-testid="chart-area"
      width="100%"
      height="100%"
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      role="img"
    >
      <title>Area chart</title>
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
        const { points, baselineY, totalLength } = computePoints(series.values, minVal, maxVal);
        const delay = seriesIndex * STAGGER_FRAMES;
        const drawProgress = interpolate(frame, [delay, delay + buildFrames], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: EASE_OUT_EXPO,
        });
        const dashOffset = totalLength * (1 - drawProgress);
        const lineD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        // Fill polygon: line points + baseline closing path. Opacity
        // animates from 0 to 0.3 over the entrance window so the fill
        // sweep is perceived as a reveal.
        const polygonPoints = [
          ...points.map((p) => `${p.x},${p.y}`),
          ...(points.length > 0
            ? [`${points[points.length - 1]!.x},${baselineY}`, `${points[0]!.x},${baselineY}`]
            : []),
        ].join(' ');
        const fillOpacity = interpolate(frame, [delay, delay + buildFrames], [0, 0.3], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: EASE_OUT_EXPO,
        });
        const color = palette.series[seriesIndex % palette.series.length] as string;
        return (
          <g
            // biome-ignore lint/suspicious/noArrayIndexKey: positional series identity stable.
            key={seriesIndex}
          >
            {points.length > 1 && (
              <polygon
                data-testid={`chart-area-fill-${seriesIndex}`}
                points={polygonPoints}
                fill={color}
                opacity={fillOpacity}
              />
            )}
            <path
              data-testid={`chart-area-line-${seriesIndex}`}
              d={lineD}
              fill="none"
              stroke={color}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={totalLength}
              strokeDashoffset={dashOffset}
            />
          </g>
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
