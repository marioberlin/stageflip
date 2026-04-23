// packages/runtimes/frame-runtime-bridge/src/clips/sales-dashboard.test.tsx
// T-131f.2c — salesDashboardClip behaviour + propsSchema + themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { resolveClipDefaultsForTheme } from '@stageflip/runtimes-contract';
import type { Theme } from '@stageflip/schema';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  SalesDashboard,
  type SalesDashboardProps,
  salesDashboardClip,
  salesDashboardPropsSchema,
} from './sales-dashboard.js';

afterEach(cleanup);

const STAGES: SalesDashboardProps['stages'] = [
  { id: 'qualify', name: 'Qualify', color: '#81aeff', order: 0, probability: 20 },
  { id: 'propose', name: 'Propose', color: '#5af8fb', order: 1, probability: 50 },
  { id: 'negotiate', name: 'Negotiate', color: '#34d399', order: 2, probability: 80 },
];

const DEALS: SalesDashboardProps['deals'] = [
  {
    id: 'd1',
    name: 'Acme Annual',
    company: 'Acme',
    value: 240000,
    status: 'on_track',
    stageId: 'negotiate',
    closeDate: '2026-06-30',
    owner: 'Ada',
    probability: 80,
  },
  {
    id: 'd2',
    name: 'Globex Pilot',
    company: 'Globex',
    value: 80000,
    status: 'at_risk',
    stageId: 'propose',
    closeDate: '2026-05-15',
    owner: 'Ben',
  },
  {
    id: 'd3',
    name: 'Initech Expansion',
    company: 'Initech',
    value: 120000,
    status: 'slipping',
    stageId: 'qualify',
    closeDate: '2026-07-01',
  },
  {
    id: 'd4',
    name: 'LostCo',
    company: 'LostCo',
    value: 40000,
    status: 'lost',
    stageId: 'qualify',
    closeDate: '2026-03-01',
  },
  {
    id: 'd5',
    name: 'WonCo Renewal',
    company: 'WonCo',
    value: 60000,
    status: 'won',
    stageId: 'negotiate',
    closeDate: '2026-02-14',
  },
];

const SUMMARY: NonNullable<SalesDashboardProps['summary']> = {
  totalPipeline: 540000,
  weightedPipeline: 320000,
  closedWon: 60000,
  quota: 500000,
  winRate: 42,
  pipelineCoverage: 1.2,
  avgDealSize: 108000,
  avgCycleLength: 54,
};

function renderAt(frame: number, props: SalesDashboardProps, durationInFrames = 60) {
  return render(
    <FrameProvider frame={frame} config={{ width: 1920, height: 1080, fps: 30, durationInFrames }}>
      <SalesDashboard {...props} />
    </FrameProvider>,
  );
}

