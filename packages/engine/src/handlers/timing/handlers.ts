// packages/engine/src/handlers/timing/handlers.ts
// `timing` bundle — 4 write-tier tools for per-slide duration + transition
// controls. Slide-mode only. Handlers emit JSON-Patch ops via
// `ctx.patchSink`; the Executor drains + applies + re-reads between
// calls so chained timing adjustments converge.

import type { LLMToolDefinition } from '@stageflip/llm-abstraction';
import { z } from 'zod';
import type { MutationContext, ToolHandler } from '../../router/types.js';

export const TIMING_BUNDLE_NAME = 'timing';

const TRANSITION_KINDS = ['none', 'fade', 'slide-left', 'slide-right', 'zoom', 'push'] as const;

function findSlideIndex(ctx: MutationContext, slideId: string): number | null {
  if (ctx.document.content.mode !== 'slide') return null;
  const index = ctx.document.content.slides.findIndex((s) => s.id === slideId);
  return index === -1 ? null : index;
}

// --- set_slide_duration ---------------------------------------------------

const setSlideDurationInput = z
  .object({
    slideId: z.string().min(1),
    durationMs: z.number().int().positive(),
  })
  .strict();
const setSlideDurationOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      slideId: z.string(),
      durationMs: z.number().int().positive(),
    })
    .strict(),
  z.object({ ok: z.literal(false), reason: z.enum(['wrong_mode', 'not_found']) }).strict(),
]);

const setSlideDuration: ToolHandler<
  z.infer<typeof setSlideDurationInput>,
  z.infer<typeof setSlideDurationOutput>,
  MutationContext
> = {
  name: 'set_slide_duration',
  bundle: TIMING_BUNDLE_NAME,
  description:
    'Set a single slide\'s static duration in milliseconds. Must be a positive integer. Omit (use `clear_slide_duration`) for "advance on user click".',
  inputSchema: setSlideDurationInput,
  outputSchema: setSlideDurationOutput,
  handle: (input, ctx) => {
    if (ctx.document.content.mode !== 'slide') {
      return { ok: false, reason: 'wrong_mode' };
    }
    const index = findSlideIndex(ctx, input.slideId);
    if (index === null) return { ok: false, reason: 'not_found' };

    const slide = ctx.document.content.slides[index];
    const op = slide?.durationMs !== undefined ? 'replace' : 'add';
    ctx.patchSink.push({
      op,
      path: `/content/slides/${index}/durationMs`,
      value: input.durationMs,
    });
    return { ok: true, slideId: input.slideId, durationMs: input.durationMs };
  },
};

// --- clear_slide_duration -------------------------------------------------

const clearSlideDurationInput = z.object({ slideId: z.string().min(1) }).strict();
const clearSlideDurationOutput = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), slideId: z.string(), wasSet: z.boolean() }).strict(),
  z.object({ ok: z.literal(false), reason: z.enum(['wrong_mode', 'not_found']) }).strict(),
]);

const clearSlideDuration: ToolHandler<
  z.infer<typeof clearSlideDurationInput>,
  z.infer<typeof clearSlideDurationOutput>,
  MutationContext
> = {
  name: 'clear_slide_duration',
  bundle: TIMING_BUNDLE_NAME,
  description:
    'Remove a slide\'s `durationMs`, reverting it to "advance on user click". `wasSet: false` means the field was absent already; no patch emitted in that case.',
  inputSchema: clearSlideDurationInput,
  outputSchema: clearSlideDurationOutput,
  handle: (input, ctx) => {
    if (ctx.document.content.mode !== 'slide') {
      return { ok: false, reason: 'wrong_mode' };
    }
    const index = findSlideIndex(ctx, input.slideId);
    if (index === null) return { ok: false, reason: 'not_found' };
    const slide = ctx.document.content.slides[index];
    const wasSet = slide?.durationMs !== undefined;
    if (wasSet) {
      ctx.patchSink.push({
        op: 'remove',
        path: `/content/slides/${index}/durationMs`,
      });
    }
    return { ok: true, slideId: input.slideId, wasSet };
  },
};

// --- set_slide_transition -------------------------------------------------

const setSlideTransitionInput = z
  .object({
    slideId: z.string().min(1),
    kind: z.enum(TRANSITION_KINDS),
    durationMs: z.number().int().nonnegative().optional(),
  })
  .strict();
const setSlideTransitionOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      slideId: z.string(),
      kind: z.enum(TRANSITION_KINDS),
      durationMs: z.number().int().nonnegative(),
    })
    .strict(),
  z.object({ ok: z.literal(false), reason: z.enum(['wrong_mode', 'not_found']) }).strict(),
]);

const setSlideTransition: ToolHandler<
  z.infer<typeof setSlideTransitionInput>,
  z.infer<typeof setSlideTransitionOutput>,
  MutationContext
> = {
  name: 'set_slide_transition',
  bundle: TIMING_BUNDLE_NAME,
  description:
    "Set a slide's entrance transition. `kind` is one of `none` / `fade` / `slide-left` / `slide-right` / `zoom` / `push`. `durationMs` defaults to 400 when omitted (schema default).",
  inputSchema: setSlideTransitionInput,
  outputSchema: setSlideTransitionOutput,
  handle: (input, ctx) => {
    if (ctx.document.content.mode !== 'slide') {
      return { ok: false, reason: 'wrong_mode' };
    }
    const index = findSlideIndex(ctx, input.slideId);
    if (index === null) return { ok: false, reason: 'not_found' };
    const slide = ctx.document.content.slides[index];
    const durationMs = input.durationMs ?? 400;
    const op = slide?.transition !== undefined ? 'replace' : 'add';
    ctx.patchSink.push({
      op,
      path: `/content/slides/${index}/transition`,
      value: { kind: input.kind, durationMs },
    });
    return {
      ok: true,
      slideId: input.slideId,
      kind: input.kind,
      durationMs,
    };
  },
};

// --- clear_slide_transition -----------------------------------------------

const clearSlideTransitionInput = z.object({ slideId: z.string().min(1) }).strict();
const clearSlideTransitionOutput = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), slideId: z.string(), wasSet: z.boolean() }).strict(),
  z.object({ ok: z.literal(false), reason: z.enum(['wrong_mode', 'not_found']) }).strict(),
]);

const clearSlideTransition: ToolHandler<
  z.infer<typeof clearSlideTransitionInput>,
  z.infer<typeof clearSlideTransitionOutput>,
  MutationContext
> = {
  name: 'clear_slide_transition',
  bundle: TIMING_BUNDLE_NAME,
  description:
    "Remove a slide's entrance transition entirely. `wasSet: false` means the field was absent already; no patch emitted.",
  inputSchema: clearSlideTransitionInput,
  outputSchema: clearSlideTransitionOutput,
  handle: (input, ctx) => {
    if (ctx.document.content.mode !== 'slide') {
      return { ok: false, reason: 'wrong_mode' };
    }
    const index = findSlideIndex(ctx, input.slideId);
    if (index === null) return { ok: false, reason: 'not_found' };
    const slide = ctx.document.content.slides[index];
    const wasSet = slide?.transition !== undefined;
    if (wasSet) {
      ctx.patchSink.push({
        op: 'remove',
        path: `/content/slides/${index}/transition`,
      });
    }
    return { ok: true, slideId: input.slideId, wasSet };
  },
};

// --- barrel ---------------------------------------------------------------

export const TIMING_HANDLERS: readonly ToolHandler<unknown, unknown, MutationContext>[] = [
  setSlideDuration,
  clearSlideDuration,
  setSlideTransition,
  clearSlideTransition,
] as unknown as readonly ToolHandler<unknown, unknown, MutationContext>[];

const nonEmptyString = { type: 'string' as const, minLength: 1 };
const positiveInt = { type: 'integer' as const, minimum: 1 };
const nonNegInt = { type: 'integer' as const, minimum: 0 };

export const TIMING_TOOL_DEFINITIONS: readonly LLMToolDefinition[] = [
  {
    name: 'set_slide_duration',
    description: setSlideDuration.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'durationMs'],
      additionalProperties: false,
      properties: { slideId: nonEmptyString, durationMs: positiveInt },
    },
  },
  {
    name: 'clear_slide_duration',
    description: clearSlideDuration.description,
    input_schema: {
      type: 'object',
      required: ['slideId'],
      additionalProperties: false,
      properties: { slideId: nonEmptyString },
    },
  },
  {
    name: 'set_slide_transition',
    description: setSlideTransition.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'kind'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        kind: {
          type: 'string',
          enum: [...TRANSITION_KINDS],
        },
        durationMs: nonNegInt,
      },
    },
  },
  {
    name: 'clear_slide_transition',
    description: clearSlideTransition.description,
    input_schema: {
      type: 'object',
      required: ['slideId'],
      additionalProperties: false,
      properties: { slideId: nonEmptyString },
    },
  },
];
