// packages/engine/src/handlers/domain-finance-sales-okr/finance.ts
// 9 finance-domain composite tools. Each tool inserts one slide with
// appropriately-shaped elements (KPI strips, charts, hero callouts,
// timelines). Slide id is auto-generated using create-mutate's
// `nextSlideId`.

import type { LLMToolDefinition } from '@stageflip/llm-abstraction';
import { z } from 'zod';
import type { MutationContext, ToolHandler } from '../../router/types.js';
import { nextSlideId } from '../create-mutate/ids.js';
import {
  currentCount,
  makeBodyText,
  makeChart,
  makeHeroNumber,
  makeMetricCard,
  makeShape,
  makeSlide,
  makeTitleText,
  stripLayout,
} from './builders.js';

const nonEmptyString = z.string().min(1).max(400);
const BUNDLE = 'domain-finance-sales-okr';

function insertSlide(ctx: MutationContext, slide: unknown): string {
  if (ctx.document.content.mode !== 'slide') throw new Error('not slide');
  const slides = ctx.document.content.slides;
  const path = `/content/slides/${slides.length === 0 ? '-' : '-'}`;
  ctx.patchSink.push({ op: 'add', path, value: slide });
  return (slide as { id: string }).id;
}

function wrongModeFail() {
  return { ok: false as const, reason: 'wrong_mode' as const };
}

function ensureSlide(ctx: MutationContext): 'ok' | 'wrong_mode' {
  return ctx.document.content.mode === 'slide' ? 'ok' : 'wrong_mode';
}

// Common output shape: { ok, slideId } on success
const slideCreatedOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      slideId: z.string(),
      position: z.number().int().nonnegative(),
    })
    .strict(),
  z.object({ ok: z.literal(false), reason: z.enum(['wrong_mode']) }).strict(),
]);

// ---------------------------------------------------------------------------
// 1 — create_kpi_strip_slide
// ---------------------------------------------------------------------------

const kpiStripInput = z
  .object({
    title: nonEmptyString,
    metrics: z
      .array(
        z
          .object({
            label: z.string().min(1).max(100),
            value: z.string().min(1).max(80),
          })
          .strict(),
      )
      .min(1)
      .max(6),
  })
  .strict();

export const createKpiStripSlide: ToolHandler<
  z.infer<typeof kpiStripInput>,
  z.infer<typeof slideCreatedOutput>,
  MutationContext
> = {
  name: 'create_kpi_strip_slide',
  bundle: BUNDLE,
  description:
    'Finance: insert a KPI-strip slide. `metrics` (1–6) become equal-width cards with a label + value. Card layout auto-fills the 1920-px canvas.',
  inputSchema: kpiStripInput,
  outputSchema: slideCreatedOutput,
  handle: (input, ctx) => {
    if (ensureSlide(ctx) === 'wrong_mode') return wrongModeFail();
    const position = currentCount(ctx);
    const slideId = nextSlideId(ctx.document);
    const layout = stripLayout(input.metrics.length);
    const cards = input.metrics.map((m, i) =>
      makeMetricCard(`${slideId}-card-${i + 1}`, m.label, m.value, layout[i]),
    );
    insertSlide(ctx, makeSlide(slideId, input.title, cards));
    return { ok: true, slideId, position };
  },
};

// ---------------------------------------------------------------------------
// 2 — create_revenue_chart_slide
// ---------------------------------------------------------------------------

const revenueInput = z
  .object({
    title: nonEmptyString,
    labels: z.array(z.string().min(1)).min(1).max(24),
    series: z
      .array(
        z
          .object({
            name: z.string().min(1),
            values: z.array(z.number().nullable()).min(1),
          })
          .strict(),
      )
      .min(1)
      .max(6),
    chartKind: z.enum(['line', 'bar', 'area', 'combo']).optional(),
  })
  .strict();

export const createRevenueChartSlide: ToolHandler<
  z.infer<typeof revenueInput>,
  z.infer<typeof slideCreatedOutput>,
  MutationContext