describe('SalesDashboard component (T-131f.2c)', () => {
  it('renders the dashboard container', () => {
    renderAt(15, { stages: STAGES, deals: DEALS });
    expect(screen.getByTestId('sales-dashboard')).toBeDefined();
  });

  it('fades in over frames 0..15', () => {
    renderAt(0, { stages: STAGES, deals: DEALS });
    expect(Number(screen.getByTestId('sales-dashboard').style.opacity)).toBe(0);
    cleanup();
    renderAt(15, { stages: STAGES, deals: DEALS });
    expect(Number(screen.getByTestId('sales-dashboard').style.opacity)).toBe(1);
  });

  it('defaults title by pipelineType archetype', () => {
    renderAt(30, { stages: STAGES, deals: DEALS, pipelineType: 'forecast', summary: SUMMARY });
    expect(screen.getByTestId('sales-dashboard-title').textContent).toBe('Forecast Summary');
    cleanup();
    renderAt(30, { stages: STAGES, deals: DEALS, pipelineType: 'deal_review' });
    expect(screen.getByTestId('sales-dashboard-title').textContent).toBe('Deal Review');
    cleanup();
    renderAt(30, { stages: STAGES, deals: DEALS, pipelineType: 'win_loss' });
    expect(screen.getByTestId('sales-dashboard-title').textContent).toBe('Win/Loss Analysis');
  });

  it('renders summary KPIs when summary is provided', () => {
    renderAt(30, { stages: STAGES, deals: DEALS, summary: SUMMARY });
    expect(screen.getByTestId('sales-dashboard-summary')).toBeDefined();
    expect(screen.getByTestId('sales-dashboard-kpi-total-pipeline').textContent).toContain('540');
    expect(screen.getByTestId('sales-dashboard-kpi-win-rate').textContent).toContain('42%');
  });

  it('omits the summary KPI strip when summary is absent', () => {
    renderAt(30, { stages: STAGES, deals: DEALS });
    expect(screen.queryByTestId('sales-dashboard-summary')).toBeNull();
  });

  it('renders PipelineFunnel in funnel / quarterly_review modes', () => {
    renderAt(30, { stages: STAGES, deals: DEALS, pipelineType: 'funnel' });
    expect(screen.getByTestId('sales-dashboard-funnel')).toBeDefined();
    // Funnel excludes lost deals; d4 stage (qualify) still rendered for d3 which is 'slipping'.
    for (const s of STAGES) {
      expect(screen.getByTestId(`sales-dashboard-funnel-stage-${s.id}`)).toBeDefined();
    }
    cleanup();
    renderAt(30, { stages: STAGES, deals: DEALS, pipelineType: 'quarterly_review' });
    expect(screen.getByTestId('sales-dashboard-funnel')).toBeDefined();
  });

  it('renders ForecastChart in forecast mode only when summary is provided', () => {
    renderAt(30, {
      stages: STAGES,
      deals: DEALS,
      pipelineType: 'forecast',
      summary: SUMMARY,
    });
    expect(screen.getByTestId('sales-dashboard-forecast')).toBeDefined();
    expect(screen.getByTestId('sales-dashboard-forecast-quota-line')).toBeDefined();
  });

  it('skips ForecastChart when forecast mode has no summary', () => {
    renderAt(30, { stages: STAGES, deals: DEALS, pipelineType: 'forecast' });
    expect(screen.queryByTestId('sales-dashboard-forecast')).toBeNull();
  });

  it('renders DealCard grid in deal_review mode', () => {
    renderAt(30, { stages: STAGES, deals: DEALS, pipelineType: 'deal_review' });
    expect(screen.getByTestId('sales-dashboard-deals')).toBeDefined();
    // Lost deal (d4) excluded in deal_review mode.
    expect(screen.queryByTestId('sales-dashboard-deal-d4')).toBeNull();
  });

  it('shows DealCards alongside funnel when settings.showDealCards is true', () => {
    renderAt(30, {
      stages: STAGES,
      deals: DEALS,
      pipelineType: 'funnel',
      settings: { showDealCards: true },
    });
    expect(screen.getByTestId('sales-dashboard-funnel')).toBeDefined();
    expect(screen.getByTestId('sales-dashboard-deals')).toBeDefined();
  });

  it('renders Won / Lost split in win_loss mode (lost deals INCLUDED here only)', () => {
    renderAt(30, { stages: STAGES, deals: DEALS, pipelineType: 'win_loss' });
    expect(screen.getByTestId('sales-dashboard-win-loss')).toBeDefined();
    expect(screen.getByTestId('sales-dashboard-deal-d4')).toBeDefined(); // lost
    expect(screen.getByTestId('sales-dashboard-deal-d5')).toBeDefined(); // won
  });

  it('limits deal count by density (executive=4, standard=6, detailed=12)', () => {
    // Synthesize 20 deals to exceed every density cap.
    const many: SalesDashboardProps['deals'] = Array.from({ length: 20 }, (_, i) => ({
      id: `d${i}`,
      name: `Deal ${i}`,
      company: `Co ${i}`,
      value: 1000 * (20 - i),
      status: 'on_track' as const,
      stageId: 'propose',
      closeDate: '2026-06-01',
    }));
    renderAt(30, {
      stages: STAGES,
      deals: many,
      pipelineType: 'deal_review',
      settings: { density: 'executive' },
    });
    const rendered = document.querySelectorAll('[data-testid^="sales-dashboard-deal-"]');
    expect(rendered.length).toBe(4);
  });

  it('sorts deals by value (desc) by default', () => {
    renderAt(30, { stages: STAGES, deals: DEALS, pipelineType: 'deal_review' });
    const deals = document.querySelectorAll('[data-testid^="sales-dashboard-deal-"]');
    // Largest (d1 = 240k) should come first.
    expect(deals[0]?.getAttribute('data-testid')).toBe('sales-dashboard-deal-d1');
  });

  it('sorts deals by close_date when settings.sortBy = close_date', () => {
    renderAt(30, {
      stages: STAGES,
      deals: DEALS,
      pipelineType: 'deal_review',
      settings: { sortBy: 'close_date' },
    });
    const deals = document.querySelectorAll('[data-testid^="sales-dashboard-deal-"]');
    // Earliest close date among non-lost: d5 (2026-02-14).
    expect(deals[0]?.getAttribute('data-testid')).toBe('sales-dashboard-deal-d5');
  });

  it('uses EUR prefix when currency is EUR', () => {
    renderAt(30, { stages: STAGES, deals: DEALS, summary: SUMMARY, currency: 'EUR' });
    const totalKpi = screen.getByTestId('sales-dashboard-kpi-total-pipeline');
    expect(totalKpi.textContent).toContain('\u20AC');
  });

  it('renders a subtitle when provided', () => {
    renderAt(30, { stages: STAGES, deals: DEALS, subtitle: 'FY26 H1 Forecast' });
    expect(screen.getByTestId('sales-dashboard-subtitle').textContent).toBe('FY26 H1 Forecast');
  });

  it('renders a footer with period + currency', () => {
    renderAt(30, { stages: STAGES, deals: DEALS, period: 'Q2 2026', currency: 'USD' });
    const footer = screen.getByTestId('sales-dashboard-footer');
    expect(footer.textContent).toContain('Q2 2026');
    expect(footer.textContent).toContain('USD');
  });

  it('handles empty stages + deals without dividing by zero', () => {
    expect(() => renderAt(30, { stages: [], deals: [], pipelineType: 'funnel' })).not.toThrow();
  });
});

