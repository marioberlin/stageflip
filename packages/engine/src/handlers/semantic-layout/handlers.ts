// packages/engine/src/handlers/semantic-layout/handlers.ts
// `semantic-layout` bundle — 4 write-tier tools that reshape existing
// elements into conventional slide layouts: title-over-body, two-column
// split, horizontal KPI strip, centered hero. Slide-mode only.
//
// Each tool emits per-element `replace` ops on `.../transform`. The
// reference canvas is 1920×1080; margins default to 80 px. Unlike
// domain composites (T-166) which create new elements, these tools
// never add or remove elements — they only adjust transforms on
// elements the caller already placed on the slide.

import type { LLMToolDefinition } from '@stageflip/llm-abstraction';
import { z } from 'zod';
import type { MutationContext, ToolHandler } from '../../router/types.js';

export const SEMANTIC_LAYOUT_BUNDLE_NAME = 'semantic-layout';

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;
const MARGIN = 80;

type LocateFail = 'wrong_mode' | 'slide_not_found' | 'element_not_found';

interface SlideLocation {
  slideIndex: number;
  elementIndexById: Map<string, number>;
}

function locateSlide(
  ctx: MutationContext,
  slideId: string,
  requiredIds: readonly string[],
): SlideLocation | LocateFail {
  if (ctx.document.content.mode !== 'slide') return 'wrong_mode';
  const slideIndex = ctx.document.content.slides.findIndex((s) => s.id === slideId);
  if (slideIndex === -1) return 'slide_not_found';
  const slide = ctx.document.content.slides[slideIndex];
  if (!slide) return 'slide_not_found';
  const map = new Map<string, number>();
  slide.elements.forEach((e, i) => map.set(e.id, i));
  for (const id of requiredIds) {
    if (!map.has(id)) return 'element_not_found';
  }
  return { slideIndex, elementIndexById: map };
}

function transformPath(slideIndex: number, elementIndex: number): string {
  return `/content/slides/${slideIndex}/elements/${elementIndex}/transform`;
}

function transformValue(x: number, y: number, width: number, height: number) {
  return { x, y, width, height, rotation: 0, opacity: 1 };
}

// ---------------------------------------------------------------------------
// 1 — apply_title_body_layout
// ---------------------------------------------------------------------------

const titleBodyInput = z
  .object({
    slideId: z.string().min(1),
    titleElementId: z.string().min(1),
    bodyElementId: z.string().min(1),
    titleHeight: z.number().int().positive().optional(),
  })
  .strict();
const titleBodyOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      slideId: z.string(),
      titleHeight: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['wrong_mode', 'slide_not_found', 'element_not_found']),
      detail: z.string().optional(),
    })
    .strict(),
]);

const applyTitleBodyLayout: ToolHandler<
  z.infer<typeof titleBodyInput>,
  z.infer<typeof titleBodyOutput>,
  MutationContext
> = {
  name: 'apply_title_body_layout',
  bundle: SEMANTIC_LAYOUT_BUNDLE_NAME,
  description:
    "Reshape two existing elements into a title-over-body layout. Title gets `titleHeight` (default 160 px) at the top with standard margins; body fills the remaining vertical space. Emits one transform replace per element — doesn't touch `type`, content, or any field other than `transform`.",
  inputSchema: titleBodyInput,
  outputSchema: titleBodyOutput,
  handle: (input, ctx) => {
    const loc = locateSlide(ctx, input.slideId, [input.titleElementId, input.bodyElementId]);
    if (typeof loc === 'string') return { ok: false, reason: loc };
    const titleHeight = input.titleHeight ?? 160;
    const width = CANVAS_WIDTH - MARGIN * 2;
    const bodyY = MARGIN + titleHeight + 40;
    const bodyHeight = CANVAS_HEIGHT - bodyY - MARGIN;
    ctx.patchSink.push({
      op: 'replace',
      path: transformPath(loc.slideIndex, loc.elementIndexById.get(input.titleElementId) ?? -1),
      value: transformValue(MARGIN, MARGIN, width, titleHeight),
    });
    ctx.patchSink.push({
      op: 'replace',
      path: transformPath(loc.slideIndex, loc.elementIndexById.get(input.bodyElementId) ?? -1),
      value: transformValue(MARGIN, bodyY, width, bodyHeight),
    });
    return { ok: true, slideId: input.slideId, titleHeight };
  },
};

