// packages/engine/src/handlers/element-cm1/handlers.ts
// `element-cm1` bundle — 12 write-tier tools for per-element content
// mutation: 4 text-element tools (content / runs / run-style / block-style),
// 6 per-type update tools (shape / image / video / audio / code / embed),
// and 1 common flags tool (visible / locked / name). Slide-mode only.
// Handlers type against `MutationContext`; mutations flow as JSON-Patch
// ops via `ctx.patchSink.push(op)`. Between tool calls the Executor
// drains + applies + re-reads, so chained element edits in one plan step
// see the previous mutation.
//
// Table element is intentionally excluded — T-163 (`table-cm1`) owns
// row/column/cell mutations. Common slide/element CRUD lives in
// T-156 (`create-mutate`); geometry lives in T-158 (`layout`).

import type { LLMToolDefinition } from '@stageflip/llm-abstraction';
import {
  assetRefSchema,
  codeLanguageSchema,
  colorValueSchema,
  shapeKindSchema,
  strokeSchema,
  textRunSchema,
  trimWindowSchema,
} from '@stageflip/schema';
import { z } from 'zod';
import type { MutationContext, ToolHandler } from '../../router/types.js';

export const ELEMENT_CM1_BUNDLE_NAME = 'element-cm1';

// ---------------------------------------------------------------------------
// Shared locators + helpers
// ---------------------------------------------------------------------------

type LocateFail = 'wrong_mode' | 'slide_not_found' | 'element_not_found';

interface ElementLocation {
  slideIndex: number;
  elementIndex: number;
  element: { id: string; type: string } & Record<string, unknown>;
}

function locateElement(
  ctx: MutationContext,
  slideId: string,
  elementId: string,
): ElementLocation | LocateFail {
  if (ctx.document.content.mode !== 'slide') return 'wrong_mode';
  const slideIndex = ctx.document.content.slides.findIndex((s) => s.id === slideId);
  if (slideIndex === -1) return 'slide_not_found';
  const slide = ctx.document.content.slides[slideIndex];
  if (!slide) return 'slide_not_found';
  const elementIndex = slide.elements.findIndex((e) => e.id === elementId);
  if (elementIndex === -1) return 'element_not_found';
  const element = slide.elements[elementIndex];
  if (!element) return 'element_not_found';
  return {
    slideIndex,
    elementIndex,
    element: element as unknown as ElementLocation['element'],
  };
}

function elementPath(loc: ElementLocation): string {
  return `/content/slides/${loc.slideIndex}/elements/${loc.elementIndex}`;
}

/** Reusable loop that emits `add` vs `replace` ops based on whether the field is present. */
function pushPartialUpdate(
  ctx: MutationContext,
  loc: ElementLocation,
  updates: Record<string, unknown>,
  order: readonly string[],
): string[] {
  const updatedFields: string[] = [];
  for (const field of order) {
    const value = updates[field];
    if (value === undefined) continue;
    updatedFields.push(field);
    const op = field in loc.element ? 'replace' : 'add';
    ctx.patchSink.push({
      op,
      path: `${elementPath(loc)}/${field}`,
      value,
    });
  }
  return updatedFields;
}

// ---------------------------------------------------------------------------
// 1 — set_text_content
// ---------------------------------------------------------------------------

const setTextContentInput = z
  .object({
    slideId: z.string().min(1),
    elementId: z.string().min(1),
    text: z.string().optional(),
    runs: z.array(textRunSchema).optional(),
  })
  .strict()
  .refine((v) => v.text !== undefined || v.runs !== undefined, {
    message: 'one of `text` or `runs` must be provided',
  });
const setTextContentOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      elementId: z.string(),
      updatedFields: z.array(z.string()),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['wrong_mode', 'slide_not_found', 'element_not_found', 'wrong_element_type']),
      detail: z.string().optional(),
    })
    .strict(),
]);

type SetTextContentInput = z.infer<typeof setTextContentInput>;
type SetTextContentOutput = z.infer<typeof setTextContentOutput>;

