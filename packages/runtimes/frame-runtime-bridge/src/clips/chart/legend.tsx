// packages/runtimes/frame-runtime-bridge/src/clips/chart/legend.tsx
// Shared legend renderer for all 7 chart kinds. Pure SVG; pure function
// of (x, y, entries, textColor). Renders one row per entry: a coloured
// swatch followed by the series name.

import type { ReactElement } from 'react';

export interface LegendEntry {
  /** Series name displayed beside the swatch. */
  name: string;
  /** Swatch fill color. */
  color: string;
}

export interface LegendProps {
  /** Top-left x coordinate. */
  x: number;
  /** Top-left y coordinate. */
  y: number;
  /** Series → swatch + name list. */
  entries: readonly LegendEntry[];
  /** Color for the legend text. */
  textColor: string;
}

const ROW_HEIGHT = 28;
const SWATCH_SIZE = 14;
const SWATCH_GAP = 8;

/**
 * Render the legend. Empty entries → nothing rendered (still safe; the
 * caller can pass `entries: []` without conditional logic).
 */
export function Legend({ x, y, entries, textColor }: LegendProps): ReactElement {
  return (
    <g data-testid="chart-legend">
      {entries.map((entry, i) => (
        <g
          // biome-ignore lint/suspicious/noArrayIndexKey: legend rows are positional + stable across renders.
          key={i}
          data-testid={`chart-legend-entry-${i}`}
          transform={`translate(${x}, ${y + i * ROW_HEIGHT})`}
        >
          <rect x={0} y={2} width={SWATCH_SIZE} height={SWATCH_SIZE} fill={entry.color} rx={2} />
          <text
            x={SWATCH_SIZE + SWATCH_GAP}
            y={SWATCH_SIZE - 1}
            fill={textColor}
            fontSize={14}
            fontFamily="Plus Jakarta Sans"
          >
            {entry.name}
          </text>
        </g>
      ))}
    </g>
  );
}
