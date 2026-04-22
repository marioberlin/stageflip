// packages/runtimes/frame-runtime-bridge/src/clips/pie-chart-build.tsx
// T-131b.2 port of reference/slidemotion/.../clips/pie-chart-build.tsx.
// Pie / donut chart built via SVG stroke-dasharray animation per segment.

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

export const pieChartBuildPropsSchema = z
  .object({
    values: z.array(z.number().nonnegative()).min(1),
    labels: z.array(z.string()).optional(),
    colors: z.array(z.string()).optional(),
    title: z.string().optional(),
    donut: z.boolean().optional(),
    background: z.string().optional(),
    titleColor: z.string().optional(),
    legendColor: z.string().optional(),
  })
  .strict();

export type PieChartBuildProps = z.infer<typeof pieChartBuildPropsSchema>;

const DEFAULT_COLORS = [
  '#81aeff',
  '#5af8fb',
  '#0072e5',
  '#f6c148',
  '#a78bfa',
  '#34d399',
  '#fb7185',
  '#fbbf24',
];
const EASE_OUT_EXPO = cubicBezier(0.16, 1, 0.3, 1);
const CX = 960;
const CY = 540;
const RADIUS = 300;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const PER_SEGMENT_DELAY = 6;

export function PieChartBuild({
  values,
  labels,
  colors = DEFAULT_COLORS,
  title,
  donut = false,
  background = '#0c1116',
  titleColor = '#ebf1fa',
  legendColor = '#666666',
}: PieChartBuildProps): ReactElement {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const total = values.reduce((s, v) => s + v, 0) || 1;
  const strokeWidth = donut ? 80 : RADIUS;

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const legendOpacity = interpolate(
    frame,
    [durationInFrames * 0.6, durationInFrames * 0.8],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  let cumulativeAngle = -90;
  const segments = values.map((val, i) => {
    const segmentFraction = val / total;
    const segmentLength = segmentFraction * CIRCUMFERENCE;
    const delay = i * PER_SEGMENT_DELAY;
    const animDuration = Math.max(10, durationInFrames * 0.5);
    const dashLength = interpolate(frame, [delay, delay + animDuration], [0, segmentLength], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: EASE_OUT_EXPO,
    });
    const rotation = cumulativeAngle;
    cumulativeAngle += segmentFraction * 360;
    return {
      dashLength,
      rotation,
      color: colors[i % colors.length] ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length] ?? '#81aeff',
    };
  });

  return (
    <div
      data-testid="pie-chart-build-clip"
      style={{ width: '100%', height: '100%', backgroundColor: background, position: 'relative' }}
    >
      {title !== undefined && title.length > 0 && (
        <div
          data-testid="pie-chart-title"
          style={{
            position: 'absolute',
            top: 40,
            width: '100%',
            textAlign: 'center',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 32,
            fontWeight: 700,
            color: titleColor,
            opacity: titleOpacity,
          }}
        >
          {title}
        </div>
      )}

      <svg
        width="1920"
        height="1080"
        viewBox="0 0 1920 1080"
        style={{ width: '100%', height: '100%' }}
        role="img"
      >
        <title>{title ?? 'Pie chart'}</title>
        {segments.map((seg, i) => (
          <circle
            // biome-ignore lint/suspicious/noArrayIndexKey: values[] is positional chart data — segment at slot i is conceptually the same segment across renders.
            key={i}
            cx={CX}
            cy={CY}
            r={RADIUS}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${seg.dashLength} ${CIRCUMFERENCE}`}
            transform={`rotate(${seg.rotation} ${CX} ${CY})`}
            strokeLinecap={donut ? 'round' : 'butt'}
          />
        ))}
      </svg>

      {labels !== undefined && (
        <div
          data-testid="pie-chart-legend"
          style={{
            position: 'absolute',
            bottom: 60,
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            gap: 32,
            opacity: legendOpacity,
          }}
        >
          {labels.map((label, i) => {
            const value = values[i] ?? 0;
            const pct = Math.round((value / total) * 100);
            return (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: positional legend entry aligned with values[].
                key={i}
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 3,
                    backgroundColor: segments[i]?.color ?? DEFAULT_COLORS[0],
                  }}
                />
                <span
                  style={{
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    fontSize: 16,
                    color: legendColor,
                  }}
                >
                  {label} ({pct}%)
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const pieChartBuildClip: ClipDefinition<unknown> = defineFrameClip<PieChartBuildProps>({
  kind: 'pie-chart-build',
  component: PieChartBuild,
  propsSchema: pieChartBuildPropsSchema,
  themeSlots: {
    background: { kind: 'palette', role: 'background' },
    titleColor: { kind: 'palette', role: 'foreground' },
    // legendColor is *text*, not a surface fill. `surface` is reserved for
    // panel/card backgrounds; mapping it here would hide labels on most
    // themes. `foreground` is the safe text-on-bg default.
    legendColor: { kind: 'palette', role: 'foreground' },
  },
  fontRequirements: () => [{ family: 'Plus Jakarta Sans', weight: 700 }],
});
