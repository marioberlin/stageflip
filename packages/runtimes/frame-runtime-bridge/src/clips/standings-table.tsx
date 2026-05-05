// packages/runtimes/frame-runtime-bridge/src/clips/standings-table.tsx
// T-357a — `standings-table` runtime-clip primitive: a vertical ranked
// table of N (1..16) rows with K (2..8) columns of mixed kind
// (`rank` / `label` / `numeric` / `delta` / `total`); per-column color
// tinting; delta-arrow glyphs (↑ / ↓ / ▬) driven by string enum or
// numeric sign; frame-derived per-row entrance stagger (fade + slide).
// Generic primitive used by Cluster A/B/E ranked-list presets (Olympic
// medal-table, F1 / NBA / NCAA / golf leaderboards, election results,
// crypto top-N market-cap dashboards). Cluster-specific palettes + row
// payloads live in `parity-cli` resolver shims, not in this primitive.

import { interpolate, useCurrentFrame, useVideoConfig } from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const hex = () => z.string().regex(HEX_COLOR_RE);

const standingsTableRowSchema = z
  .object({
    rank: z.number().int().nonnegative(),
    code: z.string().min(1),
    values: z.array(z.number()),
    total: z.number().optional(),
    delta: z.union([z.enum(['up', 'down', 'flat']), z.number()]).optional(),
  })
  .strict();

const standingsTableColumnSchema = z
  .object({
    key: z.string().min(1),
    label: z.string(),
    kind: z.enum(['rank', 'label', 'numeric', 'delta', 'total']),
    color: hex().optional(),
    width: z.number().positive().optional(),
    flex: z.number().positive().optional(),
  })
  .strict();

export const standingsTablePropsSchema = z
  .object({
    rows: z.array(standingsTableRowSchema).min(1).max(16),
    columns: z.array(standingsTableColumnSchema).min(2).max(8),
    rowHeight: z.number().positive().optional(),
    headerHeight: z.number().positive().optional(),
    staggerMs: z.number().nonnegative().optional(),
    bandPosition: z.enum(['overlay', 'fullscreen']).optional(),
    background: hex().optional(),
    foreground: hex().optional(),
    // `goldColor` / `silverColor` / `bronzeColor` are theme-derived
    // accent slots; the parity-cli resolver shim wires them into
    // `column.color` for medal-style tinting (D-T357a-5).
    goldColor: hex().optional(),
    silverColor: hex().optional(),
    bronzeColor: hex().optional(),
    upColor: hex().optional(),
    downColor: hex().optional(),
    flatColor: hex().optional(),
  })
  .strict();

export type StandingsTableProps = z.infer<typeof standingsTablePropsSchema>;
type StandingsTableColumn = StandingsTableProps['columns'][number];
type StandingsTableRow = StandingsTableProps['rows'][number];

const DEFAULT_ROW_HEIGHT = 64;
const DEFAULT_HEADER_HEIGHT = 48;
const DEFAULT_STAGGER_MS = 80;
const DEFAULT_BACKGROUND = '#0E0E12';
const DEFAULT_FOREGROUND = '#FFFFFF';
const DEFAULT_UP_COLOR = '#22c55e';
const DEFAULT_DOWN_COLOR = '#ef4444';
const DEFAULT_FLAT_COLOR = '#9ca3af';
const ENTRANCE_FRAMES = 12;
const SLIDE_DISTANCE_PX = 8;
const HEAVY_FONT_WEIGHT = 700;
const FONT_FAMILY = 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif';

const DELTA_GLYPH = { up: '↑', down: '↓', flat: '▬' } as const;

type DeltaDirection = keyof typeof DELTA_GLYPH;

function deltaDirection(delta: StandingsTableRow['delta']): DeltaDirection | null {
  if (delta === undefined) return null;
  if (typeof delta === 'string') return delta;
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'flat';
}

interface CellOutput {
  content: ReactNode;
  textAlign: CSSProperties['textAlign'];
  color: string;
  fontVariantNumeric: CSSProperties['fontVariantNumeric'];
  fontWeight: CSSProperties['fontWeight'];
}

