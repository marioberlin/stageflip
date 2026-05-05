// packages/runtimes/frame-runtime-bridge/src/clips/outcome-row.tsx
// T-358a — `outcome-row` runtime-clip primitive: a row of N (1..12)
// independently color-coded shapes (chips) with staggered fade-in.
// Generic primitive used by Cluster B/E scorebug-family presets
// (cricket ball-by-ball dots, tennis tiebreak points, F1 sector history,
// soccer last-N-shots). Cluster-specific outcome→color mapping lives in
// `parity-cli` resolver shims, not in this primitive.

import { interpolate, useCurrentFrame } from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const outcomeRowChipSchema = z
  .object({
    color: z.string().regex(HEX_COLOR_RE, 'chip color must be a 6-char hex'),
    label: z.string().optional(),
  })
  .strict();

export const outcomeRowPropsSchema = z
  .object({
    chips: z.array(outcomeRowChipSchema).min(1).max(12),
    shape: z.enum(['circle', 'square', 'rounded']).optional(),
    chipSize: z.enum(['small', 'medium', 'large']).optional(),
    gap: z.number().int().positive().optional(),
    defaultFill: z.string().optional(),
    outlineColor: z.string().optional(),
    background: z.string().optional(),
  })
  .strict();

export type OutcomeRowProps = z.infer<typeof outcomeRowPropsSchema>;

const SIZE_PX: Record<NonNullable<OutcomeRowProps['chipSize']>, number> = {
  small: 56,
  medium: 96,
  large: 144,
};

const ROUNDED_CORNER_RATIO = 0.22;

/**
 * Renders a horizontal row of color-coded chips. Each chip's fill is
 * its required per-chip `color`. Chips fade in with a staggered window
 * (`delay = i * 4` frames, 12-frame ramp), so a row of 6 settles by
 * frame 32 and a row of 12 settles by frame 56.
 */
export function OutcomeRow({
  chips,
  shape = 'circle',
  chipSize = 'medium',
  gap,
  outlineColor,
  background,
}: OutcomeRowProps): ReactElement {
  const frame = useCurrentFrame();
  const diameter = SIZE_PX[chipSize];
  const chipGap = gap ?? Math.round(diameter * 0.4);
  const cornerRadius = shape === 'rounded' ? Math.round(diameter * ROUNDED_CORNER_RATIO) : 0;
  const strokeWidth = outlineColor !== undefined ? 2 : 0;

  return (
    <div
      data-testid="outcome-row-clip"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: chipGap,
        backgroundColor: background ?? 'transparent',
        boxSizing: 'border-box',
        padding: 80,
      }}
    >
      {chips.map((chip, i) => {
        const delay = i * 4;
        const opacity = interpolate(frame, [delay, delay + 12], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        return (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: positional chip slot — slot i is the same chip across renders.
            key={i}
            data-testid={`outcome-row-chip-${i}`}
            aria-label={chip.label}
            style={{
              width: diameter,
              height: diameter,
              opacity,
              flex: '0 0 auto',
            }}
          >
            <svg
              width={diameter}
              height={diameter}
              viewBox={`0 0 ${diameter} ${diameter}`}
              role="img"
              aria-hidden={chip.label === undefined}
            >
              <title>{chip.label ?? `outcome ${i + 1}`}</title>
              {shape === 'circle' ? (
                <circle
                  cx={diameter / 2}
                  cy={diameter / 2}
                  r={diameter / 2 - strokeWidth}
                  fill={chip.color}
                  stroke={outlineColor}
                  strokeWidth={strokeWidth}
                />
              ) : (
                <rect
                  x={strokeWidth / 2}
                  y={strokeWidth / 2}
                  width={diameter - strokeWidth}
                  height={diameter - strokeWidth}
                  rx={cornerRadius}
                  ry={cornerRadius}
                  fill={chip.color}
                  stroke={outlineColor}
                  strokeWidth={strokeWidth}
                />
              )}
            </svg>
          </div>
        );
      })}
    </div>
  );
}

export const outcomeRowClip: ClipDefinition<unknown> = defineFrameClip<OutcomeRowProps>({
  kind: 'outcome-row',
  component: OutcomeRow,
  propsSchema: outcomeRowPropsSchema,
  themeSlots: {
    defaultFill: { kind: 'palette', role: 'surface' },
    outlineColor: { kind: 'palette', role: 'foreground' },
    background: { kind: 'palette', role: 'background' },
  },
});