> = {
  name: 'create_revenue_chart_slide',
  bundle: BUNDLE,
  description:
    'Finance: slide with a revenue chart. `chartKind` defaults to `line`. Each series represents one revenue stream / period; values may contain `null` for gaps.',
  inputSchema: revenueInput,
  outputSchema: slideCreatedOutput,
  handle: (input, ctx) => {
    if (ensureSlide(ctx) === 'wrong_mode') return wrongModeFail();
    const position = currentCount(ctx);
    const slideId = nextSlideId(ctx.document);
    const chart = makeChart(`${slideId}-chart`, input.chartKind ?? 'line', {
      labels: input.labels,
      series: input.series,
    });
    insertSlide(ctx, makeSlide(slideId, input.title, [chart]));
    return { ok: true, slideId, position };
  },
};

// ---------------------------------------------------------------------------
// 3 — create_expense_breakdown_slide
// ---------------------------------------------------------------------------

const expenseInput = z
  .object({
    title: nonEmptyString,
    categories: z
      .array(
        z
          .object({
            label: z.string().min(1),
            amount: z.number().nonnegative(),
          })
          .strict(),
      )
      .min(2)
      .max(12),
    kind: z.enum(['pie', 'donut']).optional(),
  })
  .strict();

export const createExpenseBreakdownSlide: ToolHandler<
  z.infer<typeof expenseInput>,
  z.infer<typeof slideCreatedOutput>,
  MutationContext
> = {
  name: 'create_expense_breakdown_slide',
  bundle: BUNDLE,
  description:
    'Finance: slide with a pie or donut chart of expense categories. Chart data is built from `categories` (2–12 entries).',
  inputSchema: expenseInput,
  outputSchema: slideCreatedOutput,
  handle: (input, ctx) => {
    if (ensureSlide(ctx) === 'wrong_mode') return wrongModeFail();
    const position = currentCount(ctx);
    const slideId = nextSlideId(ctx.document);
    const chart = makeChart(`${slideId}-chart`, input.kind ?? 'donut', {
      labels: input.categories.map((c) => c.label),
      series: [{ name: 'Expense', values: input.categories.map((c) => c.amount) }],
    });
    insertSlide(ctx, makeSlide(slideId, input.title, [chart]));
    return { ok: true, slideId, position };
  },
};

// ---------------------------------------------------------------------------
// 4 — create_cashflow_slide
// ---------------------------------------------------------------------------

const cashflowInput = z
  .object({
    title: nonEmptyString,
    periods: z.array(z.string().min(1)).min(2).max(24),
    inflow: z.array(z.number()).min(2),
    outflow: z.array(z.number()).min(2),
  })
  .strict();

export const createCashflowSlide: ToolHandler<
  z.infer<typeof cashflowInput>,
  z.infer<typeof slideCreatedOutput>,
  MutationContext
> = {
  name: 'create_cashflow_slide',
  bundle: BUNDLE,
  description:
    'Finance: slide with a grouped bar chart showing inflow vs outflow across periods. Arrays must be the same length as `periods`.',
  inputSchema: cashflowInput,
  outputSchema: slideCreatedOutput,
  handle: (input, ctx) => {
    if (ensureSlide(ctx) === 'wrong_mode') return wrongModeFail();
    const position = currentCount(ctx);
    const slideId = nextSlideId(ctx.document);
    const chart = makeChart(`${slideId}-chart`, 'bar', {
      labels: input.periods,
      series: [
        { name: 'Inflow', values: input.inflow },
        { name: 'Outflow', values: input.outflow.map((v) => -Math.abs(v)) },
      ],
    });
    insertSlide(ctx, makeSlide(slideId, input.title, [chart]));
    return { ok: true, slideId, position };
  },
};

// ---------------------------------------------------------------------------
// 5 — create_runway_callout
// ---------------------------------------------------------------------------

const runwayInput = z
  .object({
    title: nonEmptyString,
    months: z.number().positive().max(120),
    subtitle: z.string().max(200).optional(),
  })
  .strict();

export const createRunwayCallout: ToolHandler<
  z.infer<typeof runwayInput>,
  z.infer<typeof slideCreatedOutput>,
  MutationContext