function renderCell(
  row: StandingsTableRow,
  column: StandingsTableColumn,
  numericIndex: number,
  fg: string,
  upColor: string,
  downColor: string,
  flatColor: string,
): CellOutput {
  const colColor = column.color;
  switch (column.kind) {
    case 'rank':
      return {
        content: row.rank,
        textAlign: 'right',
        color: colColor ?? fg,
        fontVariantNumeric: 'tabular-nums',
        fontWeight: 500,
      };
    case 'label':
      return {
        content: row.code,
        textAlign: 'left',
        color: colColor ?? fg,
        fontVariantNumeric: undefined,
        fontWeight: 600,
      };
    case 'numeric':
      return {
        content: row.values[numericIndex] ?? '',
        textAlign: 'right',
        color: colColor ?? fg,
        fontVariantNumeric: 'tabular-nums',
        fontWeight: 500,
      };
    case 'total':
      return {
        content: row.total ?? '',
        textAlign: 'right',
        color: colColor ?? fg,
        fontVariantNumeric: 'tabular-nums',
        fontWeight: HEAVY_FONT_WEIGHT,
      };
    case 'delta': {
      const direction = deltaDirection(row.delta);
      if (direction === null) {
        return {
          content: '',
          textAlign: 'center',
          color: colColor ?? fg,
          fontVariantNumeric: undefined,
          fontWeight: 500,
        };
      }
      const color = direction === 'up' ? upColor : direction === 'down' ? downColor : flatColor;
      return {
        content: DELTA_GLYPH[direction],
        textAlign: 'center',
        color: colColor ?? color,
        fontVariantNumeric: undefined,
        fontWeight: 600,
      };
    }
  }
}

function columnFlexBasis(column: StandingsTableColumn): CSSProperties {
  return column.width !== undefined
    ? { flex: `0 0 ${column.width}px`, width: column.width }
    : { flex: column.flex ?? 1 };
}

/**
 * Renders a vertical ranked standings table. Frame-derived stagger:
 * row `i` gains opacity over a 12-frame window starting at
 * `delay = i * staggerMs / (1000 / fps)`; `translateY` slides from
 * `-8 → 0 px` over the same window. Numeric cells (`rank` / `numeric`
 * / `total`) carry `font-variant-numeric: tabular-nums` so digit
 * columns align across rows regardless of the fallback font's
 * proportional digits. Font posture is permissive
 * `system-ui, sans-serif`; presets declare `preferredFont` /
 * `fallbackFont` in frontmatter and the FontManager applies them at
 * render time.
 */
