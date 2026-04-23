// packages/runtimes/frame-runtime-bridge/src/clips/financial-statement.test.tsx
// T-131f.3 — financialStatementClip behaviour + propsSchema + themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { resolveClipDefaultsForTheme } from '@stageflip/runtimes-contract';
import type { Theme } from '@stageflip/schema';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  FinancialStatement,
  type FinancialStatementProps,
  financialStatementClip,
  financialStatementPropsSchema,
} from './financial-statement.js';

afterEach(cleanup);

const PERIODS: FinancialStatementProps['periods'] = [
  { id: 'q1', label: 'Q1', emphasis: 'secondary' },
  { id: 'q2', label: 'Q2', emphasis: 'secondary' },
  { id: 'q3', label: 'Q3', emphasis: 'primary' },
];

const ROWS: FinancialStatementProps['rows'] = [
  {
    id: 'rev-section',
    label: 'Revenue',
    kind: 'section',
    level: 0,
    values: [null, null, null],
  },
  {
    id: 'rev-line',
    label: 'Total Revenue',
    shortLabel: 'Revenue',
    kind: 'line',
    level: 1,
    values: [100, 110, 125],
    meta: { semanticRole: 'revenue' },
    variance: { absolute: [15], percent: [13.6] },
  },
  {
    id: 'gp-line',
    label: 'Gross Profit',
    shortLabel: 'Gross',
    kind: 'subtotal',
    level: 1,
    values: [40, 45, 55],
    meta: { semanticRole: 'gross_profit' },
    variance: { percent: [22.2] },
  },
  {
    id: 'spacer',
    label: '',
    kind: 'spacer',
    level: 0,
    values: [],
  },
  {
    id: 'ebitda',
    label: 'EBITDA',
    kind: 'subtotal',
    level: 1,
    values: [20, 22, 30],
    meta: { semanticRole: 'ebitda' },
    variance: { percent: [36.4] },
  },
  {
    id: 'net-income',
    label: 'Net Income',
    kind: 'total',
    level: 0,
    values: [15, 17, 24],
    meta: { semanticRole: 'net_income' },
    variance: { percent: [41.2] },
  },
  {
    id: 'note',
    label: 'Note: figures unaudited',
    kind: 'note',
    level: 0,
    values: [null, null, null],
  },
];

const COMMENTS: FinancialStatementProps['comments'] = [
  {
    id: 'c1',
    title: 'Strong revenue growth',
    body: 'Driven by the European expansion launched in Q1 and pricing tailwinds.',
    type: 'driver',
    priority: 'high',
  },
  {
    id: 'c2',
    title: 'Margin compression',
    body: 'COGS up 12% year over year — supplier consolidation complete by Q4.',
    type: 'variance',
    priority: 'medium',
  },
  {
    id: 'c3',
    body: 'Short note without a title or explicit type.',
    priority: 'low',
  },
];

function renderAt(frame: number, props: FinancialStatementProps, durationInFrames = 60) {
  return render(
    <FrameProvider frame={frame} config={{ width: 1920, height: 1080, fps: 30, durationInFrames }}>
      <FinancialStatement {...props} />
    </FrameProvider>,
  );
}