> = {
  name: 'create_runway_callout',
  bundle: BUNDLE,
  description:
    'Finance: slide with a single hero number showing cash runway in months. Optional `subtitle` appears below.',
  inputSchema: runwayInput,
  outputSchema: slideCreatedOutput,
  handle: (input, ctx) => {
    if (ensureSlide(ctx) === 'wrong_mode') return wrongModeFail();
    const position = currentCount(ctx);
    const slideId = nextSlideId(ctx.document);
    const hero = makeHeroNumber(`${slideId}-hero`, `${input.months} months`);
    const elements: unknown[] = [hero];
    if (input.subtitle) {
      elements.push(
        makeBodyText(`${slideId}-sub`, input.subtitle, {
          x: 200,
          y: 640,
          width: 1520,
          height: 80,
        }),
      );
    }
    insertSlide(ctx, makeSlide(slideId, input.title, elements));
    return { ok: true, slideId, position };
  },
};

// ---------------------------------------------------------------------------
// 6 — create_arr_mrr_snapshot
// ---------------------------------------------------------------------------

const arrMrrInput = z
  .object({
    title: nonEmptyString,
    arr: z.string().min(1).max(80),
    mrr: z.string().min(1).max(80),
    delta: z.string().max(80).optional(),
  })
  .strict();

export const createArrMrrSnapshot: ToolHandler<
  z.infer<typeof arrMrrInput>,
  z.infer<typeof slideCreatedOutput>,
  MutationContext
> = {
  name: 'create_arr_mrr_snapshot',
  bundle: BUNDLE,
  description:
    'Finance: slide showing ARR and MRR side-by-side as large metric cards, with an optional growth delta line below.',
  inputSchema: arrMrrInput,
  outputSchema: slideCreatedOutput,
  handle: (input, ctx) => {
    if (ensureSlide(ctx) === 'wrong_mode') return wrongModeFail();
    const position = currentCount(ctx);
    const slideId = nextSlideId(ctx.document);
    const layout = stripLayout(2, { height: 360 });
    const cards = [
      makeMetricCard(`${slideId}-arr`, 'ARR', input.arr, layout[0]),
      makeMetricCard(`${slideId}-mrr`, 'MRR', input.mrr, layout[1]),
    ];
    const elements: unknown[] = [...cards];
    if (input.delta) {
      elements.push(
        makeBodyText(`${slideId}-delta`, input.delta, {
          x: 80,
          y: 720,
          width: 1760,
          height: 80,
        }),
      );
    }
    insertSlide(ctx, makeSlide(slideId, input.title, elements));
    return { ok: true, slideId, position };
  },
};

// ---------------------------------------------------------------------------
// 7 — create_funding_timeline
// ---------------------------------------------------------------------------

const fundingInput = z
  .object({
    title: nonEmptyString,
    rounds: z
      .array(
        z
          .object({
            label: z.string().min(1),
            amount: z.string().min(1).max(80),
            date: z.string().min(1).max(40),
          })
          .strict(),
      )
      .min(1)
      .max(10),
  })
  .strict();

export const createFundingTimeline: ToolHandler<
  z.infer<typeof fundingInput>,
  z.infer<typeof slideCreatedOutput>,
  MutationContext
> = {
  name: 'create_funding_timeline',
  bundle: BUNDLE,
  description:
    'Finance: slide with a horizontal funding-rounds timeline. Each round is a shape with amount + date labels. `rounds` should be chronological.',
  inputSchema: fundingInput,
  outputSchema: slideCreatedOutput,
  handle: (input, ctx) => {
    if (ensureSlide(ctx) === 'wrong_mode') return wrongModeFail();
    const position = currentCount(ctx);
    const slideId = nextSlideId(ctx.document);
    const rail = makeShape(`${slideId}-rail`, 'rect', { x: 80, y: 470, width: 1760, height: 8 });
    const elements: unknown[] = [rail];
    const layout = stripLayout(input.rounds.length, { y: 380, height: 280 });
    input.rounds.forEach((round, i) => {
      const t = layout[i];
      if (!t) return;
      elements.push(
        makeMetricCard(
          `${slideId}-round-${i + 1}`,
          `${round.label} · ${round.date}`,
          round.amount,
          { x: t.x, y: t.y, width: t.width, height: 200 },
        ),
      );
    });
    insertSlide(ctx, makeSlide(slideId, input.title, elements));
    return { ok: true, slideId, position };
  },
};

// ---------------------------------------------------------------------------
// 8 — create_balance_sheet_summary
// ---------------------------------------------------------------------------