const setTextContent: ToolHandler<SetTextContentInput, SetTextContentOutput, MutationContext> = {
  name: 'set_text_content',
  bundle: ELEMENT_CM1_BUNDLE_NAME,
  description:
    "Replace a text element's `text` (plain string), its `runs` (styled segments), or both. Supply one or both; at least one must be present. `runs` is wholesale-replaced — use `append_text_run` / `remove_text_run` for incremental edits. Refuses `wrong_element_type` unless the element is `type: 'text'`.",
  inputSchema: setTextContentInput as unknown as z.ZodType<SetTextContentInput>,
  outputSchema: setTextContentOutput,
  handle: (input, ctx) => {
    const loc = locateElement(ctx, input.slideId, input.elementId);
    if (typeof loc === 'string') return { ok: false, reason: loc };
    if (loc.element.type !== 'text') {
      return { ok: false, reason: 'wrong_element_type', detail: `got '${loc.element.type}'` };
    }
    const updated = pushPartialUpdate(ctx, loc, { text: input.text, runs: input.runs }, [
      'text',
      'runs',
    ]);
    return { ok: true, elementId: input.elementId, updatedFields: updated };
  },
};

// ---------------------------------------------------------------------------
// 2 — append_text_run
// ---------------------------------------------------------------------------

const appendTextRunInput = z
  .object({
    slideId: z.string().min(1),
    elementId: z.string().min(1),
    run: textRunSchema,
    position: z.number().int().nonnegative().optional(),
  })
  .strict();
const appendTextRunOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      elementId: z.string(),
      position: z.number().int().nonnegative(),
      runCount: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['wrong_mode', 'slide_not_found', 'element_not_found', 'wrong_element_type']),
      detail: z.string().optional(),
    })
    .strict(),
]);

type AppendTextRunInput = z.infer<typeof appendTextRunInput>;
type AppendTextRunOutput = z.infer<typeof appendTextRunOutput>;

const appendTextRun: ToolHandler<AppendTextRunInput, AppendTextRunOutput, MutationContext> = {
  name: 'append_text_run',
  bundle: ELEMENT_CM1_BUNDLE_NAME,
  description:
    "Insert a single styled run into a text element's `runs` array. If the element has no `runs` yet, creates the array. `position` defaults to the end.",
  inputSchema: appendTextRunInput as unknown as z.ZodType<AppendTextRunInput>,
  outputSchema: appendTextRunOutput,
  handle: (input, ctx) => {
    const loc = locateElement(ctx, input.slideId, input.elementId);
    if (typeof loc === 'string') return { ok: false, reason: loc };
    if (loc.element.type !== 'text') {
      return { ok: false, reason: 'wrong_element_type', detail: `got '${loc.element.type}'` };
    }
    const runs = (loc.element.runs ?? []) as readonly unknown[];
    const hasRunsField = 'runs' in loc.element && loc.element.runs !== undefined;
    if (!hasRunsField) {
      ctx.patchSink.push({
        op: 'add',
        path: `${elementPath(loc)}/runs`,
        value: [input.run],
      });
      return {
        ok: true,
        elementId: input.elementId,
        position: 0,
        runCount: 1,
      };
    }
    const insertAt = Math.min(input.position ?? runs.length, runs.length);
    ctx.patchSink.push({
      op: 'add',
      path: `${elementPath(loc)}/runs/${insertAt === runs.length ? '-' : insertAt}`,
      value: input.run,
    });
    return {
      ok: true,
      elementId: input.elementId,
      position: insertAt,
      runCount: runs.length + 1,
    };
  },
};

// ---------------------------------------------------------------------------
// 3 — remove_text_run
// ---------------------------------------------------------------------------

const removeTextRunInput = z
  .object({
    slideId: z.string().min(1),
    elementId: z.string().min(1),
    index: z.number().int().nonnegative(),
  })
  .strict();
const removeTextRunOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      elementId: z.string(),
      removedIndex: z.number().int().nonnegative(),
      runCount: z.number().int().nonnegative(),
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
        'run_not_found',
      ]),
      detail: z.string().optional(),
    })
    .strict(),
]);

const removeTextRun: ToolHandler<
  z.infer<typeof removeTextRunInput>,
  z.infer<typeof removeTextRunOutput>,
  MutationContext
> = {
  name: 'remove_text_run',
  bundle: ELEMENT_CM1_BUNDLE_NAME,
  description:
    "Remove a single run from a text element's `runs` array by zero-based index. Refuses `run_not_found` if the index is out of range (or `runs` is absent / empty).",
  inputSchema: removeTextRunInput,
  outputSchema: removeTextRunOutput,
  handle: (input, ctx) => {
    const loc = locateElement(ctx, input.slideId, input.elementId);
    if (typeof loc === 'string') return { ok: false, reason: loc };
    if (loc.element.type !== 'text') {
      return { ok: false, reason: 'wrong_element_type', detail: `got '${loc.element.type}'` };
    }
    const runs = (loc.element.runs ?? []) as readonly unknown[];
    if (input.index >= runs.length) {
      return {
        ok: false,
        reason: 'run_not_found',
        detail: `index ${input.index} out of range (length ${runs.length})`,
      };
    }
    ctx.patchSink.push({
      op: 'remove',
      path: `${elementPath(loc)}/runs/${input.index}`,
    });
    return {
      ok: true,
      elementId: input.elementId,
      removedIndex: input.index,
      runCount: runs.length - 1,
    };
  },
};

