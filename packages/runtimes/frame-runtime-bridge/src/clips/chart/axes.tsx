// packages/runtimes/frame-runtime-bridge/src/clips/chart/axes.tsx
// Shared axis renderer for bar / line / area / scatter / combo charts.
// Pure SVG; pure function of (width, height, padding, minVal, maxVal,
// labels, colors). Renders 5 horizontal gridlines + y-axis tick labels
// (at 0%, 25%, 50%, 75%, 100% of value range) + x-axis tick labels
// (one per data label, evenly spaced).

import type { ReactElement } from 'react';

export interface AxesProps {
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
  minVal: number;
  maxVal: number;
  labels: readonly string[];
  axisColor: string;
  gridColor: string;
  textColor: string;
  /** When true, no axes / gridlines / labels are rendered. */
  omit?: boolean;
}

/**
 * Render axis lines + 5 gridlines + tick labels. Pure function — no
 * frame-runtime hooks consumed; the entrance animation is the chart
 * data's responsibility, not the axes'.
 */
export function Axes({
  width,
  height,
  padding,
  minVal,
  maxVal,
  labels,
  axisColor,
  gridColor,
  textColor,
  omit,
}: AxesProps): ReactElement | null {
  if (omit === true) return null;
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const range = maxVal - minVal || 1;

  return (
    <g data-testid="chart-axes">
      {/* y-axis vertical line */}
      <line
        data-testid="chart-axes-y"
        x1={padding.left}
        y1={padding.top}
        x2={padding.left}
        y2={padding.top + chartH}
        stroke={axisColor}
        strokeWidth={1}
      />
      {/* x-axis horizontal line */}
      <line
        data-testid="chart-axes-x"
        x1={padding.left}
        y1={padding.top + chartH}
        x2={padding.left + chartW}
        y2={padding.top + chartH}
        stroke={axisColor}
        strokeWidth={1}
      />
      {/* y-axis tick labels + horizontal gridlines */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
        const y = padding.top + chartH * (1 - pct);
        const val = minVal + range * pct;
        return (
          <g
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed 5-line gridline; index is the stable identity.
            key={i}
          >
            <line
              x1={padding.left}
              y1={y}
              x2={padding.left + chartW}
              y2={y}
              stroke={gridColor}
              strokeWidth={1}
            />
            <text
              data-testid={`chart-axes-y-label-${i}`}
              x={padding.left - 10}
              y={y + 5}
              textAnchor="end"
              fill={textColor}
              fontSize={14}
              fontFamily="Plus Jakarta Sans"
            >
              {Math.round(val)}
            </text>
          </g>
        );
      })}
      {/* x-axis tick labels (one per data label) */}
      {labels.map((label, i) => {
        const x =
          labels.length === 1
            ? padding.left + chartW / 2
            : padding.left + (i / (labels.length - 1)) * chartW;
        return (
          <text
            // biome-ignore lint/suspicious/noArrayIndexKey: positional label aligned with data index.
            key={i}
            data-testid={`chart-axes-x-label-${i}`}
            x={x}
            y={padding.top + chartH + 30}
            textAnchor="middle"
            fill={textColor}
            fontSize={14}
            fontFamily="Plus Jakarta Sans"
          >
            {label}
          </text>
        );
      })}
    </g>
  );
}
