// packages/engine/src/handlers/display-mode/handlers.ts
// `display-mode` bundle — display-profile-specific agent tools.
//
// - `optimize_for_file_size`: plan which pre-pack optimisation passes to
//   enable for a given target budget. Returns a recommendation list the
//   UI + Executor can feed into `@stageflip/export-html5-zip`'s
//   `optimizeHtmlBundle`. Planner tool — does not mutate the document.
//
// - `preview_at_sizes`: resolve the set of canonical banner sizes to
//   preview. Returns per-size specs (dimensions + duration) the editor
//   grid (T-201) + the display-mode preview pane (T-207) consume.
//
// Handlers live outside the determinism-restricted scope — they run at
// planner / authoring time, not at clip render time.

import type { LLMToolDefinition } from '@stageflip/llm-abstraction';
import { z } from 'zod';

import type { DocumentContext, ToolHandler } from '../../router/types.js';

export const DISPLAY_MODE_BUNDLE_NAME = 'display-mode';

// ---------------------------------------------------------------------------
// shared shapes
// ---------------------------------------------------------------------------

const bannerSizeShape = z
  .object({
    id: z.string().optional(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    name: z.string().optional(),
  })
  .strict();

type BannerSizeInput = z.infer<typeof bannerSizeShape>;

function sizeId(size: BannerSizeInput): string {
  return size.id ?? `${size.width}x${size.height}`;
}

// ---------------------------------------------------------------------------
// optimize_for_file_size
// ---------------------------------------------------------------------------

const IAB_DEFAULT_BUDGET_KB = 150;

const OPTIMIZE_PASS_NAMES = ['strip-unused-css', 'minify-js', 'optimize-images'] as const;
type OptimizePassName = (typeof OPTIMIZE_PASS_NAMES)[number];

/** Crude per-pass savings heuristic used for recommendation ordering. */
const PASS_ESTIMATED_KB: Record<OptimizePassName, number> = {
  'optimize-images': 40,
  'minify-js': 8,
  'strip-unused-css': 4,
};

const optimizeInputSchema = z
  .object({
    targetKb: z
      .number()
      .int()
      .positive()
      .max(10 * 1024)
      .optional(),
    passes: z.array(z.enum(OPTIMIZE_PASS_NAMES)).optional(),
  })
  .strict();

const optimizeRecommendationSchema = z
  .object({
    pass: z.enum(OPTIMIZE_PASS_NAMES),
    enabled: z.boolean(),
    estimatedSavingKb: z.number().int().nonnegative(),
  })
  .strict();

const optimizeOutputSchema = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      targetKb: z.number().int().positive(),
      budgetSourceKb: z.number().int().positive(),
      recommendations: z.array(optimizeRecommendationSchema),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['wrong_mode']),
    })
    .strict(),
]);

const optimizeHandler: ToolHandler<
  z.infer<typeof optimizeInputSchema>,
  z.infer<typeof optimizeOutputSchema>,
  DocumentContext
> = {
  name: 'optimize_for_file_size',
  bundle: DISPLAY_MODE_BUNDLE_NAME,
  description:
    'Plan which pre-pack optimisation passes (unused-CSS strip, JS minify, image optimizer) to enable for a display banner given a target ZIP size in KB. Returns a recommendation list ordered by expected savings. Does not mutate the document; the Executor threads the recommendations into @stageflip/export-html5-zip optimizeHtmlBundle.',
  inputSchema: optimizeInputSchema,
  outputSchema: optimizeOutputSchema,
  handle: (input, ctx) => {
    if (ctx.document.content.mode !== 'display') {
      return { ok: false, reason: 'wrong_mode' as const };
    }
    const docBudgetKb =
      (ctx.document.content as { budget?: { totalZipKb?: number } }).budget?.totalZipKb ??
      IAB_DEFAULT_BUDGET_KB;
    const targetKb = input.targetKb ?? docBudgetKb;
    const enabledPasses: ReadonlySet<OptimizePassName> = new Set(
      input.passes ?? OPTIMIZE_PASS_NAMES,
    );
    const recommendations = [...OPTIMIZE_PASS_NAMES]
      .map((pass) => ({
        pass,
        enabled: enabledPasses.has(pass),
        estimatedSavingKb: PASS_ESTIMATED_KB[pass],
      }))
      .sort((a, b) => b.estimatedSavingKb - a.estimatedSavingKb);
    return {
      ok: true,
      targetKb,
      budgetSourceKb: docBudgetKb,
      recommendations,
    };
  },
};