// ---------------------------------------------------------------------------
// 4 — update_text_run_style
// ---------------------------------------------------------------------------

const textRunStylePatchSchema = z
  .object({
    color: colorValueSchema.optional(),
    weight: z.number().int().min(100).max(900).multipleOf(100).optional(),
    italic: z.boolean().optional(),
    underline: z.boolean().optional(),
    text: z.string().optional(),
  })
  .strict();

const updateTextRunStyleInput = z
  .object({
    slideId: z.string().min(1),
    elementId: z.string().min(1),
    index: z.number().int().nonnegative(),
    style: textRunStylePatchSchema,
  })
  .strict();
const updateTextRunStyleOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      elementId: z.string(),
      runIndex: z.number().int().nonnegative(),
      updatedFields: z.array(z.string()),
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
        'run_not_found',
      ]),
      detail: z.string().optional(),
    })
    .strict(),
]);

type UpdateTextRunStyleInput = z.infer<typeof updateTextRunStyleInput>;
type UpdateTextRunStyleOutput = z.infer<typeof updateTextRunStyleOutput>;

const updateTextRunStyle: ToolHandler<
  UpdateTextRunStyleInput,
  UpdateTextRunStyleOutput,
  MutationContext
> = {
  name: 'update_text_run_style',
  bundle: ELEMENT_CM1_BUNDLE_NAME,
  description:
    "Partial-merge into a single run's fields (color / weight / italic / underline / text). Each non-undefined field becomes one `add` or `replace` op depending on whether the run already has that field. Refuses `run_not_found` if the index is out of range.",
  inputSchema: updateTextRunStyleInput as unknown as z.ZodType<UpdateTextRunStyleInput>,
  outputSchema: updateTextRunStyleOutput,
  handle: (input, ctx) => {
    const loc = locateElement(ctx, input.slideId, input.elementId);
    if (typeof loc === 'string') return { ok: false, reason: loc };
    if (loc.element.type !== 'text') {
      return { ok: false, reason: 'wrong_element_type', detail: `got '${loc.element.type}'` };
    }
    const runs = (loc.element.runs ?? []) as readonly Record<string, unknown>[];
    if (input.index >= runs.length) {
      return {
        ok: false,
        reason: 'run_not_found',
        detail: `index ${input.index} out of range (length ${runs.length})`,
      };
    }
    const run = runs[input.index];
    if (!run) return { ok: false, reason: 'run_not_found' };

    const updated: string[] = [];
    for (const field of ['color', 'weight', 'italic', 'underline', 'text'] as const) {
      const value = input.style[field];
      if (value === undefined) continue;
      updated.push(field);
      const op = field in run ? 'replace' : 'add';
      ctx.patchSink.push({
        op,
        path: `${elementPath(loc)}/runs/${input.index}/${field}`,
        value,
      });
    }
    return {
      ok: true,
      elementId: input.elementId,
      runIndex: input.index,
      updatedFields: updated,
    };
  },
};

// ---------------------------------------------------------------------------
// 5 — update_text_style (block-level)
// ---------------------------------------------------------------------------

const updateTextStyleInput = z
  .object({
    slideId: z.string().min(1),
    elementId: z.string().min(1),
    fontFamily: z.string().min(1).optional(),
    fontSize: z.number().positive().optional(),
    color: colorValueSchema.optional(),
    align: z.enum(['left', 'center', 'right', 'justify']).optional(),
    lineHeight: z.number().positive().optional(),
  })
  .strict();
const updateTextStyleOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      elementId: z.string(),
      updatedFields: z.array(z.string()),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['wrong_mode', 'slide_not_found', 'element_not_found', 'wrong_element_type']),
      detail: z.string().optional(),
    })
    .strict(),
]);

type UpdateTextStyleInput = z.infer<typeof updateTextStyleInput>;
type UpdateTextStyleOutput = z.infer<typeof updateTextStyleOutput>;

