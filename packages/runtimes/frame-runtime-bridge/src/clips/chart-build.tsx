// packages/runtimes/frame-runtime-bridge/src/clips/chart-build.tsx
// T-131b.1 port of reference/slidemotion/.../clips/chart-build.tsx.
// Bar chart whose bars rise + fade in with a per-bar stagger.

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

export const chartBuildPropsSchema = z
  .object({
    values: z.array(z.number()).min(1),
    labels: z.array(z.string()).optional(),
    color: z.string().optional(),
    background: z.string().optional(),
    labelColor: z.string().optional(),
  })
  .strict();

export type ChartBuildProps = z.infer<typeof chartBuildPropsSchema>;

const EASE_OUT_EXPO = cubicBezier(0.16, 1, 0.3, 1);
const PER_BAR_DELAY = 5;
const FADE_FRAMES = 8;
const MIN_BAR_HEIGHT_PX = 4;

export function ChartBuild({
  values,
  labels,
  color = '#0072e5',
  background = '#0c1116',
  labelColor = '#666666',
}: ChartBuildProps): ReactElement {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const buildFrames = Math.ceil(durationInFrames * 0.6);
  const maxVal = Math.max(...values);
  const denom = maxVal === 0 ? 1 : maxVal;
  return (
    <div
      data-testid="chart-build-clip"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: '4%',
        padding: '10% 8% 15%',
        backgroundColor: background,
      }}
    >
      {values.map((val, i) => {
        const delay = i * PER_BAR_DELAY;
        const heightPct = interpolate(
          frame,
          [delay, delay + buildFrames],
          [0, (val / denom) * 100],
          {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: EASE_OUT_EXPO,
          },
        );
        const opacity = interpolate(frame, [delay, delay + FADE_FRAMES], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const label = labels?.[i];
        return (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: values[] is positional chart data — bar at slot i is conceptually the same bar across renders. Stable identity by index is intended.
            key={i}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              opacity,
            }}
          >
            <div
              data-testid={`chart-build-bar-${i}`}
              style={{
                width: '100%',
                height: `${heightPct}%`,
                backgroundColor: color,
                borderRadius: '6px 6px 0 0',
                minHeight: MIN_BAR_HEIGHT_PX,
              }}
            />
            {label !== undefined && label.length > 0 && (
              <span
                style={{
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize: 14,
                  color: labelColor,
                }}
              >
                {label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export const chartBuildClip: ClipDefinition<unknown> = defineFrameClip<ChartBuildProps>({
  kind: 'chart-build',
  component: ChartBuild,
  propsSchema: chartBuildPropsSchema,
  themeSlots: {
    color: { kind: 'palette', role: 'primary' },
    background: { kind: 'palette', role: 'background' },
    // Axis-label muted grey maps to `surface` — the closest "subdued
    // foreground" role in our palette. Without this slot, axis labels
    // would stay at the literal default after a theme swap.
    labelColor: { kind: 'palette', role: 'surface' },
  },
  fontRequirements: () => [{ family: 'Plus Jakarta Sans', weight: 400 }],
});