export function StandingsTable({
  rows,
  columns,
  rowHeight = DEFAULT_ROW_HEIGHT,
  headerHeight = DEFAULT_HEADER_HEIGHT,
  staggerMs = DEFAULT_STAGGER_MS,
  bandPosition = 'fullscreen',
  background = DEFAULT_BACKGROUND,
  foreground = DEFAULT_FOREGROUND,
  upColor = DEFAULT_UP_COLOR,
  downColor = DEFAULT_DOWN_COLOR,
  flatColor = DEFAULT_FLAT_COLOR,
}: StandingsTableProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Pre-compute the numeric-column index map: cell j with
  // column.kind === 'numeric' reads row.values[numericIndex(j)].
  const numericColumnIndices = new Map<number, number>();
  let numericCounter = 0;
  for (let j = 0; j < columns.length; j += 1) {
    if (columns[j]?.kind === 'numeric') {
      numericColumnIndices.set(j, numericCounter);
      numericCounter += 1;
    }
  }

  const isFullscreen = bandPosition === 'fullscreen';
  const tableHeight = headerHeight + rows.length * rowHeight;
  const containerStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    fontFamily: FONT_FAMILY,
    color: foreground,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: isFullscreen ? background : 'transparent',
    ...(isFullscreen ? null : { alignItems: 'center', justifyContent: 'center' }),
  };
  const tableStyle: CSSProperties = {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    ...(isFullscreen ? { flex: 1 } : { height: tableHeight, backgroundColor: background }),
  };

  return (
    <div data-testid="standings-table-clip" style={containerStyle}>
      <div data-testid="standings-table-table" style={tableStyle}>
        <div
          data-testid="standings-table-header"
          style={{
            display: 'flex',
            height: headerHeight,
            alignItems: 'center',
            padding: '0 24px',
            boxSizing: 'border-box',
            fontSize: Math.round(headerHeight * 0.4),
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            opacity: 0.85,
          }}
        >
          {columns.map((column, j) => (
            <div
              key={column.key}
              data-testid={`standings-table-header-cell-${j}`}
              style={{
                ...columnFlexBasis(column),
                textAlign:
                  column.kind === 'label' ? 'left' : column.kind === 'delta' ? 'center' : 'right',
                color: column.color ?? foreground,
                padding: '0 8px',
                boxSizing: 'border-box',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {column.label}
            </div>
          ))}
        </div>

        {rows.map((row, i) => {
          const delay = (i * staggerMs) / (1000 / fps);
          const opacity = interpolate(frame, [delay, delay + ENTRANCE_FRAMES], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const translateY = interpolate(
            frame,
            [delay, delay + ENTRANCE_FRAMES],
            [-SLIDE_DISTANCE_PX, 0],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );
          return (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: positional row slot — slot i is the same row across renders.
              key={i}
              data-testid={`standings-table-row-${i}`}
              style={{
                display: 'flex',
                height: rowHeight,
                alignItems: 'center',
                padding: '0 24px',
                boxSizing: 'border-box',
                opacity,
                transform: `translateY(${translateY}px)`,
                fontSize: Math.round(rowHeight * 0.42),
                borderTop: `1px solid ${foreground}1a`,
              }}
            >
              {columns.map((column, j) => {
                const cell = renderCell(
                  row,
                  column,
                  numericColumnIndices.get(j) ?? 0,
                  foreground,
                  upColor,
                  downColor,
                  flatColor,
                );
                const cellStyle: CSSProperties = {
                  ...columnFlexBasis(column),
                  textAlign: cell.textAlign,
                  color: cell.color,
                  fontWeight: cell.fontWeight,
                  padding: '0 8px',
                  boxSizing: 'border-box',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                };
                if (cell.fontVariantNumeric !== undefined) {
                  cellStyle.fontVariantNumeric = cell.fontVariantNumeric;
                }
                return (
                  <div
                    key={column.key}
                    data-testid={`standings-table-cell-${i}-${j}`}
                    style={cellStyle}
                  >
                    {cell.content}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// D-T357a-6: theme-slot fallback. The current `ThemePalette`
// (`packages/schema/src/theme.ts`) exposes only `primary | secondary |
// accent | background | foreground | surface` — no `positive` /
// `negative` roles. Mirror the news-ticker-bar (T-356a) pattern:
// `upColor` / `downColor` and `goldColor` map to `palette.accent`;
// `silverColor` / `bronzeColor` / `flatColor` map to
// `palette.foreground` (cluster owners override via explicit hex props
// or wire `column.color` in their parity-cli resolver shim).
export const standingsTableClip: ClipDefinition<unknown> = defineFrameClip<StandingsTableProps>({
  kind: 'standings-table',
  component: StandingsTable,
  propsSchema: standingsTablePropsSchema,
  themeSlots: {
    background: { kind: 'palette', role: 'background' },
    foreground: { kind: 'palette', role: 'foreground' },
    goldColor: { kind: 'palette', role: 'accent' },
    silverColor: { kind: 'palette', role: 'foreground' },
    bronzeColor: { kind: 'palette', role: 'foreground' },
    upColor: { kind: 'palette', role: 'accent' },
    downColor: { kind: 'palette', role: 'accent' },
    flatColor: { kind: 'palette', role: 'foreground' },
  },
});