const updateTextStyle: ToolHandler<UpdateTextStyleInput, UpdateTextStyleOutput, MutationContext> = {
  name: 'update_text_style',
  bundle: ELEMENT_CM1_BUNDLE_NAME,
  description:
    "Partial-merge into a text element's block-level style (fontFamily / fontSize / color / align / lineHeight). Emits one `add` or `replace` per provided field.",
  inputSchema: updateTextStyleInput as unknown as z.ZodType<UpdateTextStyleInput>,
  outputSchema: updateTextStyleOutput,
  handle: (input, ctx) => {
    const loc = locateElement(ctx, input.slideId, input.elementId);
    if (typeof loc === 'string') return { ok: false, reason: loc };
    if (loc.element.type !== 'text') {
      return { ok: false, reason: 'wrong_element_type', detail: `got '${loc.element.type}'` };
    }
    const updated = pushPartialUpdate(
      ctx,
      loc,
      {
        fontFamily: input.fontFamily,
        fontSize: input.fontSize,
        color: input.color,
        align: input.align,
        lineHeight: input.lineHeight,
      },
      ['fontFamily', 'fontSize', 'color', 'align', 'lineHeight'],
    );
    return { ok: true, elementId: input.elementId, updatedFields: updated };
  },
};

// ---------------------------------------------------------------------------
// 6 — update_shape
// ---------------------------------------------------------------------------

const updateShapeInput = z
  .object({
    slideId: z.string().min(1),
    elementId: z.string().min(1),
    shape: shapeKindSchema.optional(),
    path: z.string().min(1).optional(),
    fill: colorValueSchema.optional(),
    stroke: strokeSchema.optional(),
    cornerRadius: z.number().nonnegative().optional(),
  })
  .strict();
const updateShapeOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      elementId: z.string(),
      updatedFields: z.array(z.string()),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['wrong_mode', 'slide_not_found', 'element_not_found', 'wrong_element_type']),
      detail: z.string().optional(),
    })
    .strict(),
]);

type UpdateShapeInput = z.infer<typeof updateShapeInput>;
type UpdateShapeOutput = z.infer<typeof updateShapeOutput>;

const updateShape: ToolHandler<UpdateShapeInput, UpdateShapeOutput, MutationContext> = {
  name: 'update_shape',
  bundle: ELEMENT_CM1_BUNDLE_NAME,
  description:
    'Partial-merge into a shape element (shape kind / path / fill / stroke / cornerRadius). `stroke` is replaced wholesale; pass the full stroke object to change a sub-field. `custom-path` shapes need `path` — enforced at RIR compile time, not here.',
  inputSchema: updateShapeInput as unknown as z.ZodType<UpdateShapeInput>,
  outputSchema: updateShapeOutput,
  handle: (input, ctx) => {
    const loc = locateElement(ctx, input.slideId, input.elementId);
    if (typeof loc === 'string') return { ok: false, reason: loc };
    if (loc.element.type !== 'shape') {
      return { ok: false, reason: 'wrong_element_type', detail: `got '${loc.element.type}'` };
    }
    const updated = pushPartialUpdate(
      ctx,
      loc,
      {
        shape: input.shape,
        path: input.path,
        fill: input.fill,
        stroke: input.stroke,
        cornerRadius: input.cornerRadius,
      },
      ['shape', 'path', 'fill', 'stroke', 'cornerRadius'],
    );
    return { ok: true, elementId: input.elementId, updatedFields: updated };
  },
};

// ---------------------------------------------------------------------------
// 7 — update_image
// ---------------------------------------------------------------------------

const updateImageInput = z
  .object({
    slideId: z.string().min(1),
    elementId: z.string().min(1),
    src: assetRefSchema.optional(),
    alt: z.string().max(500).optional(),
    fit: z.enum(['cover', 'contain', 'fill', 'none', 'scale-down']).optional(),
  })
  .strict();
const updateImageOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      elementId: z.string(),
      updatedFields: z.array(z.string()),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['wrong_mode', 'slide_not_found', 'element_not_found', 'wrong_element_type']),
      detail: z.string().optional(),
    })
    .strict(),
]);

const updateImage: ToolHandler<
  z.infer<typeof updateImageInput>,
  z.infer<typeof updateImageOutput>,
  MutationContext
