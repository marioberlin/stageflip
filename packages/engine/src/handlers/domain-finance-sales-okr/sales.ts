// packages/engine/src/handlers/domain-finance-sales-okr/sales.ts
// 9 sales-domain composite tools.

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
  makeProgressBar,
  makeShape,
  makeSlide,
  stripLayout,
} from './builders.js';

const BUNDLE = 'domain-finance-sales-okr';
const strNonEmpty = { type: 'string' as const, minLength: 1 };
const str = { type: 'string' as const };

function wrongModeFail() {
  return { ok: false as const, reason: 'wrong_mode' as const };
}
function ensureSlide(ctx: MutationContext) {
  return ctx.document.content.mode === 'slide' ? 'ok' : 'wrong_mode';
}
function insertSlide(ctx: MutationContext, slide: unknown) {
  ctx.patchSink.push({ op: 'add', path: '/content/slides/-', value: slide });
}

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

const title = z.string().min(1).max(400);

// ---------------------------------------------------------------------------
// 1 — create_pipeline_funnel_slide
// ---------------------------------------------------------------------------

const funnelInput = z
  .object({
    title,
    stages: z
      .array(
        z
          .object({
            name: z.string().min(1).max(60),
            count: z.number().int().nonnegative(),
          })
          .strict(),
      )
      .min(2)
      .max(8),
  })
  .strict();

export const createPipelineFunnelSlide: ToolHandler<
  z.infer<typeof funnelInput>,
  z.infer<typeof slideCreatedOutput>,
  MutationContext
> = {
  name: 'create_pipeline_funnel_slide',
  bundle: BUNDLE,
  description:
    'Sales: slide with a pipeline funnel. Each stage becomes a metric card showing stage name + count, stacked vertically (widest on top).',
  inputSchema: funnelInput,
  outputSchema: slideCreatedOutput,
  handle: (input, ctx) => {
    if (ensureSlide(ctx) === 'wrong_mode') return wrongModeFail();
    const position = currentCount(ctx);
    const slideId = nextSlideId(ctx.document);
    const elements: unknown[] = [];
    const stageHeight = 110;
    const gap = 12;
    input.stages.forEach((s, i) => {
      // Width tapers by ~12% per stage for a funnel silhouette.
      const shrink = Math.max(0.3, 1 - i * 0.12);
      const width = 1400 * shrink;
      const x = (1920 - width) / 2;
      elements.push(
        makeMetricCard(`${slideId}-stage-${i + 1}`, s.name, `${s.count}`, {
          x,
          y: 220 + i * (stageHeight + gap),
          width,
          height: stageHeight,
        }),
      );
    });
    insertSlide(ctx, makeSlide(slideId, input.title, elements));
    return { ok: true, slideId, position };
  },
};

// ---------------------------------------------------------------------------
// 2 — create_quota_attainment_slide
// ---------------------------------------------------------------------------

const quotaInput = z
  .object({
    title,
    team: z
      .array(
        z
          .object({
            rep: z.string().min(1).max(80),
            attained: z.number().min(0).max(2),
          })
          .strict(),
      )
      .min(1)
      .max(12),
  })
  .strict();

export const createQuotaAttainmentSlide: ToolHandler<
  z.infer<typeof quotaInput>,
  z.infer<typeof slideCreatedOutput>,
  MutationContext
> = {
  name: 'create_quota_attainment_slide',
  bundle: BUNDLE,
  description:
    'Sales: slide with a per-rep quota-attainment list (progress bars, 0..1 = % of quota; values > 1 show >100%). `attained` is capped at 2.0 in the UI.',
  inputSchema: quotaInput,
  outputSchema: slideCreatedOutput,
  handle: (input, ctx) => {
    if (ensureSlide(ctx) === 'wrong_mode') return wrongModeFail();
    const position = currentCount(ctx);
    const slideId = nextSlideId(ctx.document);
    const elements: unknown[] = [];
    const rowHeight = 80;
    input.team.forEach((t, i) => {
      elements.push(
        makeProgressBar(`${slideId}-row-${i + 1}`, t.rep, Math.min(1, t.attained), {
          x: 120,
          y: 240 + i * rowHeight,
          width: 1680,
          height: 40,
        }),
      );
    });
    insertSlide(ctx, makeSlide(slideId, input.title, elements));
    return { ok: true, slideId, position };
  },
};

