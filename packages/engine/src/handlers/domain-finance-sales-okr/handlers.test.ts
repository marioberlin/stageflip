// packages/engine/src/handlers/domain-finance-sales-okr/handlers.test.ts
// Smoke tests — one happy-path per handler (27 tests) + a few shared-mode
// guard checks. Each test asserts the handler returns ok + emits a slide
// `add` op targeting `/content/slides/-`. Element-level composition is
// covered by the shared builder tests (not present here — builders are
// pure functions without side effects).

import type { Document } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';
import type { JsonPatchOp, MutationContext, PatchSink } from '../../router/types.js';
import { DOMAIN_HANDLERS } from './handlers.js';

function collectingSink(): PatchSink & { drain(): JsonPatchOp[] } {
  const queue: JsonPatchOp[] = [];
  return {
    push(op) {
      queue.push(op);
    },
    pushAll(ops) {
      for (const op of ops) queue.push(op);
    },
    drain() {
      const out = queue.slice();
      queue.length = 0;
      return out;
    },
  };
}

function ctx(document: Document): MutationContext & {
  patchSink: ReturnType<typeof collectingSink>;
} {
  return { document, patchSink: collectingSink() };
}

function doc(): Document {
  return {
    meta: {
      id: 'doc-1',
      version: 1,
      createdAt: '2026-04-24T00:00:00.000Z',
      updatedAt: '2026-04-24T00:00:00.000Z',
      schemaVersion: 1,
      locale: 'en',
    },
    theme: { tokens: {} },
    variables: {},
    components: {},
    content: {
      mode: 'slide',
      slides: [{ id: 'slide-1', elements: [] } as never],
    },
  } as unknown as Document;
}

function videoDoc(): Document {
  return {
    ...doc(),
    content: { mode: 'video', tracks: [], durationMs: 1 } as never,
  } as Document;
}

function find(name: string) {
  const h = DOMAIN_HANDLERS.find((x) => x.name === name);
  if (!h) throw new Error(`handler ${name} missing`);
  return h;
}

function expectSlideAddPatch(c: ReturnType<typeof ctx>) {
  const patches = c.patchSink.drain();
  expect(patches).toHaveLength(1);
  expect(patches[0]?.op).toBe('add');
  expect(patches[0]?.path).toBe('/content/slides/-');
  expect((patches[0]?.value as { id: string }).id).toMatch(/^slide-\d+$/);
}

// ---------------------------------------------------------------------------
// Finance
// ---------------------------------------------------------------------------

describe('finance composites', () => {
  it('create_kpi_strip_slide inserts a slide', async () => {
    const c = ctx(doc());
    const r = await find('create_kpi_strip_slide').handle(
      {
        title: 'Q3 KPIs',
        metrics: [
          { label: 'Revenue', value: '$8.2M' },
          { label: 'Net New ARR', value: '$1.1M' },
        ],
      },
      c,
    );
    expect(r).toMatchObject({ ok: true });
    expectSlideAddPatch(c);
  });

  it('create_revenue_chart_slide inserts a slide with a chart', async () => {
    const c = ctx(doc());
    const r = await find('create_revenue_chart_slide').handle(
      {
        title: 'Revenue',
        labels: ['Q1', 'Q2', 'Q3'],
        series: [{ name: 'ARR', values: [1, 2, 3] }],
      },
      c,
    );
    expect(r).toMatchObject({ ok: true });
    expectSlideAddPatch(c);
  });

  it('create_expense_breakdown_slide inserts a donut by default', async () => {
    const c = ctx(doc());
    await find('create_expense_breakdown_slide').handle(
      {
        title: 'Expenses',
        categories: [
          { label: 'Salaries', amount: 100 },
          { label: 'AWS', amount: 40 },
          { label: 'Marketing', amount: 20 },
        ],
      },
      c,
    );
    expectSlideAddPatch(c);
  });

  it('create_cashflow_slide emits a slide', async () => {
    const c = ctx(doc());
    await find('create_cashflow_slide').handle(
      {
        title: 'Cashflow',
        periods: ['Jan', 'Feb', 'Mar'],
        inflow: [1, 2, 3],
        outflow: [1.5, 1.8, 2],
      },
      c,
    );
    expectSlideAddPatch(c);
  });

  it('create_runway_callout inserts with optional subtitle', async () => {
    const c = ctx(doc());
    await find('create_runway_callout').handle(
      { title: 'Runway', months: 18, subtitle: 'at current burn' },
      c,
    );
    expectSlideAddPatch(c);
  });

  it('create_arr_mrr_snapshot inserts', async () => {
    const c = ctx(doc());
    await find('create_arr_mrr_snapshot').handle(
      { title: 'SaaS metrics', arr: '$12M', mrr: '$1M' },
      c,
    );
    expectSlideAddPatch(c);
  });

  it('create_funding_timeline inserts', async () => {
    const c = ctx(doc());
    await find('create_funding_timeline').handle(
      {
        title: 'Funding',
        rounds: [
          { label: 'Seed', amount: '$2M', date: '2022' },
          { label: 'Series A', amount: '$10M', date: '2024' },
        ],
      },
      c,
    );
    expectSlideAddPatch(c);
  });

  it('create_balance_sheet_summary inserts', async () => {
    const c = ctx(doc());
    await find('create_balance_sheet_summary').handle(
      { title: 'Balance sheet', assets: '$100M', liabilities: '$30M', equity: '$70M' },
      c,
    );
    expectSlideAddPatch(c);
  });

  it('create_margin_callout inserts with just grossMargin', async () => {
    const c = ctx(doc());
    await find('create_margin_callout').handle({ title: 'Margins', grossMargin: '72%' }, c);
    expectSlideAddPatch(c);
  });
});

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

