// packages/runtimes/frame-runtime-bridge/src/clips/standings-table.test.tsx
// T-357a — standingsTableClip behaviour + propsSchema + themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  StandingsTable,
  type StandingsTableProps,
  standingsTableClip,
  standingsTablePropsSchema,
} from './standings-table.js';

afterEach(cleanup);

const FPS = 30;

function renderAt(frame: number, props: StandingsTableProps, durationInFrames = 600) {
  return render(
    <FrameProvider frame={frame} config={{ width: 1920, height: 1080, fps: FPS, durationInFrames }}>
      <StandingsTable {...props} />
    </FrameProvider>,
  );
}

const MIN_COLUMNS: StandingsTableProps['columns'] = [
  { key: 'rank', label: '#', kind: 'rank' },
  { key: 'code', label: 'NOC', kind: 'label' },
];

const MIN_ROW = { rank: 1, code: 'USA', values: [10, 8, 5] };

describe('standingsTablePropsSchema (T-357a)', () => {
  it('accepts a minimal valid input (single row, two columns)', () => {
    const result = standingsTablePropsSchema.safeParse({
      rows: [{ rank: 1, code: 'USA', values: [10, 8, 5], total: 23, delta: 'up' }],
      columns: [
        { key: 'rank', label: '#', kind: 'rank' },
        { key: 'code', label: 'NOC', kind: 'label' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty rows array (min(1))', () => {
    expect(standingsTablePropsSchema.safeParse({ rows: [], columns: MIN_COLUMNS }).success).toBe(
      false,
    );
  });

  it('rejects more than 16 rows (max(16))', () => {
    const seventeen = Array.from({ length: 17 }, (_, i) => ({
      rank: i + 1,
      code: `T${i}`,
      values: [i],
    }));
    expect(
      standingsTablePropsSchema.safeParse({ rows: seventeen, columns: MIN_COLUMNS }).success,
    ).toBe(false);
  });

  it('rejects fewer than 2 columns (min(2))', () => {
    expect(
      standingsTablePropsSchema.safeParse({
        rows: [MIN_ROW],
        columns: [{ key: 'a', label: 'A', kind: 'label' }],
      }).success,
    ).toBe(false);
    expect(standingsTablePropsSchema.safeParse({ rows: [MIN_ROW], columns: [] }).success).toBe(
      false,
    );
  });

  it('rejects more than 8 columns (max(8))', () => {
    const nine = Array.from({ length: 9 }, (_, i) => ({
      key: `c${i}`,
      label: `C${i}`,
      kind: 'numeric' as const,
    }));
    expect(standingsTablePropsSchema.safeParse({ rows: [MIN_ROW], columns: nine }).success).toBe(
      false,
    );
  });

  it('accepts both string and numeric delta', () => {
    expect(
      standingsTablePropsSchema.safeParse({
        rows: [{ rank: 1, code: 'USA', values: [1], delta: 'up' }],
        columns: MIN_COLUMNS,
      }).success,
    ).toBe(true);
    expect(
      standingsTablePropsSchema.safeParse({
        rows: [{ rank: 1, code: 'USA', values: [1], delta: -3 }],
        columns: MIN_COLUMNS,
      }).success,
    ).toBe(true);
    expect(
      standingsTablePropsSchema.safeParse({
        rows: [{ rank: 1, code: 'USA', values: [1], delta: 0 }],
        columns: MIN_COLUMNS,
      }).success,
    ).toBe(true);
  });

  it('rejects a malformed hex color', () => {
    expect(
      standingsTablePropsSchema.safeParse({
        rows: [MIN_ROW],
        columns: MIN_COLUMNS,
        background: 'not-a-hex',
      }).success,
    ).toBe(false);
  });
});

describe('StandingsTable component (T-357a)', () => {
  it('renders header + N rows with header labels visible at large frame', () => {
    renderAt(120, {
      rows: [
        { rank: 1, code: 'USA', values: [10, 8, 5], total: 23 },
        { rank: 2, code: 'CHN', values: [9, 7, 6], total: 22 },
        { rank: 3, code: 'GBR', values: [7, 5, 4], total: 16 },
      ],
      columns: [
        { key: 'rank', label: '#', kind: 'rank' },
        { key: 'code', label: 'NOC', kind: 'label' },
        { key: 'gold', label: 'G', kind: 'numeric' },
        { key: 'silver', label: 'S', kind: 'numeric' },
        { key: 'bronze', label: 'B', kind: 'numeric' },
        { key: 'total', label: 'T', kind: 'total' },
      ],
    });
    expect(screen.getByTestId('standings-table-header')).toBeDefined();
    // Three rows present.
    expect(screen.getByTestId('standings-table-row-0')).toBeDefined();
    expect(screen.getByTestId('standings-table-row-1')).toBeDefined();
    expect(screen.getByTestId('standings-table-row-2')).toBeDefined();
    // Header labels rendered.
    const header = screen.getByTestId('standings-table-header');
    expect(header.textContent).toContain('NOC');
    expect(header.textContent).toContain('G');
    expect(header.textContent).toContain('T');
  });

  it('row 0 opacity is 0 at frame 0 (entrance pre-start)', () => {
    renderAt(0, {
      rows: [MIN_ROW, { rank: 2, code: 'CHN', values: [9, 7, 6] }],
      columns: MIN_COLUMNS,
    });
    const row0 = screen.getByTestId('standings-table-row-0');
    // delay=0; interpolate(0, [0, 12], [0, 1], clamp) = 0
    expect(row0.style.opacity).toBe('0');
  });

  it('all rows are fully opaque (opacity=1) at large frame past stagger window', () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      rank: i + 1,
      code: `T${i}`,
      values: [i + 1],
    }));
    renderAt(120, { rows, columns: MIN_COLUMNS });
    for (let i = 0; i < 5; i += 1) {
      const row = screen.getByTestId(`standings-table-row-${i}`);
      expect(Number.parseFloat(row.style.opacity)).toBe(1);
    }
  });

  it('staggers row entrance — at frame 8 row 0 partial, last row still 0', () => {
    const rows = Array.from({ length: 6 }, (_, i) => ({
      rank: i + 1,
      code: `T${i}`,
      values: [i + 1],
    }));
    renderAt(8, { rows, columns: MIN_COLUMNS });
    const row0 = screen.getByTestId('standings-table-row-0');
    const row5 = screen.getByTestId('standings-table-row-5');
    // row 0: delay=0; t = 8/12 ≈ 0.666 → partial opacity
    const op0 = Number.parseFloat(row0.style.opacity);
    expect(op0).toBeGreaterThan(0);
    expect(op0).toBeLessThan(1);
    // row 5: delay = 5 * 80 / (1000 / 30) = 5 * 2.4 = 12 frames; at frame 8 < 12 → 0
    expect(row5.style.opacity).toBe('0');
  });

  it('delta column glyph dispatch (string + numeric)', () => {
    renderAt(120, {
      rows: [
        { rank: 1, code: 'USA', values: [1], delta: 'up' },
        { rank: 2, code: 'CHN', values: [1], delta: 'down' },
        { rank: 3, code: 'GBR', values: [1], delta: 'flat' },
        { rank: 4, code: 'JPN', values: [1], delta: 5 },
        { rank: 5, code: 'AUS', values: [1], delta: -3 },
        { rank: 6, code: 'GER', values: [1], delta: 0 },
      ],
      columns: [
        { key: 'rank', label: '#', kind: 'rank' },
        { key: 'code', label: 'NOC', kind: 'label' },
        { key: 'delta', label: '∆', kind: 'delta' },
      ],
    });
    expect(screen.getByTestId('standings-table-cell-0-2').textContent).toBe('↑');
    expect(screen.getByTestId('standings-table-cell-1-2').textContent).toBe('↓');
    expect(screen.getByTestId('standings-table-cell-2-2').textContent).toBe('▬');
    expect(screen.getByTestId('standings-table-cell-3-2').textContent).toBe('↑');
    expect(screen.getByTestId('standings-table-cell-4-2').textContent).toBe('↓');
    expect(screen.getByTestId('standings-table-cell-5-2').textContent).toBe('▬');
  });

  it('per-column color tints the cell (medal-style)', () => {
    renderAt(120, {
      rows: [{ rank: 1, code: 'USA', values: [10, 8, 5], total: 23 }],
      columns: [
        { key: 'rank', label: '#', kind: 'rank' },
        { key: 'code', label: 'NOC', kind: 'label' },
        { key: 'gold', label: 'G', kind: 'numeric', color: '#FFD700' },
        { key: 'silver', label: 'S', kind: 'numeric', color: '#C0C0C0' },
        { key: 'bronze', label: 'B', kind: 'numeric', color: '#CD7F32' },
      ],
    });
    const goldCell = screen.getByTestId('standings-table-cell-0-2');
    const silverCell = screen.getByTestId('standings-table-cell-0-3');
    const bronzeCell = screen.getByTestId('standings-table-cell-0-4');
    // happy-dom preserves the supplied color string; assert via case-insensitive normalisation.
    expect(goldCell.style.color.toLowerCase()).toBe('#ffd700');
    expect(silverCell.style.color.toLowerCase()).toBe('#c0c0c0');
    expect(bronzeCell.style.color.toLowerCase()).toBe('#cd7f32');
  });

  it('numeric cells (rank/numeric/total) carry font-variant-numeric: tabular-nums', () => {
    renderAt(120, {
      rows: [{ rank: 1, code: 'USA', values: [10], total: 23 }],
      columns: [
        { key: 'rank', label: '#', kind: 'rank' },
        { key: 'code', label: 'NOC', kind: 'label' },
        { key: 'gold', label: 'G', kind: 'numeric' },
        { key: 'total', label: 'T', kind: 'total' },
      ],
    });
    const rankCell = screen.getByTestId('standings-table-cell-0-0');
    const labelCell = screen.getByTestId('standings-table-cell-0-1');
    const numericCell = screen.getByTestId('standings-table-cell-0-2');
    const totalCell = screen.getByTestId('standings-table-cell-0-3');
    expect(rankCell.style.fontVariantNumeric).toBe('tabular-nums');
    expect(numericCell.style.fontVariantNumeric).toBe('tabular-nums');
    expect(totalCell.style.fontVariantNumeric).toBe('tabular-nums');
    // Label cell does NOT need tabular-nums.
    expect(labelCell.style.fontVariantNumeric).toBe('');
  });

  it('numeric column dispatch routes by index among numeric columns', () => {
    renderAt(120, {
      rows: [{ rank: 1, code: 'USA', values: [10, 8, 5] }],
      columns: [
        { key: 'rank', label: '#', kind: 'rank' },
        { key: 'code', label: 'NOC', kind: 'label' },
        { key: 'gold', label: 'G', kind: 'numeric' },
        { key: 'silver', label: 'S', kind: 'numeric' },
        { key: 'bronze', label: 'B', kind: 'numeric' },
      ],
    });
    expect(screen.getByTestId('standings-table-cell-0-0').textContent).toBe('1');
    expect(screen.getByTestId('standings-table-cell-0-1').textContent).toBe('USA');
    expect(screen.getByTestId('standings-table-cell-0-2').textContent).toBe('10');
    expect(screen.getByTestId('standings-table-cell-0-3').textContent).toBe('8');
    expect(screen.getByTestId('standings-table-cell-0-4').textContent).toBe('5');
  });

  it('total cell renders with heavy font weight', () => {
    renderAt(120, {
      rows: [{ rank: 1, code: 'USA', values: [1], total: 23 }],
      columns: [
        { key: 'rank', label: '#', kind: 'rank' },
        { key: 'code', label: 'NOC', kind: 'label' },
        { key: 'total', label: 'T', kind: 'total' },
      ],
    });
    const totalCell = screen.getByTestId('standings-table-cell-0-2');
    expect(totalCell.textContent).toBe('23');
    expect(Number.parseInt(totalCell.style.fontWeight, 10)).toBeGreaterThanOrEqual(700);
  });

  it('delta colors derive from up/down/flat color props', () => {
    renderAt(120, {
      rows: [
        { rank: 1, code: 'USA', values: [1], delta: 'up' },
        { rank: 2, code: 'CHN', values: [1], delta: 'down' },
        { rank: 3, code: 'GBR', values: [1], delta: 'flat' },
      ],
      columns: [
        { key: 'rank', label: '#', kind: 'rank' },
        { key: 'code', label: 'NOC', kind: 'label' },
        { key: 'delta', label: '∆', kind: 'delta' },
      ],
      upColor: '#00d26a',
      downColor: '#ff3c3c',
      flatColor: '#a0a0a0',
    });
    expect(screen.getByTestId('standings-table-cell-0-2').style.color).toBe('#00d26a');
    expect(screen.getByTestId('standings-table-cell-1-2').style.color).toBe('#ff3c3c');
    expect(screen.getByTestId('standings-table-cell-2-2').style.color).toBe('#a0a0a0');
  });

  it('is frame-deterministic — identical HTML across two renders at the same frame', () => {
    const props: StandingsTableProps = {
      rows: [
        { rank: 1, code: 'USA', values: [10, 8, 5], total: 23, delta: 'up' },
        { rank: 2, code: 'CHN', values: [9, 7, 6], total: 22, delta: 'down' },
        { rank: 3, code: 'GBR', values: [7, 5, 4], total: 16, delta: 'flat' },
      ],
      columns: [
        { key: 'rank', label: '#', kind: 'rank' },
        { key: 'code', label: 'NOC', kind: 'label' },
        { key: 'gold', label: 'G', kind: 'numeric', color: '#FFD700' },
        { key: 'silver', label: 'S', kind: 'numeric', color: '#C0C0C0' },
        { key: 'bronze', label: 'B', kind: 'numeric', color: '#CD7F32' },
        { key: 'total', label: 'T', kind: 'total' },
        { key: 'delta', label: '∆', kind: 'delta' },
      ],
      background: '#0a0a0a',
      foreground: '#ffffff',
    };
    const a = renderAt(60, props).container.innerHTML;
    cleanup();
    const b = renderAt(60, props).container.innerHTML;
    expect(a).toBe(b);
  });
});

describe('standingsTableClip definition (T-357a)', () => {
  it("registers under kind 'standings-table' with the expected theme slots", () => {
    expect(standingsTableClip.kind).toBe('standings-table');
    expect(standingsTableClip.propsSchema).toBe(standingsTablePropsSchema);
    expect(standingsTableClip.themeSlots).toEqual({
      background: { kind: 'palette', role: 'background' },
      foreground: { kind: 'palette', role: 'foreground' },
      goldColor: { kind: 'palette', role: 'accent' },
      silverColor: { kind: 'palette', role: 'foreground' },
      bronzeColor: { kind: 'palette', role: 'foreground' },
      upColor: { kind: 'palette', role: 'accent' },
      downColor: { kind: 'palette', role: 'accent' },
      flatColor: { kind: 'palette', role: 'foreground' },
    });
  });
});