// ---------------------------------------------------------------------------
// 3 — create_win_loss_breakdown
// ---------------------------------------------------------------------------

const winLossInput = z
  .object({
    title,
    won: z.number().int().nonnegative(),
    lost: z.number().int().nonnegative(),
    reasons: z
      .array(
        z
          .object({
            reason: z.string().min(1).max(80),
            count: z.number().int().nonnegative(),
          })
          .strict(),
      )
      .max(6)
      .optional(),
  })
  .strict();

export const createWinLossBreakdown: ToolHandler<
  z.infer<typeof winLossInput>,
  z.infer<typeof slideCreatedOutput>,
  MutationContext
> = {
  name: 'create_win_loss_breakdown',
  bundle: BUNDLE,
  description:
    'Sales: slide with won vs lost counts (two metric cards) and optional `reasons` pie chart below.',
  inputSchema: winLossInput,
  outputSchema: slideCreatedOutput,
  handle: (input, ctx) => {
    if (ensureSlide(ctx) === 'wrong_mode') return wrongModeFail();
    const position = currentCount(ctx);
    const slideId = nextSlideId(ctx.document);
    const layout = stripLayout(2, { height: 220 });
    const cards = [
      makeMetricCard(`${slideId}-won`, 'Won', `${input.won}`, layout[0]),
      makeMetricCard(`${slideId}-lost`, 'Lost', `${input.lost}`, layout[1]),
    ];
    const elements: unknown[] = [...cards];
    if (input.reasons && input.reasons.length > 0) {
      elements.push(
        makeChart(
          `${slideId}-reasons`,
          'pie',
          {
            labels: input.reasons.map((r) => r.reason),
            series: [{ name: 'Loss reason', values: input.reasons.map((r) => r.count) }],
          },
          { x: 200, y: 540, width: 1520, height: 460 },
        ),
      );
    }
    insertSlide(ctx, makeSlide(slideId, input.title, elements));
    return { ok: true, slideId, position };
  },
};

// ---------------------------------------------------------------------------
// 4 — create_pipeline_coverage_callout
// ---------------------------------------------------------------------------

const coverageInput = z
  .object({
    title,
    coverageMultiple: z.number().positive(),
    quota: z.string().max(80).optional(),
  })
  .strict();

export const createPipelineCoverageCallout: ToolHandler<
  z.infer<typeof coverageInput>,
  z.infer<typeof slideCreatedOutput>,
  MutationContext