> = {
  name: 'update_image',
  bundle: ELEMENT_CM1_BUNDLE_NAME,
  description:
    'Partial-merge into an image element (src / alt / fit). Empty-string `alt` removes the field; any other provided field becomes an `add` or `replace`.',
  inputSchema: updateImageInput,
  outputSchema: updateImageOutput,
  handle: (input, ctx) => {
    const loc = locateElement(ctx, input.slideId, input.elementId);
    if (typeof loc === 'string') return { ok: false, reason: loc };
    if (loc.element.type !== 'image') {
      return { ok: false, reason: 'wrong_element_type', detail: `got '${loc.element.type}'` };
    }
    const updated: string[] = [];
    for (const field of ['src', 'alt', 'fit'] as const) {
      const value = input[field];
      if (value === undefined) continue;
      updated.push(field);
      if (field === 'alt' && value === '') {
        if ('alt' in loc.element) {
          ctx.patchSink.push({ op: 'remove', path: `${elementPath(loc)}/alt` });
        }
        continue;
      }
      const op = field in loc.element ? 'replace' : 'add';
      ctx.patchSink.push({
        op,
        path: `${elementPath(loc)}/${field}`,
        value,
      });
    }
    return { ok: true, elementId: input.elementId, updatedFields: updated };
  },
};

// ---------------------------------------------------------------------------
// 8 — update_video
// ---------------------------------------------------------------------------

const updateVideoInput = z
  .object({
    slideId: z.string().min(1),
    elementId: z.string().min(1),
    src: assetRefSchema.optional(),
    trim: trimWindowSchema.optional(),
    muted: z.boolean().optional(),
    loop: z.boolean().optional(),
    playbackRate: z.number().positive().optional(),
  })
  .strict();
const updateVideoOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      elementId: z.string(),
      updatedFields: z.array(z.string()),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['wrong_mode', 'slide_not_found', 'element_not_found', 'wrong_element_type']),
      detail: z.string().optional(),
    })
    .strict(),
]);

type UpdateVideoInput = z.infer<typeof updateVideoInput>;
type UpdateVideoOutput = z.infer<typeof updateVideoOutput>;

const updateVideo: ToolHandler<UpdateVideoInput, UpdateVideoOutput, MutationContext> = {
  name: 'update_video',
  bundle: ELEMENT_CM1_BUNDLE_NAME,
  description:
    'Partial-merge into a video element (src / trim / muted / loop / playbackRate). `trim` is validated against `trimWindowSchema` (endMs > startMs).',
  inputSchema: updateVideoInput as unknown as z.ZodType<UpdateVideoInput>,
  outputSchema: updateVideoOutput,
  handle: (input, ctx) => {
    const loc = locateElement(ctx, input.slideId, input.elementId);
    if (typeof loc === 'string') return { ok: false, reason: loc };
    if (loc.element.type !== 'video') {
      return { ok: false, reason: 'wrong_element_type', detail: `got '${loc.element.type}'` };
    }
    const updated = pushPartialUpdate(
      ctx,
      loc,
      {
        src: input.src,
        trim: input.trim,
        muted: input.muted,
        loop: input.loop,
        playbackRate: input.playbackRate,
      },
      ['src', 'trim', 'muted', 'loop', 'playbackRate'],
    );
    return { ok: true, elementId: input.elementId, updatedFields: updated };
  },
};

// ---------------------------------------------------------------------------
// 9 — update_audio
// ---------------------------------------------------------------------------

const audioMixPatchSchema = z
  .object({
    gain: z.number().optional(),
    pan: z.number().min(-1).max(1).optional(),
    fadeInMs: z.number().nonnegative().optional(),
    fadeOutMs: z.number().nonnegative().optional(),
  })
  .strict();

const updateAudioInput = z
  .object({
    slideId: z.string().min(1),
    elementId: z.string().min(1),
    src: assetRefSchema.optional(),
    trim: trimWindowSchema.optional(),
    mix: audioMixPatchSchema.optional(),
    loop: z.boolean().optional(),
  })
  .strict();
const updateAudioOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      elementId: z.string(),
      updatedFields: z.array(z.string()),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['wrong_mode', 'slide_not_found', 'element_not_found', 'wrong_element_type']),
      detail: z.string().optional(),
    })
    .strict(),
]);

type UpdateAudioInput = z.infer<typeof updateAudioInput>;
type UpdateAudioOutput = z.infer<typeof updateAudioOutput>;