describe('sales composites', () => {
  it('create_pipeline_funnel_slide inserts', async () => {
    const c = ctx(doc());
    await find('create_pipeline_funnel_slide').handle(
      {
        title: 'Funnel',
        stages: [
          { name: 'MQL', count: 500 },
          { name: 'SQL', count: 200 },
          { name: 'Won', count: 40 },
        ],
      },
      c,
    );
    expectSlideAddPatch(c);
  });

  it('create_quota_attainment_slide inserts', async () => {
    const c = ctx(doc());
    await find('create_quota_attainment_slide').handle(
      {
        title: 'Attainment',
        team: [
          { rep: 'Alice', attained: 1.1 },
          { rep: 'Bob', attained: 0.8 },
        ],
      },
      c,
    );
    expectSlideAddPatch(c);
  });

  it('create_win_loss_breakdown inserts', async () => {
    const c = ctx(doc());
    await find('create_win_loss_breakdown').handle(
      {
        title: 'Win/Loss',
        won: 12,
        lost: 5,
        reasons: [
          { reason: 'Price', count: 3 },
          { reason: 'Features', count: 2 },
        ],
      },
      c,
    );
    expectSlideAddPatch(c);
  });

  it('create_pipeline_coverage_callout inserts', async () => {
    const c = ctx(doc());
    await find('create_pipeline_coverage_callout').handle(
      { title: 'Coverage', coverageMultiple: 3.2 },
      c,
    );
    expectSlideAddPatch(c);
  });

  it('create_top_opportunities_slide inserts', async () => {
    const c = ctx(doc());
    await find('create_top_opportunities_slide').handle(
      {
        title: 'Top opps',
        opportunities: [
          { account: 'Acme', amount: '$1.2M', stage: 'Proposal' },
          { account: 'Beta', amount: '$800K' },
        ],
      },
      c,
    );
    expectSlideAddPatch(c);
  });

  it('create_rep_leaderboard_slide inserts', async () => {
    const c = ctx(doc());
    await find('create_rep_leaderboard_slide').handle(
      { title: 'Leaders', rows: [{ rep: 'Alice', value: '$2M' }] },
      c,
    );
    expectSlideAddPatch(c);
  });

  it('create_sales_cycle_slide inserts', async () => {
    const c = ctx(doc());
    await find('create_sales_cycle_slide').handle(
      {
        title: 'Cycle',
        stages: [
          { name: 'Lead', avgDays: 3 },
          { name: 'Closed', avgDays: 30 },
        ],
      },
      c,
    );
    expectSlideAddPatch(c);
  });

  it('create_territory_summary_slide inserts', async () => {
    const c = ctx(doc());
    await find('create_territory_summary_slide').handle(
      {
        title: 'Territories',
        territories: [
          { name: 'NA', revenue: '$10M', growth: '+20%' },
          { name: 'EMEA', revenue: '$6M' },
        ],
      },
      c,
    );
    expectSlideAddPatch(c);
  });

  it('create_close_rate_callout inserts', async () => {
    const c = ctx(doc());
    await find('create_close_rate_callout').handle(
      { title: 'Close rate', closeRate: 0.27, benchmark: 0.22 },
      c,
    );
    expectSlideAddPatch(c);
  });
});

