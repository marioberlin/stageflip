// packages/engine/src/handlers/video-mode/handlers.ts
// `video-mode` bundle — video-profile-specific agent tools. Currently ships
// one tool: `bounce_to_aspect_ratios`, which plans the multi-aspect export
// fan-out (T-185). T-186 reads the variants this tool produces and renders
// each one in parallel.
//
// Handlers live outside the determinism-restricted scope — they run at
// planner/authoring time, not at clip render time.

import type { LLMToolDefinition } from '@stageflip/llm-abstraction';
import { z } from 'zod';

import type { DocumentContext, ToolHandler } from '../../router/types.js';

export const VIDEO_MODE_BUNDLE_NAME = 'video-mode';

// ---------------------------------------------------------------------------
// Aspect-ratio math — shared by schema + tool output.
// ---------------------------------------------------------------------------

const presetAspectSchema = z.enum(['16:9', '9:16', '1:1', '4:5', '21:9']);
const customAspectSchema = z
  .object({
    kind: z.literal('custom'),
    w: z.number().int().positive(),
    h: z.number().int().positive(),
  })
  .strict();
const aspectRatioSchema = z.union([presetAspectSchema, customAspectSchema]);

type AspectRatioInput = z.infer<typeof aspectRatioSchema>;

interface Ratio {
  readonly w: number;
  readonly h: number;
}

function resolveRatio(aspect: AspectRatioInput): Ratio {
  if (typeof aspect === 'string') {
    const [wStr, hStr] = aspect.split(':');
    const w = Number(wStr);
    const h = Number(hStr);
    return { w, h };
  }
  return { w: aspect.w, h: aspect.h };
}

function aspectToLabel(aspect: AspectRatioInput): string {
  if (typeof aspect === 'string') return aspect;
  return `custom:${aspect.w}x${aspect.h}`;
}

/**
 * Given an aspect ratio and a basis pixel dimension (the shorter side),
 * produce an even-numbered w×h canvas suitable for a video codec. `basisPx`
 * applies to whichever axis is shorter; the longer axis is derived to
 * preserve the aspect. Result is always even on both axes.
 */
function aspectRatioToCanvas(aspect: AspectRatioInput, basisPx: number): Ratio {
  const ratio = resolveRatio(aspect);
  if (ratio.w <= 0 || ratio.h <= 0) return { w: 0, h: 0 };
  let width: number;
  let height: number;
  if (ratio.w >= ratio.h) {
    height = basisPx;
    width = Math.round((basisPx * ratio.w) / ratio.h);
  } else {
    width = basisPx;
    height = Math.round((basisPx * ratio.h) / ratio.w);
  }
  // Codecs need even dimensions; round up when odd.
  if (width % 2 !== 0) width += 1;
  if (height % 2 !== 0) height += 1;
  return { w: width, h: height };
}

// ---------------------------------------------------------------------------
// bounce_to_aspect_ratios
// ---------------------------------------------------------------------------

const DEFAULT_BASIS_PX = 1080;
const MIN_BASIS_PX = 360;
const MAX_BASIS_PX = 4320;

const bounceInputSchema = z
  .object({
    targets: z.array(aspectRatioSchema).min(1),
    basisPx: z.number().int().positive().optional(),
  })
  .strict();

const bounceVariantSchema = z
  .object({
    aspectRatio: aspectRatioSchema,
    label: z.string(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })
  .strict();

const bounceOutputSchema = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      basisPx: z.number().int().positive(),
      variants: z.array(bounceVariantSchema).min(1),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['wrong_mode', 'basis_out_of_range']),
    })
    .strict(),
]);

const bounceHandler: ToolHandler<
  z.infer<typeof bounceInputSchema>,
  z.infer<typeof bounceOutputSchema>,
  DocumentContext
> = {
  name: 'bounce_to_aspect_ratios',
  bundle: VIDEO_MODE_BUNDLE_NAME,
  description:
    'Plan the multi-aspect export fan-out for a video document. Returns one variant per target aspect ratio with the even-dimension canvas size the renderer should use. Does not mutate the document; T-186 consumes this output to run per-aspect renders in parallel.',
  inputSchema: bounceInputSchema,
  outputSchema: bounceOutputSchema,
  handle: (input, ctx) => {
    if (ctx.document.content.mode !== 'video') {
      return { ok: false, reason: 'wrong_mode' as const };
    }
    const basisPx = input.basisPx ?? DEFAULT_BASIS_PX;
    if (basisPx < MIN_BASIS_PX || basisPx > MAX_BASIS_PX) {
      return { ok: false, reason: 'basis_out_of_range' as const };
    }
    const variants = input.targets.map((aspect) => {
      const canvas = aspectRatioToCanvas(aspect, basisPx);
      return {
        aspectRatio: aspect,
        label: aspectToLabel(aspect),
        width: canvas.w,
        height: canvas.h,
      };
    });
    return { ok: true, basisPx, variants };
  },
};

// ---------------------------------------------------------------------------
// barrel
// ---------------------------------------------------------------------------

export const VIDEO_MODE_HANDLERS: readonly ToolHandler<unknown, unknown, DocumentContext>[] = [
  bounceHandler,
] as unknown as readonly ToolHandler<unknown, unknown, DocumentContext>[];

export const VIDEO_MODE_TOOL_DEFINITIONS: readonly LLMToolDefinition[] = [
  {
    name: 'bounce_to_aspect_ratios',
    description: bounceHandler.description,
    input_schema: {
      type: 'object',
      required: ['targets'],
      additionalProperties: false,
      properties: {
        targets: {
          type: 'array',
          minItems: 1,
          description:
            'Aspect ratios to plan renders for. Each entry is either a preset string (16:9, 9:16, 1:1, 4:5, 21:9) or a custom object { kind: "custom", w, h }.',
          items: {
            oneOf: [
              { type: 'string', enum: ['16:9', '9:16', '1:1', '4:5', '21:9'] },
              {
                type: 'object',
                required: ['kind', 'w', 'h'],
                additionalProperties: false,
                properties: {
                  kind: { type: 'string', enum: ['custom'] },
                  w: { type: 'integer', minimum: 1 },
                  h: { type: 'integer', minimum: 1 },
                },
              },
            ],
          },
        },
        basisPx: {
          type: 'integer',
          minimum: MIN_BASIS_PX,
          maximum: MAX_BASIS_PX,
          description: `Short-axis pixel basis. Default ${DEFAULT_BASIS_PX}. The longer axis is derived to preserve the aspect; both axes are rounded up to even for codec compatibility.`,
        },
      },
    },
  },
];
