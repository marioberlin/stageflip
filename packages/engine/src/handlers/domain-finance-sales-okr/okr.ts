// packages/engine/src/handlers/domain-finance-sales-okr/okr.ts
// 9 OKR-domain composite tools. Some mutate existing slides (progress
// updates on KR cards); most insert fresh slides.

import type { LLMToolDefinition } from '@stageflip/llm-abstraction';
import { z } from 'zod';
import type { MutationContext, ToolHandler } from '../../router/types.js';
import { nextSlideId } from '../create-mutate/ids.js';
import {
  currentCount,
  makeBodyText,
  makeHeroNumber,
  makeMetricCard,
  makeProgressBar,
  makeShape,
  makeSlide,
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
const statusEnum = z.enum(['on-track', 'at-risk', 'off-track']);

function statusAccent(status: 'on-track' | 'at-risk' | 'off-track'): string {
  switch (status) {
    case 'on-track':
      return '#22c55e';
    case 'at-risk':
      return '#f59e0b';
    case 'off-track':
      return '#ef4444';
  }
}

// ---------------------------------------------------------------------------
// 1 — create_okr_slide (objective + key results)
// ---------------------------------------------------------------------------

const okrInput = z
  .object({
    title,
    objective: z.string().min(1).max(400),
    keyResults: z
      .array(
        z
          .object({
            text: z.string().min(1).max(300),
            progress: z.number().min(0).max(1),
          })
          .strict(),
      )
      .min(1)
      .max(5),
  })
  .strict();

export const createOkrSlide: ToolHandler<
  z.infer<typeof okrInput>,
  z.infer<typeof slideCreatedOutput>,
  MutationContext
> = {
  name: 'create_okr_slide',
  bundle: BUNDLE,
  description: 'OKR: slide with one objective (as body text) and up to 5 key-result progress bars.',
  inputSchema: okrInput,
  outputSchema: slideCreatedOutput,
  handle: (input, ctx) => {
    if (ensureSlide(ctx) === 'wrong_mode') return wrongModeFail();
    const position = currentCount(ctx);
    const slideId = nextSlideId(ctx.document);
    const elements: unknown[] = [
      makeBodyText(`${slideId}-obj`, `Objective: ${input.objective}`, {
        x: 80,
        y: 200,
        width: 1760,
        height: 100,
      }),
    ];
    input.keyResults.forEach((kr, i) => {
      elements.push(
        makeProgressBar(`${slideId}-kr-${i + 1}`, kr.text, kr.progress, {
          x: 120,
          y: 360 + i * 120,
          width: 1680,
          height: 48,
        }),
      );
    });
    insertSlide(ctx, makeSlide(slideId, input.title, elements));
    return { ok: true, slideId, position };
  },
};

// ---------------------------------------------------------------------------
// 2 — create_okr_summary_slide (roll-up of multiple OKRs)
// ---------------------------------------------------------------------------

const summaryInput = z
  .object({
    title,
    quarter: z.string().min(1).max(40),
    okrs: z
      .array(
        z
          .object({
            objective: z.string().min(1).max(200),
            status: statusEnum,
            progress: z.number().min(0).max(1),
          })
          .strict(),
      )
      .min(1)
      .max(8),
  })
  .strict();

export const createOkrSummarySlide: ToolHandler<
  z.infer<typeof summaryInput>,
  z.infer<typeof slideCreatedOutput>,
  MutationContext
> = {
  name: 'create_okr_summary_slide',
  bundle: BUNDLE,
  description:
    'OKR: roll-up slide for a quarter. Each OKR becomes a metric-card with objective + status-tinted accent + progress %.',
  inputSchema: summaryInput,
  outputSchema: slideCreatedOutput,
  handle: (input, ctx) => {
    if (ensureSlide(ctx) === 'wrong_mode') return wrongModeFail();
    const position = currentCount(ctx);
    const slideId = nextSlideId(ctx.document);
    const elements: unknown[] = [
      makeBodyText(`${slideId}-quarter`, `Quarter: ${input.quarter}`, {
        x: 80,
        y: 200,
        width: 1760,
        height: 60,
      }),
    ];
    const rowHeight = 84;
    input.okrs.forEach((o, i) => {
      elements.push(
        makeMetricCard(
          `${slideId}-okr-${i + 1}`,
          `[${o.status}] ${o.objective}`,
          `${Math.round(o.progress * 100)}%`,
          { x: 120, y: 280 + i * (rowHeight + 8), width: 1680, height: rowHeight },
          statusAccent(o.status),
        ),
      );
    });
    insertSlide(ctx, makeSlide(slideId, input.title, elements));
    return { ok: true, slideId, position };
  },
};

// ---------------------------------------------------------------------------
// 3 — create_objective_hero_slide
// ---------------------------------------------------------------------------

const objHeroInput = z
  .object({
    title,
    objective: z.string().min(1).max(300),
    owner: z.string().max(120).optional(),
  })
  .strict();

export const createObjectiveHeroSlide: ToolHandler<
  z.infer<typeof objHeroInput>,
  z.infer<typeof slideCreatedOutput>,
  MutationContext
> = {
  name: 'create_objective_hero_slide',
  bundle: BUNDLE,
  description:
    'OKR: hero slide featuring a single objective statement, optional owner line. Use to open OKR deck sections.',
  inputSchema: objHeroInput,
  outputSchema: slideCreatedOutput,
  handle: (input, ctx) => {
    if (ensureSlide(ctx) === 'wrong_mode') return wrongModeFail();
    const position = currentCount(ctx);
    const slideId = nextSlideId(ctx.document);
    const hero = makeHeroNumber(`${slideId}-hero`, input.objective);
    const elements: unknown[] = [hero];
    if (input.owner) {
      elements.push(
        makeBodyText(`${slideId}-owner`, `Owner: ${input.owner}`, {
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
// 4 — create_okr_check_in_slide
// ---------------------------------------------------------------------------

const checkinInput = z
  .object({
    title,
    weekLabel: z.string().min(1).max(80),
    updates: z
      .array(
        z
          .object({
            okr: z.string().min(1).max(200),
            status: statusEnum,
            note: z.string().max(300).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(10),
  })
  .strict();

export const createOkrCheckInSlide: ToolHandler<
  z.infer<typeof checkinInput>,
  z.infer<typeof slideCreatedOutput>,
  MutationContext
> = {
  name: 'create_okr_check_in_slide',
  bundle: BUNDLE,
  description:
    'OKR: weekly check-in slide. Each update row is status-tinted with an optional note.',
  inputSchema: checkinInput,
  outputSchema: slideCreatedOutput,
  handle: (input, ctx) => {
    if (ensureSlide(ctx) === 'wrong_mode') return wrongModeFail();
    const position = currentCount(ctx);
    const slideId = nextSlideId(ctx.document);
    const elements: unknown[] = [
      makeBodyText(`${slideId}-week`, input.weekLabel, {
        x: 80,
        y: 200,
        width: 1760,
        height: 60,
      }),
    ];
    input.updates.forEach((u, i) => {
      elements.push(
        makeMetricCard(
          `${slideId}-up-${i + 1}`,
          u.note ? `[${u.status}] ${u.okr} — ${u.note}` : `[${u.status}] ${u.okr}`,
          '',
          { x: 120, y: 280 + i * 76, width: 1680, height: 64 },
          statusAccent(u.status),
        ),
      );
    });
    insertSlide(ctx, makeSlide(slideId, input.title, elements));
    return { ok: true, slideId, position };
  },
};

// ---------------------------------------------------------------------------
// 5 — create_okr_retro_slide
// ---------------------------------------------------------------------------

const retroInput = z
  .object({
    title,
    quarter: z.string().min(1).max(40),
    wins: z.array(z.string().min(1).max(200)).min(1).max(8),
    misses: z.array(z.string().min(1).max(200)).max(8).optional(),
  })
  .strict();

export const createOkrRetroSlide: ToolHandler<
  z.infer<typeof retroInput>,
  z.infer<typeof slideCreatedOutput>,
  MutationContext
> = {
  name: 'create_okr_retro_slide',
  bundle: BUNDLE,
  description:
    'OKR: two-column retrospective slide. Left column lists wins, right column lists misses.',
  inputSchema: retroInput,
  outputSchema: slideCreatedOutput,
  handle: (input, ctx) => {
    if (ensureSlide(ctx) === 'wrong_mode') return wrongModeFail();
    const position = currentCount(ctx);
    const slideId = nextSlideId(ctx.document);
    const elements: unknown[] = [
      makeBodyText(`${slideId}-q`, input.quarter, {
        x: 80,
        y: 200,
        width: 1760,
        height: 60,
      }),
      makeBodyText(`${slideId}-wh`, 'Wins', { x: 80, y: 280, width: 880, height: 60 }),
      ...(input.misses
        ? [
            makeBodyText(`${slideId}-mh`, 'Misses', {
              x: 960,
              y: 280,
              width: 880,
              height: 60,
            }),
          ]
        : []),
    ];
    input.wins.forEach((w, i) => {
      elements.push(
        makeBodyText(`${slideId}-win-${i + 1}`, `• ${w}`, {
          x: 80,
          y: 360 + i * 56,
          width: 880,
          height: 48,
        }),
      );
    });
    if (input.misses) {
      input.misses.forEach((m, i) => {
        elements.push(
          makeBodyText(`${slideId}-miss-${i + 1}`, `• ${m}`, {
            x: 960,
            y: 360 + i * 56,
            width: 880,
            height: 48,
          }),
        );
      });
    }
    insertSlide(ctx, makeSlide(slideId, input.title, elements));
    return { ok: true, slideId, position };
  },
};

// ---------------------------------------------------------------------------
// 6 — create_quarterly_roadmap_slide
// ---------------------------------------------------------------------------

const roadmapInput = z
  .object({
    title,
    quarters: z
      .array(
        z
          .object({
            label: z.string().min(1).max(40),
            items: z.array(z.string().min(1).max(100)).min(1).max(6),
          })
          .strict(),
      )
      .min(1)
      .max(4),
  })
  .strict();

export const createQuarterlyRoadmapSlide: ToolHandler<
  z.infer<typeof roadmapInput>,
  z.infer<typeof slideCreatedOutput>,
  MutationContext
> = {
  name: 'create_quarterly_roadmap_slide',
  bundle: BUNDLE,
  description:
    'OKR/strategy: 2–4 column quarterly roadmap. Each quarter column lists up to 6 bullet items.',
  inputSchema: roadmapInput,
  outputSchema: slideCreatedOutput,
  handle: (input, ctx) => {
    if (ensureSlide(ctx) === 'wrong_mode') return wrongModeFail();
    const position = currentCount(ctx);
    const slideId = nextSlideId(ctx.document);
    const cols = input.quarters.length;
    const margin = 80;
    const gap = 24;
    const totalWidth = 1920 - margin * 2 - gap * (cols - 1);
    const colWidth = totalWidth / cols;
    const elements: unknown[] = [];
    input.quarters.forEach((q, i) => {
      const x = margin + i * (colWidth + gap);
      elements.push(
        makeBodyText(`${slideId}-q-${i + 1}`, q.label, {
          x,
          y: 240,
          width: colWidth,
          height: 60,
        }),
      );
      q.items.forEach((item, j) => {
        elements.push(
          makeBodyText(`${slideId}-q-${i + 1}-i-${j + 1}`, `• ${item}`, {
            x,
            y: 320 + j * 60,
            width: colWidth,
            height: 52,
          }),
        );
      });
    });
    insertSlide(ctx, makeSlide(slideId, input.title, elements));
    return { ok: true, slideId, position };
  },
};

// ---------------------------------------------------------------------------
// 7 — create_key_result_scorecard_slide
// ---------------------------------------------------------------------------

const scoreInput = z
  .object({
    title,
    rows: z
      .array(
        z
          .object({
            keyResult: z.string().min(1).max(200),
            target: z.string().min(1).max(40),
            actual: z.string().min(1).max(40),
            status: statusEnum,
          })
          .strict(),
      )
      .min(1)
      .max(10),
  })
  .strict();

export const createKeyResultScorecardSlide: ToolHandler<
  z.infer<typeof scoreInput>,
  z.infer<typeof slideCreatedOutput>,
  MutationContext
> = {
  name: 'create_key_result_scorecard_slide',
  bundle: BUNDLE,
  description: 'OKR: scorecard slide listing KR target vs actual + a status accent per row.',
  inputSchema: scoreInput,
  outputSchema: slideCreatedOutput,
  handle: (input, ctx) => {
    if (ensureSlide(ctx) === 'wrong_mode') return wrongModeFail();
    const position = currentCount(ctx);
    const slideId = nextSlideId(ctx.document);
    const rowHeight = 64;
    const elements = input.rows.map((r, i) =>
      makeMetricCard(
        `${slideId}-row-${i + 1}`,
        `${r.keyResult} · target ${r.target}`,
        r.actual,
        { x: 120, y: 240 + i * (rowHeight + 8), width: 1680, height: rowHeight },
        statusAccent(r.status),
      ),
    );
    insertSlide(ctx, makeSlide(slideId, input.title, elements));
    return { ok: true, slideId, position };
  },
};

// ---------------------------------------------------------------------------
// 8 — create_okr_divider_slide
// ---------------------------------------------------------------------------

const dividerInput = z
  .object({
    heading: z.string().min(1).max(200),
    subhead: z.string().max(200).optional(),
  })
  .strict();

export const createOkrDividerSlide: ToolHandler<
  z.infer<typeof dividerInput>,
  z.infer<typeof slideCreatedOutput>,
  MutationContext
> = {
  name: 'create_okr_divider_slide',
  bundle: BUNDLE,
  description:
    'OKR: section-divider slide (big heading + optional subhead). Use between OKR-deck sections (Company → Team → Individual).',
  inputSchema: dividerInput,
  outputSchema: slideCreatedOutput,
  handle: (input, ctx) => {
    if (ensureSlide(ctx) === 'wrong_mode') return wrongModeFail();
    const position = currentCount(ctx);
    const slideId = nextSlideId(ctx.document);
    const elements: unknown[] = [makeHeroNumber(`${slideId}-head`, input.heading)];
    if (input.subhead) {
      elements.push(
        makeBodyText(`${slideId}-sub`, input.subhead, {
          x: 200,
          y: 640,
          width: 1520,
          height: 80,
        }),
      );
    }
    insertSlide(ctx, makeSlide(slideId, input.heading, elements));
    return { ok: true, slideId, position };
  },
};

// ---------------------------------------------------------------------------
// 9 — create_okr_grading_rubric_slide
// ---------------------------------------------------------------------------

const rubricInput = z
  .object({
    title,
    bands: z
      .array(
        z
          .object({
            range: z.string().min(1).max(40),
            label: z.string().min(1).max(60),
          })
          .strict(),
      )
      .min(2)
      .max(6),
  })
  .strict();

export const createOkrGradingRubricSlide: ToolHandler<
  z.infer<typeof rubricInput>,
  z.infer<typeof slideCreatedOutput>,
  MutationContext
> = {
  name: 'create_okr_grading_rubric_slide',
  bundle: BUNDLE,
  description:
    'OKR: grading-rubric reference slide (e.g. 0–0.3 miss / 0.4–0.6 ok / 0.7–1.0 good). Each band becomes a metric card.',
  inputSchema: rubricInput,
  outputSchema: slideCreatedOutput,
  handle: (input, ctx) => {
    if (ensureSlide(ctx) === 'wrong_mode') return wrongModeFail();
    const position = currentCount(ctx);
    const slideId = nextSlideId(ctx.document);
    const cols = input.bands.length;
    const margin = 80;
    const gap = 24;
    const totalWidth = 1920 - margin * 2 - gap * (cols - 1);
    const colWidth = totalWidth / cols;
    const elements = input.bands.map((b, i) =>
      makeMetricCard(`${slideId}-band-${i + 1}`, b.range, b.label, {
        x: margin + i * (colWidth + gap),
        y: 320,
        width: colWidth,
        height: 320,
      }),
    );
    insertSlide(ctx, makeSlide(slideId, input.title, elements));
    return { ok: true, slideId, position };
  },
};

void makeShape;

export const OKR_HANDLERS: ReadonlyArray<ToolHandler<unknown, unknown, MutationContext>> = [
  createOkrSlide,
  createOkrSummarySlide,
  createObjectiveHeroSlide,
  createOkrCheckInSlide,
  createOkrRetroSlide,
  createQuarterlyRoadmapSlide,
  createKeyResultScorecardSlide,
  createOkrDividerSlide,
  createOkrGradingRubricSlide,
] as unknown as ReadonlyArray<ToolHandler<unknown, unknown, MutationContext>>;

export const OKR_TOOL_DEFINITIONS: ReadonlyArray<LLMToolDefinition> = [
  {
    name: 'create_okr_slide',
    description: createOkrSlide.description,
    input_schema: {
      type: 'object',
      required: ['title', 'objective', 'keyResults'],
      additionalProperties: false,
      properties: {
        title: strNonEmpty,
        objective: strNonEmpty,
        keyResults: {
          type: 'array',
          minItems: 1,
          maxItems: 5,
          items: {
            type: 'object',
            required: ['text', 'progress'],
            additionalProperties: false,
            properties: {
              text: strNonEmpty,
              progress: { type: 'number', minimum: 0, maximum: 1 },
            },
          },
        },
      },
    },
  },
  {
    name: 'create_okr_summary_slide',
    description: createOkrSummarySlide.description,
    input_schema: {
      type: 'object',
      required: ['title', 'quarter', 'okrs'],
      additionalProperties: false,
      properties: {
        title: strNonEmpty,
        quarter: strNonEmpty,
        okrs: {
          type: 'array',
          minItems: 1,
          maxItems: 8,
          items: {
            type: 'object',
            required: ['objective', 'status', 'progress'],
            additionalProperties: false,
            properties: {
              objective: strNonEmpty,
              status: { type: 'string', enum: ['on-track', 'at-risk', 'off-track'] },
              progress: { type: 'number', minimum: 0, maximum: 1 },
            },
          },
        },
      },
    },
  },
  {
    name: 'create_objective_hero_slide',
    description: createObjectiveHeroSlide.description,
    input_schema: {
      type: 'object',
      required: ['title', 'objective'],
      additionalProperties: false,
      properties: {
        title: strNonEmpty,
        objective: strNonEmpty,
        owner: str,
      },
    },
  },
  {
    name: 'create_okr_check_in_slide',
    description: createOkrCheckInSlide.description,
    input_schema: {
      type: 'object',
      required: ['title', 'weekLabel', 'updates'],
      additionalProperties: false,
      properties: {
        title: strNonEmpty,
        weekLabel: strNonEmpty,
        updates: {
          type: 'array',
          minItems: 1,
          maxItems: 10,
          items: {
            type: 'object',
            required: ['okr', 'status'],
            additionalProperties: false,
            properties: {
              okr: strNonEmpty,
              status: { type: 'string', enum: ['on-track', 'at-risk', 'off-track'] },
              note: str,
            },
          },
        },
      },
    },
  },
  {
    name: 'create_okr_retro_slide',
    description: createOkrRetroSlide.description,
    input_schema: {
      type: 'object',
      required: ['title', 'quarter', 'wins'],
      additionalProperties: false,
      properties: {
        title: strNonEmpty,
        quarter: strNonEmpty,
        wins: { type: 'array', minItems: 1, maxItems: 8, items: strNonEmpty },
        misses: { type: 'array', maxItems: 8, items: strNonEmpty },
      },
    },
  },
  {
    name: 'create_quarterly_roadmap_slide',
    description: createQuarterlyRoadmapSlide.description,
    input_schema: {
      type: 'object',
      required: ['title', 'quarters'],
      additionalProperties: false,
      properties: {
        title: strNonEmpty,
        quarters: {
          type: 'array',
          minItems: 1,
          maxItems: 4,
          items: {
            type: 'object',
            required: ['label', 'items'],
            additionalProperties: false,
            properties: {
              label: strNonEmpty,
              items: { type: 'array', minItems: 1, maxItems: 6, items: strNonEmpty },
            },
          },
        },
      },
    },
  },
  {
    name: 'create_key_result_scorecard_slide',
    description: createKeyResultScorecardSlide.description,
    input_schema: {
      type: 'object',
      required: ['title', 'rows'],
      additionalProperties: false,
      properties: {
        title: strNonEmpty,
        rows: {
          type: 'array',
          minItems: 1,
          maxItems: 10,
          items: {
            type: 'object',
            required: ['keyResult', 'target', 'actual', 'status'],
            additionalProperties: false,
            properties: {
              keyResult: strNonEmpty,
              target: strNonEmpty,
              actual: strNonEmpty,
              status: { type: 'string', enum: ['on-track', 'at-risk', 'off-track'] },
            },
          },
        },
      },
    },
  },
  {
    name: 'create_okr_divider_slide',
    description: createOkrDividerSlide.description,
    input_schema: {
      type: 'object',
      required: ['heading'],
      additionalProperties: false,
      properties: {
        heading: strNonEmpty,
        subhead: str,
      },
    },
  },
  {
    name: 'create_okr_grading_rubric_slide',
    description: createOkrGradingRubricSlide.description,
    input_schema: {
      type: 'object',
      required: ['title', 'bands'],
      additionalProperties: false,
      properties: {
        title: strNonEmpty,
        bands: {
          type: 'array',
          minItems: 2,
          maxItems: 6,
          items: {
            type: 'object',
            required: ['range', 'label'],
            additionalProperties: false,
            properties: { range: strNonEmpty, label: strNonEmpty },
          },
        },
      },
    },
  },
];