const balanceInput = z
  .object({
    title: nonEmptyString,
    assets: z.string().min(1).max(80),
    liabilities: z.string().min(1).max(80),
    equity: z.string().min(1).max(80),
  })
  .strict();

export const createBalanceSheetSummary: ToolHandler<
  z.infer<typeof balanceInput>,
  z.infer<typeof slideCreatedOutput>,
  MutationContext
> = {
  name: 'create_balance_sheet_summary',
  bundle: BUNDLE,
  description:
    'Finance: 3-column balance-sheet summary slide — Assets / Liabilities / Equity — with totals as hero values on each card.',
  inputSchema: balanceInput,
  outputSchema: slideCreatedOutput,
  handle: (input, ctx) => {
    if (ensureSlide(ctx) === 'wrong_mode') return wrongModeFail();
    const position = currentCount(ctx);
    const slideId = nextSlideId(ctx.document);
    const layout = stripLayout(3, { height: 360 });
    const cards = [
      makeMetricCard(`${slideId}-assets`, 'Assets', input.assets, layout[0]),
      makeMetricCard(`${slideId}-liabilities`, 'Liabilities', input.liabilities, layout[1]),
      makeMetricCard(`${slideId}-equity`, 'Equity', input.equity, layout[2]),
    ];
    insertSlide(ctx, makeSlide(slideId, input.title, cards));
    return { ok: true, slideId, position };
  },
};

// ---------------------------------------------------------------------------
// 9 — create_margin_callout
// ---------------------------------------------------------------------------

const marginInput = z
  .object({
    title: nonEmptyString,
    grossMargin: z.string().min(1).max(80),
    operatingMargin: z.string().max(80).optional(),
    netMargin: z.string().max(80).optional(),
  })
  .strict();

export const createMarginCallout: ToolHandler<
  z.infer<typeof marginInput>,
  z.infer<typeof slideCreatedOutput>,
  MutationContext
> = {
  name: 'create_margin_callout',
  bundle: BUNDLE,
  description:
    'Finance: slide showing one to three margin values side-by-side. `grossMargin` is required; operating + net are optional. Good for P&L summary or investor-update hero slides.',
  inputSchema: marginInput,
  outputSchema: slideCreatedOutput,
  handle: (input, ctx) => {
    if (ensureSlide(ctx) === 'wrong_mode') return wrongModeFail();
    const position = currentCount(ctx);
    const slideId = nextSlideId(ctx.document);
    const items = [
      { label: 'Gross Margin', value: input.grossMargin },
      ...(input.operatingMargin
        ? [{ label: 'Operating Margin', value: input.operatingMargin }]
        : []),
      ...(input.netMargin ? [{ label: 'Net Margin', value: input.netMargin }] : []),
    ];
    const layout = stripLayout(items.length, { height: 360 });
    const cards = items.map((m, i) =>
      makeMetricCard(`${slideId}-m-${i + 1}`, m.label, m.value, layout[i]),
    );
    insertSlide(ctx, makeSlide(slideId, input.title, cards));
    return { ok: true, slideId, position };
  },
};

// Unused import guard for makeTitleText (used by makeSlide indirectly).
void makeTitleText;

export const FINANCE_HANDLERS: ReadonlyArray<ToolHandler<unknown, unknown, MutationContext>> = [
  createKpiStripSlide,
  createRevenueChartSlide,
  createExpenseBreakdownSlide,
  createCashflowSlide,
  createRunwayCallout,
  createArrMrrSnapshot,
  createFundingTimeline,
  createBalanceSheetSummary,
  createMarginCallout,
] as unknown as ReadonlyArray<ToolHandler<unknown, unknown, MutationContext>>;

// --------------------- LLM tool definitions ---------------------

const str = { type: 'string' as const };
const strNonEmpty = { type: 'string' as const, minLength: 1 };