const updateAudio: ToolHandler<UpdateAudioInput, UpdateAudioOutput, MutationContext> = {
  name: 'update_audio',
  bundle: ELEMENT_CM1_BUNDLE_NAME,
  description:
    'Partial-merge into an audio element (src / trim / mix / loop). `mix` is merged field-by-field (gain / pan / fadeInMs / fadeOutMs) onto any existing mix object; missing fields survive.',
  inputSchema: updateAudioInput as unknown as z.ZodType<UpdateAudioInput>,
  outputSchema: updateAudioOutput,
  handle: (input, ctx) => {
    const loc = locateElement(ctx, input.slideId, input.elementId);
    if (typeof loc === 'string') return { ok: false, reason: loc };
    if (loc.element.type !== 'audio') {
      return { ok: false, reason: 'wrong_element_type', detail: `got '${loc.element.type}'` };
    }
    const updated: string[] = [];
    for (const field of ['src', 'trim', 'loop'] as const) {
      const value = input[field];
      if (value === undefined) continue;
      updated.push(field);
      const op = field in loc.element ? 'replace' : 'add';
      ctx.patchSink.push({
        op,
        path: `${elementPath(loc)}/${field}`,
        value,
      });
    }
    if (input.mix !== undefined) {
      updated.push('mix');
      const hasMix = 'mix' in loc.element && loc.element.mix !== undefined;
      const existingMix = hasMix ? (loc.element.mix as Record<string, unknown>) : undefined;
      if (existingMix === undefined) {
        // Seed a fresh mix object; unspecified fields stay undefined so the
        // schema's defaults apply on first parse by downstream consumers.
        ctx.patchSink.push({
          op: 'add',
          path: `${elementPath(loc)}/mix`,
          value: { ...input.mix },
        });
      } else {
        for (const key of ['gain', 'pan', 'fadeInMs', 'fadeOutMs'] as const) {
          const value = input.mix[key];
          if (value === undefined) continue;
          const op = key in existingMix ? 'replace' : 'add';
          ctx.patchSink.push({
            op,
            path: `${elementPath(loc)}/mix/${key}`,
            value,
          });
        }
      }
    }
    return { ok: true, elementId: input.elementId, updatedFields: updated };
  },
};

// ---------------------------------------------------------------------------
// 10 — update_code
// ---------------------------------------------------------------------------

const updateCodeInput = z
  .object({
    slideId: z.string().min(1),
    elementId: z.string().min(1),
    code: z.string().optional(),
    language: codeLanguageSchema.optional(),
    theme: z.string().optional(),
    showLineNumbers: z.boolean().optional(),
    wrap: z.boolean().optional(),
  })
  .strict();
const updateCodeOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      elementId: z.string(),
      updatedFields: z.array(z.string()),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['wrong_mode', 'slide_not_found', 'element_not_found', 'wrong_element_type']),
      detail: z.string().optional(),
    })
    .strict(),
]);

const updateCode: ToolHandler<
  z.infer<typeof updateCodeInput>,
  z.infer<typeof updateCodeOutput>,
  MutationContext
> = {
  name: 'update_code',
  bundle: ELEMENT_CM1_BUNDLE_NAME,
  description:
    'Partial-merge into a code element (code / language / theme / showLineNumbers / wrap). Empty-string `theme` removes the field.',
  inputSchema: updateCodeInput,
  outputSchema: updateCodeOutput,
  handle: (input, ctx) => {
    const loc = locateElement(ctx, input.slideId, input.elementId);
    if (typeof loc === 'string') return { ok: false, reason: loc };
    if (loc.element.type !== 'code') {
      return { ok: false, reason: 'wrong_element_type', detail: `got '${loc.element.type}'` };
    }
    const updated: string[] = [];
    for (const field of ['code', 'language', 'theme', 'showLineNumbers', 'wrap'] as const) {
      const value = input[field];
      if (value === undefined) continue;
      updated.push(field);
      if (field === 'theme' && value === '') {
        if ('theme' in loc.element) {
          ctx.patchSink.push({ op: 'remove', path: `${elementPath(loc)}/theme` });
        }
        continue;
      }
      const op = field in loc.element ? 'replace' : 'add';
      ctx.patchSink.push({
        op,
        path: `${elementPath(loc)}/${field}`,
        value,
      });
    }
    return { ok: true, elementId: input.elementId, updatedFields: updated };
  },
};

// ---------------------------------------------------------------------------
// 11 — update_embed
// ---------------------------------------------------------------------------

const SANDBOX_TOKENS = [
  'allow-scripts',
  'allow-same-origin',
  'allow-forms',
  'allow-popups',
  'allow-modals',
] as const;

const updateEmbedInput = z
  .object({
    slideId: z.string().min(1),
    elementId: z.string().min(1),
    src: z.string().url().optional(),
    sandbox: z.array(z.enum(SANDBOX_TOKENS)).optional(),
    allowFullscreen: z.boolean().optional(),
  })
  .strict();
const updateEmbedOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      elementId: z.string(),
      updatedFields: z.array(z.string()),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['wrong_mode', 'slide_not_found', 'element_not_found', 'wrong_element_type']),
      detail: z.string().optional(),
    })
    .strict(),
]);