// ---------------------------------------------------------------------------
// preview_at_sizes
// ---------------------------------------------------------------------------

const previewInputSchema = z
  .object({
    sizes: z.array(bannerSizeShape).min(1).max(10).optional(),
  })
  .strict();

const previewSpecSchema = z
  .object({
    sizeId: z.string(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    durationMs: z.number().int().positive(),
  })
  .strict();

const previewOutputSchema = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      previews: z.array(previewSpecSchema).min(1),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['wrong_mode', 'no_sizes_available']),
    })
    .strict(),
]);

const previewHandler: ToolHandler<
  z.infer<typeof previewInputSchema>,
  z.infer<typeof previewOutputSchema>,
  DocumentContext
> = {
  name: 'preview_at_sizes',
  bundle: DISPLAY_MODE_BUNDLE_NAME,
  description:
    'Resolve per-size preview specs for a display banner. If sizes are not supplied, reads DisplayContent.sizes from the document. Returns { sizeId, width, height, durationMs } per size — consumed by the editor multi-size canvas grid and the display-mode preview pane.',
  inputSchema: previewInputSchema,
  outputSchema: previewOutputSchema,
  handle: (input, ctx) => {
    if (ctx.document.content.mode !== 'display') {
      return { ok: false, reason: 'wrong_mode' as const };
    }
    const content = ctx.document.content as {
      sizes?: ReadonlyArray<BannerSizeInput>;
      durationMs?: number;
    };
    const sizes = input.sizes ?? content.sizes ?? [];
    if (sizes.length === 0) {
      return { ok: false, reason: 'no_sizes_available' as const };
    }
    const durationMs = content.durationMs ?? 15_000;
    const previews = sizes.map((size) => ({
      sizeId: sizeId(size),
      width: size.width,
      height: size.height,
      durationMs,
    }));
    return { ok: true, previews };
  },
};

// ---------------------------------------------------------------------------
// barrel
// ---------------------------------------------------------------------------

export const DISPLAY_MODE_HANDLERS: readonly ToolHandler<unknown, unknown, DocumentContext>[] = [
  optimizeHandler,
  previewHandler,
] as unknown as readonly ToolHandler<unknown, unknown, DocumentContext>[];

export const DISPLAY_MODE_TOOL_DEFINITIONS: readonly LLMToolDefinition[] = [
  {
    name: 'optimize_for_file_size',
    description: optimizeHandler.description,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        targetKb: {
          type: 'integer',
          minimum: 1,
          maximum: 10 * 1024,
          description:
            'Optional target total-ZIP size in KB. Defaults to DisplayContent.budget.totalZipKb, then to the IAB baseline of 150 KB when neither is set.',
        },
        passes: {
          type: 'array',
          minItems: 1,
          description:
            'Optional subset of passes to enable. Defaults to every pass. Use to disable a pass the caller wants to run separately.',
          items: {
            type: 'string',
            enum: [...OPTIMIZE_PASS_NAMES],
          },
        },
      },
    },
  },
  {
    name: 'preview_at_sizes',
    description: previewHandler.description,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        sizes: {
          type: 'array',
          minItems: 1,
          maxItems: 10,
          description:
            'Optional list of banner sizes to preview. Defaults to DisplayContent.sizes from the document.',
          items: {
            type: 'object',
            required: ['width', 'height'],
            additionalProperties: false,
            properties: {
              id: { type: 'string' },
              width: { type: 'integer', minimum: 1 },
              height: { type: 'integer', minimum: 1 },
              name: { type: 'string' },
            },
          },
        },
      },
    },
  },
];