> = {
  name: 'create_pipeline_coverage_callout',
  bundle: BUNDLE,
  description:
    'Sales: hero slide with pipeline-coverage multiple (e.g. `3.2x`) plus optional quota context line.',
  inputSchema: coverageInput,
  outputSchema: slideCreatedOutput,
  handle: (input, ctx) => {
    if (ensureSlide(ctx) === 'wrong_mode') return wrongModeFail();
    const position = currentCount(ctx);
    const slideId = nextSlideId(ctx.document);
    const hero = makeHeroNumber(`${slideId}-hero`, `${input.coverageMultiple.toFixed(1)}x`);
    const elements: unknown[] = [hero];
    if (input.quota) {
      elements.push(
        makeBodyText(`${slideId}-sub`, `vs quota ${input.quota}`, {
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
// 5 — create_top_opportunities_slide
// ---------------------------------------------------------------------------

const topOppInput = z
  .object({
    title,
    opportunities: z
      .array(
        z
          .object({
            account: z.string().min(1).max(80),
            amount: z.string().min(1).max(40),
            stage: z.string().max(40).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(6),
  })
  .strict();

export const createTopOpportunitiesSlide: ToolHandler<
  z.infer<typeof topOppInput>,
  z.infer<typeof slideCreatedOutput>,
  MutationContext
> = {
  name: 'create_top_opportunities_slide',
  bundle: BUNDLE,
  description:
    'Sales: grid of top-opportunity cards (account + dollar amount + optional stage). Up to 6 cards in two rows.',
  inputSchema: topOppInput,
  outputSchema: slideCreatedOutput,
  handle: (input, ctx) => {
    if (ensureSlide(ctx) === 'wrong_mode') return wrongModeFail();
    const position = currentCount(ctx);
    const slideId = nextSlideId(ctx.document);
    const elements: unknown[] = [];
    const cols = Math.min(3, input.opportunities.length);
    const rows = Math.ceil(input.opportunities.length / cols);
    const margin = 80;
    const gap = 24;
    const totalWidth = 1920 - margin * 2 - gap * (cols - 1);
    const width = totalWidth / cols;
    const rowHeight = 260;
    input.opportunities.forEach((opp, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      elements.push(
        makeMetricCard(
          `${slideId}-opp-${i + 1}`,
          opp.stage ? `${opp.account} · ${opp.stage}` : opp.account,
          opp.amount,
          {
            x: margin + col * (width + gap),
            y: 260 + row * (rowHeight + gap),
            width,
            height: rowHeight,
          },
        ),
      );
    });
    void rows;
    insertSlide(ctx, makeSlide(slideId, input.title, elements));
    return { ok: true, slideId, position };
  },
};

// ---------------------------------------------------------------------------
// 6 — create_rep_leaderboard_slide
// ---------------------------------------------------------------------------

const leaderInput = z
  .object({
    title,
    rows: z
      .array(
        z
          .object({
            rep: z.string().min(1).max(60),
            value: z.string().min(1).max(60),
          })
          .strict(),
      )
      .min(1)
      .max(12),
  })
  .strict();

export const createRepLeaderboardSlide: ToolHandler<
  z.infer<typeof leaderInput>,
  z.infer<typeof slideCreatedOutput>,
  MutationContext
> = {
  name: 'create_rep_leaderboard_slide',
  bundle: BUNDLE,
  description:
    'Sales: rep leaderboard slide. Each row is a full-width metric card showing the rep name + their value (closed revenue, win count, etc.).',
  inputSchema: leaderInput,
  outputSchema: slideCreatedOutput,
  handle: (input, ctx) => {
    if (ensureSlide(ctx) === 'wrong_mode') return wrongModeFail();
    const position = currentCount(ctx);
    const slideId = nextSlideId(ctx.document);
    const rowHeight = 64;
    const elements = input.rows.map((row, i) =>
      makeMetricCard(`${slideId}-row-${i + 1}`, `${i + 1}. ${row.rep}`, row.value, {
        x: 120,
        y: 240 + i * (rowHeight + 8),
        width: 1680,
        height: rowHeight,
      }),
    );
    insertSlide(ctx, makeSlide(slideId, input.title, elements));
    return { ok: true, slideId, position };
  },
};

// ---------------------------------------------------------------------------
// 7 — create_sales_cycle_slide
// ---------------------------------------------------------------------------

const cycleInput = z
  .object({
    title,
    stages: z
      .array(
        z
          .object({
            name: z.string().min(1).max(60),
            avgDays: z.number().nonnegative(),
          })
          .strict(),
      )
      .min(2)
      .max(8),
  })
  .strict();

export const createSalesCycleSlide: ToolHandler<
  z.infer<typeof cycleInput>,
  z.infer<typeof slideCreatedOutput>,
  MutationContext
> = {
  name: 'create_sales_cycle_slide',
  bundle: BUNDLE,
  description:
    'Sales: horizontal timeline of sales-cycle stages with average days per stage. Renders as a bar chart with stages as categories.',
  inputSchema: cycleInput,
  outputSchema: slideCreatedOutput,
  handle: (input, ctx) => {
    if (ensureSlide(ctx) === 'wrong_mode') return wrongModeFail();
    const position = currentCount(ctx);
    const slideId = nextSlideId(ctx.document);
    const chart = makeChart(`${slideId}-chart`, 'bar', {
      labels: input.stages.map((s) => s.name),
      series: [{ name: 'Avg days', values: input.stages.map((s) => s.avgDays) }],
    });
    insertSlide(ctx, makeSlide(slideId, input.title, [chart]));
    return { ok: true, slideId, position };
  },
};

// ---------------------------------------------------------------------------
// 8 — create_territory_summary_slide
// ---------------------------------------------------------------------------

const territoryInput = z
  .object({
    title,
    territories: z
      .array(
        z
          .object({
            name: z.string().min(1).max(60),
            revenue: z.string().min(1).max(40),
            growth: z.string().max(40).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(8),
  })
  .strict();

export const createTerritorySummarySlide: ToolHandler<
  z.infer<typeof territoryInput>,
  z.infer<typeof slideCreatedOutput>,
  MutationContext
> = {
  name: 'create_territory_summary_slide',
  bundle: BUNDLE,
  description:
    'Sales: grid of territory cards (name + revenue + optional growth). Up to 8 cards (4 columns × 2 rows).',
  inputSchema: territoryInput,
  outputSchema: slideCreatedOutput,
  handle: (input, ctx) => {
    if (ensureSlide(ctx) === 'wrong_mode') return wrongModeFail();
    const position = currentCount(ctx);
    const slideId = nextSlideId(ctx.document);
    const cols = Math.min(4, input.territories.length);
    const margin = 80;
    const gap = 24;
    const totalWidth = 1920 - margin * 2 - gap * (cols - 1);
    const width = totalWidth / cols;
    const rowHeight = 280;
    const elements = input.territories.map((t, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      return makeMetricCard(
        `${slideId}-ter-${i + 1}`,
        t.growth ? `${t.name} · ${t.growth}` : t.name,
        t.revenue,
        {
          x: margin + col * (width + gap),
          y: 240 + row * (rowHeight + gap),
          width,
          height: rowHeight,
        },
      );
    });
    insertSlide(ctx, makeSlide(slideId, input.title, elements));
    return { ok: true, slideId, position };
  },
};

// ---------------------------------------------------------------------------
// 9 — create_close_rate_callout
// ---------------------------------------------------------------------------

const closeRateInput = z
  .object({
    title,
    closeRate: z.number().min(0).max(1),
    benchmark: z.number().min(0).max(1).optional(),
    subtitle: z.string().max(200).optional(),
  })
  .strict();

export const createCloseRateCallout: ToolHandler<
  z.infer<typeof closeRateInput>,
  z.infer<typeof slideCreatedOutput>,
  MutationContext
> = {
  name: 'create_close_rate_callout',
  bundle: BUNDLE,
  description:
    'Sales: hero close-rate slide. `closeRate` is 0..1 and renders as a large percentage. Optional `benchmark` renders as a small comparison below.',
  inputSchema: closeRateInput,
  outputSchema: slideCreatedOutput,
  handle: (input, ctx) => {
    if (ensureSlide(ctx) === 'wrong_mode') return wrongModeFail();
    const position = currentCount(ctx);
    const slideId = nextSlideId(ctx.document);
    const pct = Math.round(input.closeRate * 100);
    const hero = makeHeroNumber(`${slideId}-hero`, `${pct}%`);
    const elements: unknown[] = [hero];
    if (input.benchmark !== undefined) {
      elements.push(
        makeBodyText(`${slideId}-bench`, `Benchmark: ${Math.round(input.benchmark * 100)}%`, {
          x: 200,
          y: 640,
          width: 1520,
          height: 60,
        }),
      );
    }
    if (input.subtitle) {
      elements.push(
        makeBodyText(`${slideId}-sub`, input.subtitle, {
          x: 200,
          y: 720,
          width: 1520,
          height: 80,
        }),
      );
    }
    insertSlide(ctx, makeSlide(slideId, input.title, elements));
    return { ok: true, slideId, position };
  },
};

// Suppress unused-import warnings on builder helpers we don't reach for here.
void makeShape;

export const SALES_HANDLERS: ReadonlyArray<ToolHandler<unknown, unknown, MutationContext>> = [
  createPipelineFunnelSlide,
  createQuotaAttainmentSlide,
  createWinLossBreakdown,
  createPipelineCoverageCallout,
  createTopOpportunitiesSlide,
  createRepLeaderboardSlide,
  createSalesCycleSlide,
  createTerritorySummarySlide,
  createCloseRateCallout,
] as unknown as ReadonlyArray<ToolHandler<unknown, unknown, MutationContext>>;

export const SALES_TOOL_DEFINITIONS: ReadonlyArray<LLMToolDefinition> = [
  {
    name: 'create_pipeline_funnel_slide',
    description: createPipelineFunnelSlide.description,
    input_schema: {
      type: 'object',
      required: ['title', 'stages'],
      additionalProperties: false,
      properties: {
        title: strNonEmpty,
        stages: {
          type: 'array',
          minItems: 2,
          maxItems: 8,
          items: {
            type: 'object',
            required: ['name', 'count'],
            additionalProperties: false,
            properties: {
              name: strNonEmpty,
              count: { type: 'integer', minimum: 0 },
            },
          },
        },
      },
    },
  },
  {
    name: 'create_quota_attainment_slide',
    description: createQuotaAttainmentSlide.description,
    input_schema: {
      type: 'object',
      required: ['title', 'team'],
      additionalProperties: false,
      properties: {
        title: strNonEmpty,
        team: {
          type: 'array',
          minItems: 1,
          maxItems: 12,
          items: {
            type: 'object',
            required: ['rep', 'attained'],
            additionalProperties: false,
            properties: {
              rep: strNonEmpty,
              attained: { type: 'number', minimum: 0, maximum: 2 },
            },
          },
        },
      },
    },
  },
  {
    name: 'create_win_loss_breakdown',
    description: createWinLossBreakdown.description,
    input_schema: {
      type: 'object',
      required: ['title', 'won', 'lost'],
      additionalProperties: false,
      properties: {
        title: strNonEmpty,
        won: { type: 'integer', minimum: 0 },
        lost: { type: 'integer', minimum: 0 },
        reasons: {
          type: 'array',
          maxItems: 6,
          items: {
            type: 'object',
            required: ['reason', 'count'],
            additionalProperties: false,
            properties: { reason: strNonEmpty, count: { type: 'integer', minimum: 0 } },
          },
        },
      },
    },
  },
  {
    name: 'create_pipeline_coverage_callout',
    description: createPipelineCoverageCallout.description,
    input_schema: {
      type: 'object',
      required: ['title', 'coverageMultiple'],
      additionalProperties: false,
      properties: {
        title: strNonEmpty,
        coverageMultiple: { type: 'number', exclusiveMinimum: 0 },
        quota: str,
      },
    },
  },
  {
    name: 'create_top_opportunities_slide',
    description: createTopOpportunitiesSlide.description,
    input_schema: {
      type: 'object',
      required: ['title', 'opportunities'],
      additionalProperties: false,
      properties: {
        title: strNonEmpty,
        opportunities: {
          type: 'array',
          minItems: 1,
          maxItems: 6,
          items: {
            type: 'object',
            required: ['account', 'amount'],
            additionalProperties: false,
            properties: {
              account: strNonEmpty,
              amount: strNonEmpty,
              stage: str,
            },
          },
        },
      },
    },
  },
  {
    name: 'create_rep_leaderboard_slide',
    description: createRepLeaderboardSlide.description,
    input_schema: {
      type: 'object',
      required: ['title', 'rows'],
      additionalProperties: false,
      properties: {
        title: strNonEmpty,
        rows: {
          type: 'array',
          minItems: 1,
          maxItems: 12,
          items: {
            type: 'object',
            required: ['rep', 'value'],
            additionalProperties: false,
            properties: { rep: strNonEmpty, value: strNonEmpty },
          },
        },
      },
    },
  },
  {
    name: 'create_sales_cycle_slide',
    description: createSalesCycleSlide.description,
    input_schema: {
      type: 'object',
      required: ['title', 'stages'],
      additionalProperties: false,
      properties: {
        title: strNonEmpty,
        stages: {
          type: 'array',
          minItems: 2,
          maxItems: 8,
          items: {
            type: 'object',
            required: ['name', 'avgDays'],
            additionalProperties: false,
            properties: {
              name: strNonEmpty,
              avgDays: { type: 'number', minimum: 0 },
            },
          },
        },
      },
    },
  },
  {
    name: 'create_territory_summary_slide',
    description: createTerritorySummarySlide.description,
    input_schema: {
      type: 'object',
      required: ['title', 'territories'],
      additionalProperties: false,
      properties: {
        title: strNonEmpty,
        territories: {
          type: 'array',
          minItems: 1,
          maxItems: 8,
          items: {
            type: 'object',
            required: ['name', 'revenue'],
            additionalProperties: false,
            properties: {
              name: strNonEmpty,
              revenue: strNonEmpty,
              growth: str,
            },
          },
        },
      },
    },
  },
  {
    name: 'create_close_rate_callout',
    description: createCloseRateCallout.description,
    input_schema: {
      type: 'object',
      required: ['title', 'closeRate'],
      additionalProperties: false,
      properties: {
        title: strNonEmpty,
        closeRate: { type: 'number', minimum: 0, maximum: 1 },
        benchmark: { type: 'number', minimum: 0, maximum: 1 },
        subtitle: str,
      },
    },
  },
];