const updateEmbed: ToolHandler<
  z.infer<typeof updateEmbedInput>,
  z.infer<typeof updateEmbedOutput>,
  MutationContext
> = {
  name: 'update_embed',
  bundle: ELEMENT_CM1_BUNDLE_NAME,
  description:
    'Partial-merge into an embed element (src / sandbox / allowFullscreen). `sandbox` is replaced wholesale; pass the full array to toggle flags.',
  inputSchema: updateEmbedInput,
  outputSchema: updateEmbedOutput,
  handle: (input, ctx) => {
    const loc = locateElement(ctx, input.slideId, input.elementId);
    if (typeof loc === 'string') return { ok: false, reason: loc };
    if (loc.element.type !== 'embed') {
      return { ok: false, reason: 'wrong_element_type', detail: `got '${loc.element.type}'` };
    }
    const updated = pushPartialUpdate(
      ctx,
      loc,
      {
        src: input.src,
        sandbox: input.sandbox,
        allowFullscreen: input.allowFullscreen,
      },
      ['src', 'sandbox', 'allowFullscreen'],
    );
    return { ok: true, elementId: input.elementId, updatedFields: updated };
  },
};

// ---------------------------------------------------------------------------
// 12 — set_element_flags
// ---------------------------------------------------------------------------

const setElementFlagsInput = z
  .object({
    slideId: z.string().min(1),
    elementId: z.string().min(1),
    visible: z.boolean().optional(),
    locked: z.boolean().optional(),
    name: z.string().max(200).optional(),
  })
  .strict();
const setElementFlagsOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      elementId: z.string(),
      updatedFields: z.array(z.string()),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['wrong_mode', 'slide_not_found', 'element_not_found']),
    })
    .strict(),
]);

const setElementFlags: ToolHandler<
  z.infer<typeof setElementFlagsInput>,
  z.infer<typeof setElementFlagsOutput>,
  MutationContext
> = {
  name: 'set_element_flags',
  bundle: ELEMENT_CM1_BUNDLE_NAME,
  description:
    'Set element-level metadata (visible / locked / name) on any element regardless of type. Empty-string `name` removes the field.',
  inputSchema: setElementFlagsInput,
  outputSchema: setElementFlagsOutput,
  handle: (input, ctx) => {
    const loc = locateElement(ctx, input.slideId, input.elementId);
    if (typeof loc === 'string') return { ok: false, reason: loc };
    const updated: string[] = [];
    for (const field of ['visible', 'locked', 'name'] as const) {
      const value = input[field];
      if (value === undefined) continue;
      updated.push(field);
      if (field === 'name' && value === '') {
        if ('name' in loc.element) {
          ctx.patchSink.push({ op: 'remove', path: `${elementPath(loc)}/name` });
        }
        continue;
      }
      const op = field in loc.element ? 'replace' : 'add';
      ctx.patchSink.push({
        op,
        path: `${elementPath(loc)}/${field}`,
        value,
      });
    }
    return { ok: true, elementId: input.elementId, updatedFields: updated };
  },
};

// ---------------------------------------------------------------------------
// Barrel
// ---------------------------------------------------------------------------

export const ELEMENT_CM1_HANDLERS: readonly ToolHandler<unknown, unknown, MutationContext>[] = [
  setTextContent,
  appendTextRun,
  removeTextRun,
  updateTextRunStyle,
  updateTextStyle,
  updateShape,
  updateImage,
  updateVideo,
  updateAudio,
  updateCode,
  updateEmbed,
  setElementFlags,
] as unknown as readonly ToolHandler<unknown, unknown, MutationContext>[];

// ---------------------------------------------------------------------------
// LLM tool definitions
// ---------------------------------------------------------------------------

const nonEmptyString = { type: 'string' as const, minLength: 1 };
const nonNegInt = { type: 'integer' as const, minimum: 0 };
const runObject = {
  type: 'object' as const,
  description:
    'Styled text run — Zod-validated server-side against `textRunSchema` (`{ text, color?, weight?, italic?, underline? }`).',
};
const colorValue = {
  type: 'string' as const,
  description: 'Hex `#RGB` / `#RRGGBB` / `#RRGGBBAA` or theme ref `theme:<dotted.path>`.',
};
const strokeObject = {
  type: 'object' as const,
  description:
    'Stroke — Zod-validated server-side against `strokeSchema` (`{ color, width, dasharray?, linecap?, linejoin? }`).',
};
const trimWindowObject = {
  type: 'object' as const,
  description: '`{ startMs, endMs }` with `endMs > startMs`.',
};
const audioMixObject = {
  type: 'object' as const,
  description:
    'Audio mix patch — `{ gain?, pan?, fadeInMs?, fadeOutMs? }`. Merged field-by-field onto any existing mix.',
};