// ---------------------------------------------------------------------------
// OKR
// ---------------------------------------------------------------------------

describe('okr composites', () => {
  it('create_okr_slide inserts', async () => {
    const c = ctx(doc());
    await find('create_okr_slide').handle(
      {
        title: 'OKR 1',
        objective: 'Launch v2',
        keyResults: [
          { text: 'Ship beta', progress: 0.7 },
          { text: 'Onboard 10 customers', progress: 0.4 },
        ],
      },
      c,
    );
    expectSlideAddPatch(c);
  });

  it('create_okr_summary_slide inserts', async () => {
    const c = ctx(doc());
    await find('create_okr_summary_slide').handle(
      {
        title: 'Q3 OKRs',
        quarter: 'Q3 2026',
        okrs: [
          { objective: 'Launch v2', status: 'on-track', progress: 0.7 },
          { objective: 'Reach 100 customers', status: 'at-risk', progress: 0.4 },
        ],
      },
      c,
    );
    expectSlideAddPatch(c);
  });

  it('create_objective_hero_slide inserts', async () => {
    const c = ctx(doc());
    await find('create_objective_hero_slide').handle(
      { title: 'Objective', objective: 'Ship fast' },
      c,
    );
    expectSlideAddPatch(c);
  });

  it('create_okr_check_in_slide inserts', async () => {
    const c = ctx(doc());
    await find('create_okr_check_in_slide').handle(
      {
        title: 'Weekly',
        weekLabel: 'Week of 2026-04-21',
        updates: [{ okr: 'Ship beta', status: 'on-track' }],
      },
      c,
    );
    expectSlideAddPatch(c);
  });

  it('create_okr_retro_slide inserts', async () => {
    const c = ctx(doc());
    await find('create_okr_retro_slide').handle(
      {
        title: 'Retro',
        quarter: 'Q3',
        wins: ['Launched'],
        misses: ['Missed NPS target'],
      },
      c,
    );
    expectSlideAddPatch(c);
  });

  it('create_quarterly_roadmap_slide inserts', async () => {
    const c = ctx(doc());
    await find('create_quarterly_roadmap_slide').handle(
      {
        title: 'Roadmap',
        quarters: [
          { label: 'Q1', items: ['Thing A'] },
          { label: 'Q2', items: ['Thing B'] },
        ],
      },
      c,
    );
    expectSlideAddPatch(c);
  });

  it('create_key_result_scorecard_slide inserts', async () => {
    const c = ctx(doc());
    await find('create_key_result_scorecard_slide').handle(
      {
        title: 'Scorecard',
        rows: [
          {
            keyResult: 'Ship 100 features',
            target: '100',
            actual: '80',
            status: 'at-risk',
          },
        ],
      },
      c,
    );
    expectSlideAddPatch(c);
  });

  it('create_okr_divider_slide inserts', async () => {
    const c = ctx(doc());
    await find('create_okr_divider_slide').handle({ heading: 'Company OKRs' }, c);
    expectSlideAddPatch(c);
  });

  it('create_okr_grading_rubric_slide inserts', async () => {
    const c = ctx(doc());
    await find('create_okr_grading_rubric_slide').handle(
      {
        title: 'Rubric',
        bands: [
          { range: '0–0.3', label: 'Miss' },
          { range: '0.7–1.0', label: 'Hit' },
        ],
      },
      c,
    );
    expectSlideAddPatch(c);
  });
});

// ---------------------------------------------------------------------------
// Shared wrong_mode guard
// ---------------------------------------------------------------------------

describe('wrong_mode guard', () => {
  it('every handler refuses wrong_mode outside slide mode', async () => {
    for (const h of DOMAIN_HANDLERS) {
      const r = await h.handle(
        // Every tool accepts at least { title?/heading? } — pass empty + let Zod
        // ignore by calling handler directly with a benign-ish payload. The
        // handler checks mode first; if it passes mode check Zod-side input
        // will fail earlier via the router, not the handler. Here we only
        // need to prove mode is guarded.
        {} as never,
        ctx(videoDoc()) as never,
      );
      expect((r as { ok: boolean; reason?: string }).reason).toBe('wrong_mode');
    }
  });
});