describe('salesDashboardClip definition (T-131f.2c)', () => {
  it("registers under kind 'sales-dashboard' with propsSchema", () => {
    expect(salesDashboardClip.kind).toBe('sales-dashboard');
    expect(salesDashboardClip.propsSchema).toBe(salesDashboardPropsSchema);
  });

  it('declares themeSlots for background + text + surface', () => {
    expect(salesDashboardClip.themeSlots).toEqual({
      background: { kind: 'palette', role: 'background' },
      textColor: { kind: 'palette', role: 'foreground' },
      surface: { kind: 'palette', role: 'surface' },
    });
  });

  it('propsSchema requires stages + deals', () => {
    expect(salesDashboardPropsSchema.safeParse({}).success).toBe(false);
    expect(salesDashboardPropsSchema.safeParse({ stages: [], deals: [] }).success).toBe(true);
  });

  it('propsSchema rejects unknown deal.status values', () => {
    expect(
      salesDashboardPropsSchema.safeParse({
        stages: [],
        deals: [
          {
            id: 'x',
            name: 'X',
            company: 'X',
            value: 1,
            status: 'bogus',
            stageId: 'x',
            closeDate: '2026-01-01',
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('propsSchema rejects out-of-range probability', () => {
    expect(
      salesDashboardPropsSchema.safeParse({
        stages: [],
        deals: [
          {
            id: 'x',
            name: 'X',
            company: 'X',
            value: 1,
            status: 'on_track',
            stageId: 'x',
            closeDate: '2026-01-01',
            probability: 150,
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('integrates with resolveClipDefaultsForTheme', () => {
    const theme: Theme = {
      palette: { background: '#080f15', foreground: '#ebf1fa', surface: '#151c23' },
      tokens: {},
    };
    const out = resolveClipDefaultsForTheme(
      salesDashboardClip as unknown as Parameters<
        typeof resolveClipDefaultsForTheme<SalesDashboardProps>
      >[0],
      theme,
      { stages: [], deals: [] } as SalesDashboardProps,
    );
    expect(out.background).toBe('#080f15');
    expect(out.textColor).toBe('#ebf1fa');
    expect(out.surface).toBe('#151c23');
  });
});