// ---------------------------------------------------------------------------
// 2 — apply_two_column_layout
// ---------------------------------------------------------------------------

const twoColumnInput = z
  .object({
    slideId: z.string().min(1),
    leftElementIds: z.array(z.string().min(1)).min(1),
    rightElementIds: z.array(z.string().min(1)).min(1),
    topY: z.number().int().nonnegative().optional(),
    gap: z.number().int().nonnegative().optional(),
  })
  .strict();
const twoColumnOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      slideId: z.string(),
      leftCount: z.number().int().positive(),
      rightCount: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['wrong_mode', 'slide_not_found', 'element_not_found']),
      detail: z.string().optional(),
    })
    .strict(),
]);

const applyTwoColumnLayout: ToolHandler<
  z.infer<typeof twoColumnInput>,
  z.infer<typeof twoColumnOutput>,
  MutationContext
> = {
  name: 'apply_two_column_layout',
  bundle: SEMANTIC_LAYOUT_BUNDLE_NAME,
  description:
    'Reshape existing elements into a two-column layout. `leftElementIds` become equal-height cards stacked in the left column; `rightElementIds` fill the right. `topY` defaults to 240 (leaving room for a title); `gap` is inter-row spacing (default 24 px).',
  inputSchema: twoColumnInput,
  outputSchema: twoColumnOutput,
  handle: (input, ctx) => {
    const ids = [...input.leftElementIds, ...input.rightElementIds];
    const loc = locateSlide(ctx, input.slideId, ids);
    if (typeof loc === 'string') return { ok: false, reason: loc };
    const located: SlideLocation = loc;
    const topY = input.topY ?? 240;
    const gap = input.gap ?? 24;
    const colGap = 48;
    const colWidth = (CANVAS_WIDTH - MARGIN * 2 - colGap) / 2;
    const availableHeight = CANVAS_HEIGHT - topY - MARGIN;
    const place = (colIds: readonly string[], xOffset: number): void => {
      const rowHeight = (availableHeight - gap * Math.max(0, colIds.length - 1)) / colIds.length;
      colIds.forEach((id, i) => {
        ctx.patchSink.push({
          op: 'replace',
          path: transformPath(located.slideIndex, located.elementIndexById.get(id) ?? -1),
          value: transformValue(xOffset, topY + i * (rowHeight + gap), colWidth, rowHeight),
        });
      });
    };
    place(input.leftElementIds, MARGIN);
    place(input.rightElementIds, MARGIN + colWidth + colGap);
    return {
      ok: true,
      slideId: input.slideId,
      leftCount: input.leftElementIds.length,
      rightCount: input.rightElementIds.length,
    };
  },
};

// ---------------------------------------------------------------------------
// 3 — apply_kpi_strip_layout
// ---------------------------------------------------------------------------

const kpiStripInput = z
  .object({
    slideId: z.string().min(1),
    elementIds: z.array(z.string().min(1)).min(1).max(6),
    y: z.number().int().nonnegative().optional(),
    height: z.number().int().positive().optional(),
  })
  .strict();
const kpiStripOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      slideId: z.string(),
      applied: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['wrong_mode', 'slide_not_found', 'element_not_found']),
      detail: z.string().optional(),
    })
    .strict(),
]);

const applyKpiStripLayout: ToolHandler<
  z.infer<typeof kpiStripInput>,
  z.infer<typeof kpiStripOutput>,
  MutationContext
> = {
  name: 'apply_kpi_strip_layout',
  bundle: SEMANTIC_LAYOUT_BUNDLE_NAME,
  description:
    'Reshape 1–6 existing elements into a horizontal equal-width KPI strip. `y` defaults to 280, `height` to 240. Perfect for quick retrofits of mis-aligned metric cards.',
  inputSchema: kpiStripInput,
  outputSchema: kpiStripOutput,
  handle: (input, ctx) => {
    const loc = locateSlide(ctx, input.slideId, input.elementIds);
    if (typeof loc === 'string') return { ok: false, reason: loc };
    const y = input.y ?? 280;
    const height = input.height ?? 240;
    const gap = 24;
    const count = input.elementIds.length;
    const totalWidth = CANVAS_WIDTH - MARGIN * 2 - gap * Math.max(0, count - 1);
    const width = totalWidth / count;
    input.elementIds.forEach((id, i) => {
      ctx.patchSink.push({
        op: 'replace',
        path: transformPath(loc.slideIndex, loc.elementIndexById.get(id) ?? -1),
        value: transformValue(MARGIN + i * (width + gap), y, width, height),
      });
    });
    return { ok: true, slideId: input.slideId, applied: count };
  },
};