describe('FinancialStatement component (T-131f.3)', () => {
  it('renders the statement container', () => {
    renderAt(15, { statementType: 'pnl', periods: PERIODS, rows: ROWS });
    expect(screen.getByTestId('financial-statement')).toBeDefined();
  });

  it('fades in over frames 0..15', () => {
    renderAt(0, { statementType: 'pnl', periods: PERIODS, rows: ROWS });
    expect(Number(screen.getByTestId('financial-statement').style.opacity)).toBe(0);
    cleanup();
    renderAt(15, { statementType: 'pnl', periods: PERIODS, rows: ROWS });
    expect(Number(screen.getByTestId('financial-statement').style.opacity)).toBe(1);
  });

  it('defaults title by statementType', () => {
    renderAt(30, { statementType: 'pnl', periods: PERIODS, rows: ROWS });
    expect(screen.getByTestId('financial-statement-title').textContent).toBe(
      'Consolidated Profit & Loss',
    );
    cleanup();
    renderAt(30, { statementType: 'balance_sheet', periods: PERIODS, rows: ROWS });
    expect(screen.getByTestId('financial-statement-title').textContent).toBe(
      'Consolidated Balance Sheet',
    );
    cleanup();
    renderAt(30, { statementType: 'cash_flow', periods: PERIODS, rows: ROWS });
    expect(screen.getByTestId('financial-statement-title').textContent).toBe(
      'Consolidated Cash Flow',
    );
  });

  it('accepts a custom title override', () => {
    renderAt(30, { statementType: 'pnl', periods: PERIODS, rows: ROWS, title: 'FY26 H1 P&L' });
    expect(screen.getByTestId('financial-statement-title').textContent).toBe('FY26 H1 P&L');
  });

  it('renders unit label with currency + unit', () => {
    renderAt(30, {
      statementType: 'pnl',
      periods: PERIODS,
      rows: ROWS,
      currency: 'USD',
      unit: 'millions',
    });
    expect(screen.getByTestId('financial-statement-unit-label').textContent).toContain('USD');
    expect(screen.getByTestId('financial-statement-unit-label').textContent).toContain('millions');
  });

  it('renders the KPI strip by default with role-derived labels', () => {
    renderAt(30, { statementType: 'pnl', periods: PERIODS, rows: ROWS });
    expect(screen.getByTestId('financial-statement-kpi-strip')).toBeDefined();
    // Revenue shortLabel is "Revenue"; Gross Profit → "Gross"; EBITDA no shortLabel → "Ebitda"
    expect(screen.queryByTestId('financial-statement-kpi-revenue')).not.toBeNull();
    expect(screen.queryByTestId('financial-statement-kpi-gross')).not.toBeNull();
  });

  it('hides the KPI strip when showKpiStrip=false', () => {
    renderAt(30, {
      statementType: 'pnl',
      periods: PERIODS,
      rows: ROWS,
      showKpiStrip: false,
    });
    expect(screen.queryByTestId('financial-statement-kpi-strip')).toBeNull();
  });

  it('renders the table with one row per non-hidden data row', () => {
    renderAt(30, { statementType: 'pnl', periods: PERIODS, rows: ROWS });
    expect(screen.getByTestId('financial-statement-table')).toBeDefined();
    for (const r of ROWS) {
      expect(screen.getByTestId(`financial-statement-row-${r.id}`)).toBeDefined();
    }
  });

  it('hides rows flagged `hiddenInBoardMode` when density=board', () => {
    const withHidden: FinancialStatementProps['rows'] = [
      ...ROWS,
      {
        id: 'appendix-only',
        label: 'Appendix Only',
        kind: 'line',
        level: 1,
        values: [1, 1, 1],
        formatting: { hiddenInBoardMode: true },
      },
    ];
    renderAt(30, {
      statementType: 'pnl',
      periods: PERIODS,
      rows: withHidden,
      settings: { density: 'board' },
    });
    expect(screen.queryByTestId('financial-statement-row-appendix-only')).toBeNull();
    cleanup();
    renderAt(30, {
      statementType: 'pnl',
      periods: PERIODS,
      rows: withHidden,
      settings: { density: 'standard' },
    });
    expect(screen.getByTestId('financial-statement-row-appendix-only')).toBeDefined();
  });

  it('renders the comments rail when comments are provided', () => {
    renderAt(30, { statementType: 'pnl', periods: PERIODS, rows: ROWS, comments: COMMENTS });
    expect(screen.getByTestId('financial-statement-comments-rail')).toBeDefined();
    for (const c of COMMENTS) {
      expect(screen.getByTestId(`financial-statement-comment-${c.id}`)).toBeDefined();
    }
  });

  it('renders the rail when commentaryMode=inline (current behaviour matches rail)', () => {
    // The schema advertises 'inline' alongside 'rail' but the port has
    // no distinct inline-within-row layout; both modes render the side
    // rail. This mirrors reference behaviour — test pins the contract.
    renderAt(30, {
      statementType: 'pnl',
      periods: PERIODS,
      rows: ROWS,
      comments: COMMENTS,
      settings: { commentaryMode: 'inline' },
    });
    expect(screen.getByTestId('financial-statement-comments-rail')).toBeDefined();
  });

  it('omits the comments rail when commentaryMode=none', () => {
    renderAt(30, {
      statementType: 'pnl',
      periods: PERIODS,
      rows: ROWS,
      comments: COMMENTS,
      settings: { commentaryMode: 'none' },
    });
    expect(screen.queryByTestId('financial-statement-comments-rail')).toBeNull();
  });

  it('sorts comments by priority (high → medium → low)', () => {
    // Reorder COMMENTS so low comes first in input; output should still put high first.
    const shuffled = [COMMENTS[2], COMMENTS[1], COMMENTS[0]] as FinancialStatementProps['comments'];
    renderAt(30, { statementType: 'pnl', periods: PERIODS, rows: ROWS, comments: shuffled });
    const rail = screen.getByTestId('financial-statement-comments-rail');
    const cards = rail.querySelectorAll('[data-testid^="financial-statement-comment-"]');
    expect(cards[0]?.getAttribute('data-testid')).toBe('financial-statement-comment-c1'); // high
    expect(cards[1]?.getAttribute('data-testid')).toBe('financial-statement-comment-c2'); // medium
    expect(cards[2]?.getAttribute('data-testid')).toBe('financial-statement-comment-c3'); // low
  });

  it('caps visible comments by density (board=5, standard=8, appendix=3)', () => {
    const many: FinancialStatementProps['comments'] = Array.from({ length: 10 }, (_, i) => ({
      id: `m${i}`,
      body: `Note ${i}`,
      priority: 'medium' as const,
    }));
    renderAt(30, {
      statementType: 'pnl',
      periods: PERIODS,
      rows: ROWS,
      comments: many,
      settings: { density: 'appendix' },
    });
    const rail = screen.getByTestId('financial-statement-comments-rail');
    expect(rail.querySelectorAll('[data-testid^="financial-statement-comment-"]').length).toBe(3);
  });

  it('renders parenthesised negatives by default', () => {
    const withNeg: FinancialStatementProps['rows'] = [
      {
        id: 'loss',
        label: 'Operating Loss',
        kind: 'line',
        level: 1,
        values: [-12.5],
      },
    ];
    renderAt(30, {
      statementType: 'pnl',
      periods: [{ id: 'q1', label: 'Q1' }],
      rows: withNeg,
    });
    const row = screen.getByTestId('financial-statement-row-loss');
    expect(row.textContent).toContain('(12.5)');
  });

  it('renders minus-prefixed negatives when negativeStyle=minus', () => {
    const withNeg: FinancialStatementProps['rows'] = [
      {
        id: 'loss',
        label: 'Operating Loss',
        kind: 'line',
        level: 1,
        values: [-12.5],
        formatting: { negativeStyle: 'minus' },
      },
    ];
    renderAt(30, {
      statementType: 'pnl',
      periods: [{ id: 'q1', label: 'Q1' }],
      rows: withNeg,
    });
    const row = screen.getByTestId('financial-statement-row-loss');
    expect(row.textContent).toContain('-12.5');
    expect(row.textContent).not.toContain('(12.5)');
  });

  it('applies red tint to negatives when negativeStyle=red', () => {
    const withNeg: FinancialStatementProps['rows'] = [
      {
        id: 'loss',
        label: 'Operating Loss',
        kind: 'line',
        level: 1,
        values: [-12.5],
        formatting: { negativeStyle: 'red' },
      },
    ];
    const { container } = renderAt(30, {
      statementType: 'pnl',
      periods: [{ id: 'q1', label: 'Q1' }],
      rows: withNeg,
    });
    const row = screen.getByTestId('financial-statement-row-loss');
    // Value is wrapped in a <span> with colour when negStyle=red.
    const coloured = row.querySelector('span[style*="color"]');
    expect(coloured).not.toBeNull();
    // Negative value printed as `-12.5` (no parentheses).
    expect(row.textContent).toContain('-12.5');
  });

  it('renders variance absolute + percent cells when the feature flags default to on', () => {
    // ROWS in the top-level fixture has `variance.absolute` on rev-line
    // and `variance.percent` on gp-line / ebitda / net-income. Default
    // settings show both columns → the table gets a "Var" + "Var %"
    // header and populated cells on those rows.
    const { container } = renderAt(30, {
      statementType: 'pnl',
      periods: PERIODS,
      rows: ROWS,
    });
    const headers = container.querySelectorAll('thead th');
    const headerText = Array.from(headers)
      .map((th) => th.textContent ?? '')
      .join(' | ');
    expect(headerText).toContain('Var');
    expect(headerText).toContain('Var %');
    // Rev-line has absolute=15. Rendered in the Var column.
    const revRow = screen.getByTestId('financial-statement-row-rev-line');
    expect(revRow.textContent).toContain('15.0');
    // Gp-line percent=22.2 → rendered with `%`.
    const gpRow = screen.getByTestId('financial-statement-row-gp-line');
    expect(gpRow.textContent).toContain('22.2%');
  });

  it('hides variance columns when both feature flags are off', () => {
    const { container } = renderAt(30, {
      statementType: 'pnl',
      periods: PERIODS,
      rows: ROWS,
      settings: { showVarianceAbsolute: false, showVariancePercent: false },
    });
    const headers = container.querySelectorAll('thead th');
    const headerText = Array.from(headers)
      .map((th) => th.textContent ?? '')
      .join(' | ');
    expect(headerText).not.toContain('Var');
  });

  it('uses a dash for null/undefined KPI values', () => {
    const nullRow: FinancialStatementProps['rows'] = [
      {
        id: 'rev',
        label: 'Revenue',
        kind: 'line',
        level: 1,
        values: [null, null, null],
        meta: { semanticRole: 'revenue' },
      },
    ];
    renderAt(30, { statementType: 'pnl', periods: PERIODS, rows: nullRow });
    // KPI generated → "Revenue" (humanised), value is em-dash.
    const kpi = screen.queryByTestId('financial-statement-kpi-revenue');
    expect(kpi?.textContent).toContain('—');
  });

  it('handles empty rows without crashing', () => {
    expect(() => renderAt(30, { statementType: 'pnl', periods: PERIODS, rows: [] })).not.toThrow();
  });

  it('renders footer with source + unit summary', () => {
    renderAt(30, {
      statementType: 'pnl',
      periods: PERIODS,
      rows: ROWS,
      currency: 'USD',
    });
    expect(screen.getByTestId('financial-statement-footer').textContent).toContain('Unaudited');
  });
});

