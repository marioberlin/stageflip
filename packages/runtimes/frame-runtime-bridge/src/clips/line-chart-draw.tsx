// packages/runtimes/frame-runtime-bridge/src/clips/line-chart-draw.tsx
// T-131b.2 port of reference/slidemotion/.../clips/line-chart-draw.tsx.
// SVG line chart with stroke-dashoffset path draw + staggered dots + labels.

import {
  cubicBezier,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

export const lineChartDrawPropsSchema = z
  .object({
    values: z.array(z.number()).min(2),
    labels: z.array(z.string()).optional(),
    color: z.string().optional(),
    lineWidth: z.number().positive().optional(),
    showDots: z.boolean().optional(),
    title: z.string().optional(),
    background: z.string().optional(),
    titleColor: z.string().optional(),
    gridColor: z.string().optional(),
    axisLabelColor: z.string().optional(),
    dataLabelColor: z.string().optional(),
  })
  .strict();

export type LineChartDrawProps = z.infer<typeof lineChartDrawPropsSchema>;

const EASE_OUT_EXPO = cubicBezier(0.16, 1, 0.3, 1);
const EASE_BOUNCE = cubicBezier(0.34, 1.56, 0.64, 1);
const PADDING = { top: 80, right: 60, bottom: 60, left: 70 };
const CANVAS_W = 1920;
const CANVAS_H = 1080;

export function LineChartDraw({
  values,
  labels,
  color = '#0072e5',
  lineWidth = 3,
  showDots = true,
  title,
  background = '#0c1116',
  titleColor = '#ebf1fa',
  gridColor = '#f0f0f0',
  axisLabelColor = '#999999',
  dataLabelColor = '#666666',
}: LineChartDrawProps): ReactElement {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const chartW = CANVAS_W - PADDING.left - PADDING.right;
  const chartH = CANVAS_H - PADDING.top - PADDING.bottom;
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  const range = maxVal - minVal || 1;

  const points = values.map((v, i) => ({
    x: PADDING.left + (i / (values.length - 1)) * chartW,
    y: PADDING.top + chartH - ((v - minVal) / range) * chartH,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  let totalLength = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    if (prev === undefined || cur === undefined) continue;
    const dx = cur.x - prev.x;
    const dy = cur.y - prev.y;
    totalLength += Math.sqrt(dx * dx + dy * dy);
  }

  const drawProgress = interpolate(frame, [0, durationInFrames * 0.7], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT_EXPO,
  });
  const dashOffset = totalLength * (1 - drawProgress);

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      data-testid="line-chart-draw-clip"
      style={{ width: '100%', height: '100%', backgroundColor: background, position: 'relative' }}
    >
      {title !== undefined && title.length > 0 && (
        <div
          data-testid="line-chart-title"
          style={{
            position: 'absolute',
            top: 24,
            left: PADDING.left,
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 28,
            fontWeight: 700,
            color: titleColor,
            opacity: titleOpacity,
          }}
        >
          {title}
        </div>
      )}

      <svg
        width={CANVAS_W}
        height={CANVAS_H}
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        style={{ width: '100%', height: '100%' }}
        role="img"
      >
        <title>{title ?? 'Line chart'}</title>
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
          const y = PADDING.top + chartH * (1 - pct);
          const val = minVal + range * pct;
          return (
            <g
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed 5-line grid.
              key={i}
            >
              <line
                x1={PADDING.left}
                y1={y}
                x2={PADDING.left + chartW}
                y2={y}
                stroke={gridColor}
                strokeWidth={1}
              />
              <text
                x={PADDING.left - 10}
                y={y + 5}
                textAnchor="end"
                fill={axisLabelColor}
                fontSize={14}
                fontFamily="Plus Jakarta Sans"
              >
                {Math.round(val)}
              </text>
            </g>
          );
        })}

        <path
          data-testid="line-chart-path"
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth={lineWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={totalLength}
          strokeDashoffset={dashOffset}
        />

        {showDots &&
          points.map((p, i) => {
            const dotDelay = (i / points.length) * durationInFrames * 0.7;
            const dotOpacity = interpolate(frame, [dotDelay, dotDelay + 8], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            const dotScale = interpolate(frame, [dotDelay, dotDelay + 10], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: EASE_BOUNCE,
            });
            return (
              <circle
                // biome-ignore lint/suspicious/noArrayIndexKey: positional data point aligned with values[].
                key={i}
                cx={p.x}
                cy={p.y}
                r={6 * dotScale}
                fill={color}
                opacity={dotOpacity}
                data-testid={`line-chart-dot-${i}`}
              />
            );
          })}

        {labels !== undefined &&
          points.map((p, i) => {
            const label = labels[i];
            if (label === undefined || label.length === 0) return null;
            const labelOpacity = interpolate(
              frame,
              [durationInFrames * 0.6, durationInFrames * 0.8],
              [0, 1],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
            );
            return (
              <text
                // biome-ignore lint/suspicious/noArrayIndexKey: positional label aligned with values[].
                key={i}
                x={p.x}
                y={PADDING.top + chartH + 30}
                textAnchor="middle"
                fill={dataLabelColor}
                fontSize={14}
                fontFamily="Plus Jakarta Sans"
                opacity={labelOpacity}
              >
                {label}
              </text>
            );
          })}
      </svg>
    </div>
  );
}

export const lineChartDrawClip: ClipDefinition<unknown> = defineFrameClip<LineChartDrawProps>({
  kind: 'line-chart-draw',
  component: LineChartDraw,
  propsSchema: lineChartDrawPropsSchema,
  themeSlots: {
    color: { kind: 'palette', role: 'primary' },
    background: { kind: 'palette', role: 'background' },
    titleColor: { kind: 'palette', role: 'foreground' },
    // Axis + data labels are *text*. `surface` is for panel backgrounds; it
    // would render labels invisible on most themes. `foreground` keeps them
    // legible; themes that want a muted label colour can override via
    // explicit props or future tokens.
    axisLabelColor: { kind: 'palette', role: 'foreground' },
    dataLabelColor: { kind: 'palette', role: 'foreground' },
  },
  fontRequirements: () => [{ family: 'Plus Jakarta Sans', weight: 400 }],
});