// ---------------------------------------------------------------------------
// 4 — apply_centered_hero_layout
// ---------------------------------------------------------------------------

const heroInput = z
  .object({
    slideId: z.string().min(1),
    elementId: z.string().min(1),
    widthRatio: z.number().min(0.2).max(1).optional(),
    heightRatio: z.number().min(0.2).max(1).optional(),
  })
  .strict();
const heroOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      slideId: z.string(),
      elementId: z.string(),
      width: z.number(),
      height: z.number(),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['wrong_mode', 'slide_not_found', 'element_not_found']),
      detail: z.string().optional(),
    })
    .strict(),
]);

const applyCenteredHeroLayout: ToolHandler<
  z.infer<typeof heroInput>,
  z.infer<typeof heroOutput>,
  MutationContext
> = {
  name: 'apply_centered_hero_layout',
  bundle: SEMANTIC_LAYOUT_BUNDLE_NAME,
  description:
    'Reshape one element to a centered hero box. `widthRatio` / `heightRatio` are fractions of the canvas (default 0.75 / 0.5), so the default box is 1440×540 centered on the slide.',
  inputSchema: heroInput,
  outputSchema: heroOutput,
  handle: (input, ctx) => {
    const loc = locateSlide(ctx, input.slideId, [input.elementId]);
    if (typeof loc === 'string') return { ok: false, reason: loc };
    const wRatio = input.widthRatio ?? 0.75;
    const hRatio = input.heightRatio ?? 0.5;
    const width = Math.round(CANVAS_WIDTH * wRatio);
    const height = Math.round(CANVAS_HEIGHT * hRatio);
    const x = Math.round((CANVAS_WIDTH - width) / 2);
    const y = Math.round((CANVAS_HEIGHT - height) / 2);
    ctx.patchSink.push({
      op: 'replace',
      path: transformPath(loc.slideIndex, loc.elementIndexById.get(input.elementId) ?? -1),
      value: transformValue(x, y, width, height),
    });
    return { ok: true, slideId: input.slideId, elementId: input.elementId, width, height };
  },
};

// ---------------------------------------------------------------------------
// Barrel
// ---------------------------------------------------------------------------

export const SEMANTIC_LAYOUT_HANDLERS: readonly ToolHandler<unknown, unknown, MutationContext>[] = [
  applyTitleBodyLayout,
  applyTwoColumnLayout,
  applyKpiStripLayout,
  applyCenteredHeroLayout,
] as unknown as readonly ToolHandler<unknown, unknown, MutationContext>[];

const nonEmptyString = { type: 'string' as const, minLength: 1 };
const nonNegInt = { type: 'integer' as const, minimum: 0 };
const posInt = { type: 'integer' as const, minimum: 1 };

export const SEMANTIC_LAYOUT_TOOL_DEFINITIONS: readonly LLMToolDefinition[] = [
  {
    name: 'apply_title_body_layout',
    description: applyTitleBodyLayout.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'titleElementId', 'bodyElementId'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        titleElementId: nonEmptyString,
        bodyElementId: nonEmptyString,
        titleHeight: posInt,
      },
    },
  },
  {
    name: 'apply_two_column_layout',
    description: applyTwoColumnLayout.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'leftElementIds', 'rightElementIds'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        leftElementIds: { type: 'array', minItems: 1, items: nonEmptyString },
        rightElementIds: { type: 'array', minItems: 1, items: nonEmptyString },
        topY: nonNegInt,
        gap: nonNegInt,
      },
    },
  },
  {
    name: 'apply_kpi_strip_layout',
    description: applyKpiStripLayout.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'elementIds'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        elementIds: { type: 'array', minItems: 1, maxItems: 6, items: nonEmptyString },
        y: nonNegInt,
        height: posInt,
      },
    },
  },
  {
    name: 'apply_centered_hero_layout',
    description: applyCenteredHeroLayout.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'elementId'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        elementId: nonEmptyString,
        widthRatio: { type: 'number', minimum: 0.2, maximum: 1 },
        heightRatio: { type: 'number', minimum: 0.2, maximum: 1 },
      },
    },
  },
];
