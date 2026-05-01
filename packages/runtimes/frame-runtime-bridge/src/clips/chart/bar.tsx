// packages/runtimes/frame-runtime-bridge/src/clips/chart/bar.tsx
// T-406 D-T406-4 — bar chart renderer. Vertical bars rise from baseline
// + fade in with per-bar stagger. Pure function of `(frame, props,
// palette)` per AC #19. SVG only; no inline hex literals (AC #16).

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

export interface BarChartProps {
  data: ChartData;
  legend: boolean;
  axes: boolean;
  /** Resolved palette; defaults to {@link DEFAULT_PALETTE}. */
  palette?: Palette;
}

/**
 * Render a bar chart. Multi-series input is rendered as stacked bars
 * along the x-axis (one bar group per label), but v1 ships single-
 * series rendering only — additional series are ignored. (Multi-
 * series stacked bars are a v2 enhancement; combo charts cover the
 * dual-series case.)
 */
export function BarChart({
  data,
  legend,
  axes,
  palette = DEFAULT_PALETTE,
}: BarChartProps): ReactElement {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const series = data.series[0];
  const values = series?.values ?? [];
  const labels = data.labels;
  // Compute buildFrames so the LAST staggered bar's animation
  // completes at exactly floor(ENTRANCE_FRACTION * durationInFrames),
  // satisfying AC #13. The build window per bar is shorter than the
  // entrance fraction because each bar starts at delay i*STAGGER.
  const targetEnd = Math.floor(durationInFrames * ENTRANCE_FRACTION);
  const lastStaggerDelay = Math.max(0, values.length - 1) * STAGGER_FRAMES;
  const buildFrames = Math.max(1, targetEnd - lastStaggerDelay);

  const numericValues = values.filter((v): v is number => typeof v === 'number');
  const maxVal = numericValues.length === 0 ? 1 : Math.max(...numericValues);
  const denom = maxVal === 0 ? 1 : maxVal;

  const chartW = CANVAS_W - PADDING.left - PADDING.right;
  const chartH = CANVAS_H - PADDING.top - PADDING.bottom;
  const barCount = values.length;
  const barSpacing = barCount === 0 ? 0 : chartW / barCount;
  const barWidth = barSpacing * 0.7;

  return (
    <svg
      data-testid="chart-bar"
      width="100%"
      height="100%"
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      role="img"
    >
      <title>Bar chart</title>
      {axes && (
        <Axes
          width={CANVAS_W}
          height={CANVAS_H}
          padding={PADDING}
          minVal={0}
          maxVal={maxVal}
          labels={labels}
          axisColor={palette.axis}
          gridColor={palette.gridline}
          textColor={palette.text}
        />
      )}
      {values.map((rawVal, i) => {
        const val = typeof rawVal === 'number' ? rawVal : 0;
        const delay = i * STAGGER_FRAMES;
        const heightPx = interpolate(
          frame,
          [delay, delay + buildFrames],
          [0, (val / denom) * chartH],
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
            data-testid={`chart-bar-rect-${i}`}
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
      {legend && series !== undefined && (
        <Legend
          x={CANVAS_W - 220}
          y={PADDING.top}
          entries={[{ name: series.name, color: palette.series[0] }]}
          textColor={palette.text}
        />
      )}
    </svg>
  );
}