export const FINANCE_TOOL_DEFINITIONS: ReadonlyArray<LLMToolDefinition> = [
  {
    name: 'create_kpi_strip_slide',
    description: createKpiStripSlide.description,
    input_schema: {
      type: 'object',
      required: ['title', 'metrics'],
      additionalProperties: false,
      properties: {
        title: { ...strNonEmpty, maxLength: 400 },
        metrics: {
          type: 'array',
          minItems: 1,
          maxItems: 6,
          items: {
            type: 'object',
            required: ['label', 'value'],
            additionalProperties: false,
            properties: { label: strNonEmpty, value: strNonEmpty },
          },
        },
      },
    },
  },
  {
    name: 'create_revenue_chart_slide',
    description: createRevenueChartSlide.description,
    input_schema: {
      type: 'object',
      required: ['title', 'labels', 'series'],
      additionalProperties: false,
      properties: {
        title: strNonEmpty,
        labels: { type: 'array', minItems: 1, maxItems: 24, items: strNonEmpty },
        series: {
          type: 'array',
          minItems: 1,
          maxItems: 6,
          items: {
            type: 'object',
            required: ['name', 'values'],
            additionalProperties: false,
            properties: {
              name: strNonEmpty,
              values: { type: 'array', minItems: 1, items: { type: ['number', 'null'] } },
            },
          },
        },
        chartKind: { type: 'string', enum: ['line', 'bar', 'area', 'combo'] },
      },
    },
  },
  {
    name: 'create_expense_breakdown_slide',
    description: createExpenseBreakdownSlide.description,
    input_schema: {
      type: 'object',
      required: ['title', 'categories'],
      additionalProperties: false,
      properties: {
        title: strNonEmpty,
        categories: {
          type: 'array',
          minItems: 2,
          maxItems: 12,
          items: {
            type: 'object',
            required: ['label', 'amount'],
            additionalProperties: false,
            properties: { label: strNonEmpty, amount: { type: 'number', minimum: 0 } },
          },
        },
        kind: { type: 'string', enum: ['pie', 'donut'] },
      },
    },
  },
  {
    name: 'create_cashflow_slide',
    description: createCashflowSlide.description,
    input_schema: {
      type: 'object',
      required: ['title', 'periods', 'inflow', 'outflow'],
      additionalProperties: false,
      properties: {
        title: strNonEmpty,
        periods: { type: 'array', minItems: 2, maxItems: 24, items: strNonEmpty },
        inflow: { type: 'array', minItems: 2, items: { type: 'number' } },
        outflow: { type: 'array', minItems: 2, items: { type: 'number' } },
      },
    },
  },
  {
    name: 'create_runway_callout',
    description: createRunwayCallout.description,
    input_schema: {
      type: 'object',
      required: ['title', 'months'],
      additionalProperties: false,
      properties: {
        title: strNonEmpty,
        months: { type: 'number', exclusiveMinimum: 0, maximum: 120 },
        subtitle: str,
      },
    },
  },
  {
    name: 'create_arr_mrr_snapshot',
    description: createArrMrrSnapshot.description,
    input_schema: {
      type: 'object',
      required: ['title', 'arr', 'mrr'],
      additionalProperties: false,
      properties: {
        title: strNonEmpty,
        arr: strNonEmpty,
        mrr: strNonEmpty,
        delta: str,
      },
    },
  },
  {
    name: 'create_funding_timeline',
    description: createFundingTimeline.description,
    input_schema: {
      type: 'object',
      required: ['title', 'rounds'],
      additionalProperties: false,
      properties: {
        title: strNonEmpty,
        rounds: {
          type: 'array',
          minItems: 1,
          maxItems: 10,
          items: {
            type: 'object',
            required: ['label', 'amount', 'date'],
            additionalProperties: false,
            properties: {
              label: strNonEmpty,
              amount: strNonEmpty,
              date: strNonEmpty,
            },
          },
        },
      },
    },
  },
  {
    name: 'create_balance_sheet_summary',
    description: createBalanceSheetSummary.description,
    input_schema: {
      type: 'object',
      required: ['title', 'assets', 'liabilities', 'equity'],
      additionalProperties: false,
      properties: {
        title: strNonEmpty,
        assets: strNonEmpty,
        liabilities: strNonEmpty,
        equity: strNonEmpty,
      },
    },
  },
  {
    name: 'create_margin_callout',
    description: createMarginCallout.description,
    input_schema: {
      type: 'object',
      required: ['title', 'grossMargin'],
      additionalProperties: false,
      properties: {
        title: strNonEmpty,
        grossMargin: strNonEmpty,
        operatingMargin: str,
        netMargin: str,
      },
    },
  },
];