describe('financialStatementClip definition (T-131f.3)', () => {
  it("registers under kind 'financial-statement' with propsSchema", () => {
    expect(financialStatementClip.kind).toBe('financial-statement');
    expect(financialStatementClip.propsSchema).toBe(financialStatementPropsSchema);
  });

  it('declares themeSlots for background + text + surface', () => {
    expect(financialStatementClip.themeSlots).toEqual({
      background: { kind: 'palette', role: 'background' },
      textColor: { kind: 'palette', role: 'foreground' },
      surface: { kind: 'palette', role: 'surface' },
    });
  });

  it('propsSchema requires statementType + periods + rows', () => {
    expect(financialStatementPropsSchema.safeParse({}).success).toBe(false);
    expect(
      financialStatementPropsSchema.safeParse({ statementType: 'pnl', periods: [], rows: [] })
        .success,
    ).toBe(true);
  });

  it('propsSchema rejects unknown statementType values', () => {
    expect(
      financialStatementPropsSchema.safeParse({
        statementType: 'bogus',
        periods: [],
        rows: [],
      }).success,
    ).toBe(false);
  });

  it('propsSchema rejects unknown row.kind values', () => {
    expect(
      financialStatementPropsSchema.safeParse({
        statementType: 'pnl',
        periods: [],
        rows: [{ id: 'x', label: 'X', kind: 'bogus', level: 0, values: [] }],
      }).success,
    ).toBe(false);
  });

  it('propsSchema rejects decimals out of [0, 4]', () => {
    expect(
      financialStatementPropsSchema.safeParse({
        statementType: 'pnl',
        periods: [],
        rows: [],
        decimals: 10,
      }).success,
    ).toBe(false);
  });

  it('integrates with resolveClipDefaultsForTheme', () => {
    const theme: Theme = {
      palette: { background: '#080f15', foreground: '#ebf1fa', surface: '#151c23' },
      tokens: {},
    };
    const out = resolveClipDefaultsForTheme(
      financialStatementClip as unknown as Parameters<
        typeof resolveClipDefaultsForTheme<FinancialStatementProps>
      >[0],
      theme,
      {
        statementType: 'pnl',
        periods: [],
        rows: [],
      } as FinancialStatementProps,
    );
    expect(out.background).toBe('#080f15');
    expect(out.textColor).toBe('#ebf1fa');
    expect(out.surface).toBe('#151c23');
  });
});