export const ELEMENT_CM1_TOOL_DEFINITIONS: readonly LLMToolDefinition[] = [
  {
    name: 'set_text_content',
    description: setTextContent.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'elementId'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        elementId: nonEmptyString,
        text: { type: 'string' },
        runs: { type: 'array', items: runObject },
      },
    },
  },
  {
    name: 'append_text_run',
    description: appendTextRun.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'elementId', 'run'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        elementId: nonEmptyString,
        run: runObject,
        position: nonNegInt,
      },
    },
  },
  {
    name: 'remove_text_run',
    description: removeTextRun.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'elementId', 'index'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        elementId: nonEmptyString,
        index: nonNegInt,
      },
    },
  },
  {
    name: 'update_text_run_style',
    description: updateTextRunStyle.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'elementId', 'index', 'style'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        elementId: nonEmptyString,
        index: nonNegInt,
        style: {
          type: 'object',
          additionalProperties: false,
          properties: {
            color: colorValue,
            weight: { type: 'integer', minimum: 100, maximum: 900, multipleOf: 100 },
            italic: { type: 'boolean' },
            underline: { type: 'boolean' },
            text: { type: 'string' },
          },
        },
      },
    },
  },
  {
    name: 'update_text_style',
    description: updateTextStyle.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'elementId'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        elementId: nonEmptyString,
        fontFamily: { type: 'string', minLength: 1 },
        fontSize: { type: 'number', exclusiveMinimum: 0 },
        color: colorValue,
        align: { type: 'string', enum: ['left', 'center', 'right', 'justify'] },
        lineHeight: { type: 'number', exclusiveMinimum: 0 },
      },
    },
  },
  {
    name: 'update_shape',
    description: updateShape.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'elementId'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        elementId: nonEmptyString,
        shape: {
          type: 'string',
          enum: ['rect', 'ellipse', 'line', 'polygon', 'star', 'custom-path'],
        },
        path: nonEmptyString,
        fill: colorValue,
        stroke: strokeObject,
        cornerRadius: { type: 'number', minimum: 0 },
      },
    },
  },
  {
    name: 'update_image',
    description: updateImage.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'elementId'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        elementId: nonEmptyString,
        src: {
          type: 'string',
          description: 'Asset reference `asset:<id>` — Zod-validated server-side.',
        },
        alt: { type: 'string', maxLength: 500 },
        fit: { type: 'string', enum: ['cover', 'contain', 'fill', 'none', 'scale-down'] },
      },
    },
  },
  {
    name: 'update_video',
    description: updateVideo.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'elementId'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        elementId: nonEmptyString,
        src: { type: 'string', description: 'Asset reference `asset:<id>`.' },
        trim: trimWindowObject,
        muted: { type: 'boolean' },
        loop: { type: 'boolean' },
        playbackRate: { type: 'number', exclusiveMinimum: 0 },
      },
    },
  },
  {
    name: 'update_audio',
    description: updateAudio.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'elementId'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        elementId: nonEmptyString,
        src: { type: 'string', description: 'Asset reference `asset:<id>`.' },
        trim: trimWindowObject,
        mix: audioMixObject,
        loop: { type: 'boolean' },
      },
    },
  },
  {
    name: 'update_code',
    description: updateCode.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'elementId'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        elementId: nonEmptyString,
        code: { type: 'string' },
        language: {
          type: 'string',
          description: 'Enum from `codeLanguageSchema` — Zod-validated server-side.',
        },
        theme: { type: 'string' },
        showLineNumbers: { type: 'boolean' },
        wrap: { type: 'boolean' },
      },
    },
  },
  {
    name: 'update_embed',
    description: updateEmbed.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'elementId'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        elementId: nonEmptyString,
        src: { type: 'string', format: 'uri' },
        sandbox: {
          type: 'array',
          items: { type: 'string', enum: [...SANDBOX_TOKENS] },
        },
        allowFullscreen: { type: 'boolean' },
      },
    },
  },
  {
    name: 'set_element_flags',
    description: setElementFlags.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'elementId'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        elementId: nonEmptyString,
        visible: { type: 'boolean' },
        locked: { type: 'boolean' },
        name: { type: 'string', maxLength: 200 },
      },
    },
  },
];
