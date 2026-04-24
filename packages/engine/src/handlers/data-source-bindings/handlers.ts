// packages/engine/src/handlers/data-source-bindings/handlers.ts
// `data-source-bindings` bundle — 2 tools for swapping a chart
// element's `data` field between inline `ChartData` and a
// `dataSourceRefSchema` reference (`ds:<id>`). Actual data-source
// resolution (CSV / Sheets / GraphQL) happens downstream at render
// time; this bundle only rewrites the document's binding.

import type { LLMToolDefinition } from '@stageflip/llm-abstraction';
import { chartDataSchema, dataSourceRefSchema } from '@stageflip/schema';
import { z } from 'zod';
import type { MutationContext, ToolHandler } from '../../router/types.js';

export const DATA_SOURCE_BINDINGS_BUNDLE_NAME = 'data-source-bindings';

type LocateFail = 'wrong_mode' | 'slide_not_found' | 'element_not_found' | 'wrong_element_type';

interface ChartLocation {
  slideIndex: number;
  elementIndex: number;
  element: {
    id: string;
    type: string;
    data: unknown;
  };
}

function locateChart(
  ctx: MutationContext,
  slideId: string,
  elementId: string,
): ChartLocation | LocateFail {
  if (ctx.document.content.mode !== 'slide') return 'wrong_mode';
  const slideIndex = ctx.document.content.slides.findIndex((s) => s.id === slideId);
  if (slideIndex === -1) return 'slide_not_found';
  const slide = ctx.document.content.slides[slideIndex];
  if (!slide) return 'slide_not_found';
  const elementIndex = slide.elements.findIndex((e) => e.id === elementId);
  if (elementIndex === -1) return 'element_not_found';
  const element = slide.elements[elementIndex] as unknown as {
    id: string;
    type: string;
    data: unknown;
  };
  if (!element) return 'element_not_found';
  if (element.type !== 'chart') return 'wrong_element_type';
  return { slideIndex, elementIndex, element };
}

function chartPath(loc: ChartLocation): string {
  return `/content/slides/${loc.slideIndex}/elements/${loc.elementIndex}/data`;
}

// ---------------------------------------------------------------------------
// 1 — bind_chart_to_data_source
// ---------------------------------------------------------------------------

const bindInput = z
  .object({
    slideId: z.string().min(1),
    elementId: z.string().min(1),
    dataSourceRef: dataSourceRefSchema,
  })
  .strict();
const bindOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      elementId: z.string(),
      previousKind: z.enum(['inline', 'reference']),
      dataSourceRef: z.string(),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['wrong_mode', 'slide_not_found', 'element_not_found', 'wrong_element_type']),
    })
    .strict(),
]);

const bindChartToDataSource: ToolHandler<
  z.infer<typeof bindInput>,
  z.infer<typeof bindOutput>,
  MutationContext
> = {
  name: 'bind_chart_to_data_source',
  bundle: DATA_SOURCE_BINDINGS_BUNDLE_NAME,
  description:
    "Swap a chart element's `data` field to a `ds:<id>` reference. Replaces whatever was there (inline `ChartData` or another reference). Reports `previousKind: 'inline' | 'reference'` so the caller knows what they overwrote. Ref format is enforced by `dataSourceRefSchema` (lowercase alphanumerics + underscores / dashes).",
  inputSchema: bindInput,
  outputSchema: bindOutput,
  handle: (input, ctx) => {
    const loc = locateChart(ctx, input.slideId, input.elementId);
    if (typeof loc === 'string') return { ok: false, reason: loc };
    const currentIsRef = typeof loc.element.data === 'string' && loc.element.data.startsWith('ds:');
    ctx.patchSink.push({
      op: 'replace',
      path: chartPath(loc),
      value: input.dataSourceRef,
    });
    return {
      ok: true,
      elementId: input.elementId,
      previousKind: currentIsRef ? 'reference' : 'inline',
      dataSourceRef: input.dataSourceRef,
    };
  },
};

// ---------------------------------------------------------------------------
// 2 — unbind_chart_data_source
// ---------------------------------------------------------------------------

const unbindInput = z
  .object({
    slideId: z.string().min(1),
    elementId: z.string().min(1),
    replacement: chartDataSchema,
  })
  .strict();
const unbindOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      elementId: z.string(),
      previousRef: z.string(),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum([
        'wrong_mode',
        'slide_not_found',
        'element_not_found',
        'wrong_element_type',
        'not_bound',
      ]),
      detail: z.string().optional(),
    })
    .strict(),
]);

type UnbindInput = z.infer<typeof unbindInput>;
type UnbindOutput = z.infer<typeof unbindOutput>;

const unbindChartDataSource: ToolHandler<UnbindInput, UnbindOutput, MutationContext> = {
  name: 'unbind_chart_data_source',
  bundle: DATA_SOURCE_BINDINGS_BUNDLE_NAME,
  description:
    "Replace a chart element's `ds:` reference with inline `ChartData` (`{ labels, series }`). Refuses `not_bound` if the chart's `data` isn't currently a `ds:<id>` reference. `replacement` is Zod-validated against the chart data schema.",
  inputSchema: unbindInput as unknown as z.ZodType<UnbindInput>,
  outputSchema: unbindOutput,
  handle: (input, ctx) => {
    const loc = locateChart(ctx, input.slideId, input.elementId);
    if (typeof loc === 'string') return { ok: false, reason: loc };
    if (typeof loc.element.data !== 'string' || !loc.element.data.startsWith('ds:')) {
      return {
        ok: false,
        reason: 'not_bound',
        detail: 'chart data is not a ds:<id> reference',
      };
    }
    const previousRef = loc.element.data;
    ctx.patchSink.push({
      op: 'replace',
      path: chartPath(loc),
      value: input.replacement,
    });
    return { ok: true, elementId: input.elementId, previousRef };
  },
};

// ---------------------------------------------------------------------------
// Barrel
// ---------------------------------------------------------------------------

export const DATA_SOURCE_BINDINGS_HANDLERS: readonly ToolHandler<
  unknown,
  unknown,
  MutationContext
>[] = [bindChartToDataSource, unbindChartDataSource] as unknown as readonly ToolHandler<
  unknown,
  unknown,
  MutationContext
>[];

const nonEmptyString = { type: 'string' as const, minLength: 1 };

export const DATA_SOURCE_BINDINGS_TOOL_DEFINITIONS: readonly LLMToolDefinition[] = [
  {
    name: 'bind_chart_to_data_source',
    description: bindChartToDataSource.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'elementId', 'dataSourceRef'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        elementId: nonEmptyString,
        dataSourceRef: {
          type: 'string',
          description: '`ds:<id>` reference — Zod-validated server-side.',
          pattern: '^ds:[A-Za-z0-9_-]+$',
        },
      },
    },
  },
  {
    name: 'unbind_chart_data_source',
    description: unbindChartDataSource.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'elementId', 'replacement'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        elementId: nonEmptyString,
        replacement: {
          type: 'object',
          description:
            'Inline chart data — `{ labels, series }` — Zod-validated against `chartDataSchema`.',
        },
      },
    },
  },
];
