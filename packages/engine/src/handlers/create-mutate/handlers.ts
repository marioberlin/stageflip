// packages/engine/src/handlers/create-mutate/handlers.ts
// `create-mutate` bundle — 8 write-tier tools covering slide + element
// CRUD on a StageFlip.Slide document. Handlers type against
// MutationContext; mutation flows through `ctx.patchSink.push(op)`
// (JSON-Patch). Between tool calls the Executor drains the sink, applies
// patches, and re-reads the document — so successive calls in one step
// see the previous mutation's effect.

import type { LLMToolDefinition } from '@stageflip/llm-abstraction';
import { elementSchema, slideBackgroundSchema, slideSchema } from '@stageflip/schema';
import { z } from 'zod';
import type { MutationContext, ToolHandler } from '../../router/types.js';
import { deepRenameElementIds, nextElementId, nextSlideId } from './ids.js';

export const CREATE_MUTATE_BUNDLE_NAME = 'create-mutate';

// Zod's discriminatedUnion requires unique literals on the discriminator,
// so every handler collapses its failure branches into a single
// `{ ok: false, reason: <enum> }` arm per-schema below.

function wrongModeIfNeeded(ctx: MutationContext): {
  ok: false;
  reason: 'wrong_mode';
} | null {
  return ctx.document.content.mode === 'slide' ? null : { ok: false, reason: 'wrong_mode' };
}

function findSlideIndex(ctx: MutationContext, slideId: string): number | null {
  if (ctx.document.content.mode !== 'slide') return null;
  const index = ctx.document.content.slides.findIndex((s) => s.id === slideId);
  return index === -1 ? null : index;
}

// --- add_slide ------------------------------------------------------------

const addSlideInput = z
  .object({
    position: z.number().int().nonnegative().optional(),
    title: z.string().min(1).max(400).optional(),
    durationMs: z.number().int().positive().optional(),
    notes: z.string().min(1).max(5000).optional(),
    background: slideBackgroundSchema.optional(),
  })
  .strict();
const addSlideOutput = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), slideId: z.string(), position: z.number().int() }).strict(),
  z.object({ ok: z.literal(false), reason: z.enum(['wrong_mode']) }).strict(),
]);

const addSlide: ToolHandler<
  z.infer<typeof addSlideInput>,
  z.infer<typeof addSlideOutput>,
  MutationContext
> = {
  name: 'add_slide',
  bundle: CREATE_MUTATE_BUNDLE_NAME,
  description:
    'Append or insert a new slide. Position defaults to the end. Returns the generated slide id and insertion index.',
  inputSchema: addSlideInput,
  outputSchema: addSlideOutput,
  handle: (input, ctx) => {
    const wm = wrongModeIfNeeded(ctx);
    if (wm) return wm;
    const slides = ctx.document.content.mode === 'slide' ? ctx.document.content.slides : [];
    const insertAt = Math.min(input.position ?? slides.length, slides.length);
    const slideId = nextSlideId(ctx.document);

    const newSlide: Record<string, unknown> = { id: slideId, elements: [] };
    if (input.title !== undefined) newSlide.title = input.title;
    if (input.durationMs !== undefined) newSlide.durationMs = input.durationMs;
    if (input.notes !== undefined) newSlide.notes = input.notes;
    if (input.background !== undefined) newSlide.background = input.background;

    ctx.patchSink.push({
      op: 'add',
      path: `/content/slides/${insertAt === slides.length ? '-' : insertAt}`,
      value: newSlide,
    });
    return { ok: true, slideId, position: insertAt };
  },
};

// --- update_slide ---------------------------------------------------------

const updateSlideInput = z
  .object({
    slideId: z.string().min(1),
    title: z.string().max(400).optional(),
    durationMs: z.number().int().positive().optional(),
    notes: z.string().max(5000).optional(),
    background: slideBackgroundSchema.optional(),
  })
  .strict();
const updateSlideOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      slideId: z.string(),
      updatedFields: z.array(z.string()),
    })
    .strict(),
  z.object({ ok: z.literal(false), reason: z.enum(['wrong_mode', 'not_found']) }).strict(),
]);

const updateSlide: ToolHandler<
  z.infer<typeof updateSlideInput>,
  z.infer<typeof updateSlideOutput>,
  MutationContext
> = {
  name: 'update_slide',
  bundle: CREATE_MUTATE_BUNDLE_NAME,
  description:
    'Update one or more fields on an existing slide. Omit a field to leave it unchanged. Empty string title / notes remove the field.',
  inputSchema: updateSlideInput,
  outputSchema: updateSlideOutput,
  handle: (input, ctx) => {
    const wm = wrongModeIfNeeded(ctx);
    if (wm) return wm;
    const index = findSlideIndex(ctx, input.slideId);
    if (index === null) return { ok: false, reason: 'not_found' };
    const updatedFields: string[] = [];
    for (const field of ['title', 'durationMs', 'notes', 'background'] as const) {
      const value = input[field];
      if (value === undefined) continue;
      updatedFields.push(field);
      if (
        (field === 'title' || field === 'notes') &&
        typeof value === 'string' &&
        value.length === 0
      ) {
        ctx.patchSink.push({ op: 'remove', path: `/content/slides/${index}/${field}` });
        continue;
      }
      ctx.patchSink.push({
        op: 'replace',
        path: `/content/slides/${index}/${field}`,
        value,
      });
    }
    return { ok: true, slideId: input.slideId, updatedFields };
  },
};

// --- duplicate_slide ------------------------------------------------------

const duplicateSlideInput = z
  .object({
    slideId: z.string().min(1),
    position: z.number().int().nonnegative().optional(),
  })
  .strict();
const duplicateSlideOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      newSlideId: z.string(),
      originalSlideId: z.string(),
    })
    .strict(),
  z.object({ ok: z.literal(false), reason: z.enum(['wrong_mode', 'not_found']) }).strict(),
]);

const duplicateSlide: ToolHandler<
  z.infer<typeof duplicateSlideInput>,
  z.infer<typeof duplicateSlideOutput>,
  MutationContext
> = {
  name: 'duplicate_slide',
  bundle: CREATE_MUTATE_BUNDLE_NAME,
  description:
    'Deep-copy an existing slide, assign fresh ids to the slide + every element, and insert the copy. Position defaults to immediately after the source.',
  inputSchema: duplicateSlideInput,
  outputSchema: duplicateSlideOutput,
  handle: (input, ctx) => {
    if (ctx.document.content.mode !== 'slide') {
      return { ok: false, reason: 'wrong_mode' };
    }
    const slides = ctx.document.content.slides;
    const index = slides.findIndex((s) => s.id === input.slideId);
    if (index === -1) return { ok: false, reason: 'not_found' };

    const source = slides[index];
    if (!source) return { ok: false, reason: 'not_found' };
    const newSlideId = nextSlideId(ctx.document);

    // Re-id every element in the duplicate so the doc stays unique-id.
    const existingElementIds = new Set<string>();
    for (const slide of slides) {
      for (const element of slide.elements) existingElementIds.add(element.id);
    }
    const mapping = new Map<string, string>();
    let counter = 1;
    for (const element of source.elements) {
      let candidate = `el-${counter++}`;
      while (existingElementIds.has(candidate) || mapping.has(element.id)) {
        candidate = `el-${counter++}`;
      }
      existingElementIds.add(candidate);
      mapping.set(element.id, candidate);
    }

    const clonedElements = deepRenameElementIds(source.elements, mapping);
    const clone: Record<string, unknown> = {
      ...source,
      id: newSlideId,
      elements: clonedElements,
    };

    const insertAt = Math.min(input.position ?? index + 1, slides.length);
    ctx.patchSink.push({
      op: 'add',
      path: `/content/slides/${insertAt === slides.length ? '-' : insertAt}`,
      value: clone,
    });
    return { ok: true, newSlideId, originalSlideId: input.slideId };
  },
};

// --- reorder_slides -------------------------------------------------------

const reorderSlidesInput = z.object({ order: z.array(z.string().min(1)).min(1) }).strict();
const reorderSlidesOutput = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), applied: z.number().int().nonnegative() }).strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['wrong_mode', 'mismatched_ids', 'mismatched_count']),
      detail: z.string().optional(),
    })
    .strict(),
]);

const reorderSlides: ToolHandler<
  z.infer<typeof reorderSlidesInput>,
  z.infer<typeof reorderSlidesOutput>,
  MutationContext
> = {
  name: 'reorder_slides',
  bundle: CREATE_MUTATE_BUNDLE_NAME,
  description:
    'Replace the slide order. The `order` array must contain every existing slide id exactly once.',
  inputSchema: reorderSlidesInput,
  outputSchema: reorderSlidesOutput,
  handle: (input, ctx) => {
    const wm = wrongModeIfNeeded(ctx);
    if (wm) return wm;
    const slides = ctx.document.content.mode === 'slide' ? ctx.document.content.slides : [];
    if (input.order.length !== slides.length) {
      return {
        ok: false,
        reason: 'mismatched_count',
        detail: `order had ${input.order.length} ids; deck has ${slides.length}`,
      };
    }
    const currentSet = new Set(slides.map((s) => s.id));
    const orderSet = new Set(input.order);
    if (orderSet.size !== input.order.length) {
      return { ok: false, reason: 'mismatched_ids', detail: 'order contains duplicates' };
    }
    for (const id of input.order) {
      if (!currentSet.has(id)) {
        return { ok: false, reason: 'mismatched_ids', detail: `unknown slide id: ${id}` };
      }
    }
    const byId = new Map(slides.map((s) => [s.id, s]));
    const reordered = input.order.map((id) => byId.get(id));
    ctx.patchSink.push({
      op: 'replace',
      path: '/content/slides',
      value: reordered,
    });
    return { ok: true, applied: slides.length };
  },
};

// --- delete_slide ---------------------------------------------------------

const deleteSlideInput = z.object({ slideId: z.string().min(1) }).strict();
const deleteSlideOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      deletedSlideId: z.string(),
      remainingCount: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['wrong_mode', 'not_found', 'last_slide']),
    })
    .strict(),
]);

const deleteSlide: ToolHandler<
  z.infer<typeof deleteSlideInput>,
  z.infer<typeof deleteSlideOutput>,
  MutationContext
> = {
  name: 'delete_slide',
  bundle: CREATE_MUTATE_BUNDLE_NAME,
  description:
    'Remove a slide by id. Refuses to delete the last remaining slide — every deck must have at least one (schema invariant).',
  inputSchema: deleteSlideInput,
  outputSchema: deleteSlideOutput,
  handle: (input, ctx) => {
    if (ctx.document.content.mode !== 'slide') {
      return { ok: false, reason: 'wrong_mode' };
    }
    const slides = ctx.document.content.slides;
    const index = slides.findIndex((s) => s.id === input.slideId);
    if (index === -1) return { ok: false, reason: 'not_found' };
    if (slides.length <= 1) return { ok: false, reason: 'last_slide' };
    ctx.patchSink.push({ op: 'remove', path: `/content/slides/${index}` });
    return {
      ok: true,
      deletedSlideId: input.slideId,
      remainingCount: slides.length - 1,
    };
  },
};

// --- add_element ----------------------------------------------------------

const addElementInput = z
  .object({
    slideId: z.string().min(1),
    element: elementSchema,
    position: z.number().int().nonnegative().optional(),
  })
  .strict();
const addElementOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      elementId: z.string(),
      slideId: z.string(),
    })
    .strict(),
  z.object({ ok: z.literal(false), reason: z.enum(['wrong_mode', 'not_found']) }).strict(),
]);

const addElement: ToolHandler<
  z.infer<typeof addElementInput>,
  z.infer<typeof addElementOutput>,
  MutationContext
> = {
  name: 'add_element',
  bundle: CREATE_MUTATE_BUNDLE_NAME,
  description:
    'Append or insert an element on an existing slide. The caller provides the full element (Zod-validated). If the id collides with an existing element, a fresh id is assigned automatically.',
  inputSchema: addElementInput,
  outputSchema: addElementOutput,
  handle: (input, ctx) => {
    const index = findSlideIndex(ctx, input.slideId);
    if (ctx.document.content.mode !== 'slide' || index === null) {
      return ctx.document.content.mode !== 'slide'
        ? { ok: false, reason: 'wrong_mode' }
        : { ok: false, reason: 'not_found' };
    }
    const slide = ctx.document.content.slides[index];
    if (!slide) return { ok: false, reason: 'not_found' };

    // Collision guard: reassign id if the caller-supplied one is already in
    // use anywhere in the document.
    const existingIds = new Set<string>();
    for (const s of ctx.document.content.slides) {
      for (const e of s.elements) existingIds.add(e.id);
    }
    const finalId = existingIds.has(input.element.id)
      ? nextElementId(ctx.document)
      : input.element.id;
    const element = { ...input.element, id: finalId };

    const elements = slide.elements;
    const insertAt = Math.min(input.position ?? elements.length, elements.length);
    ctx.patchSink.push({
      op: 'add',
      path: `/content/slides/${index}/elements/${insertAt === elements.length ? '-' : insertAt}`,
      value: element,
    });
    return { ok: true, elementId: finalId, slideId: input.slideId };
  },
};

// --- update_element -------------------------------------------------------

const updateElementInput = z
  .object({
    slideId: z.string().min(1),
    elementId: z.string().min(1),
    updates: z.record(z.unknown()),
  })
  .strict();
const updateElementOutput = z.discriminatedUnion('ok', [
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
      reason: z.enum(['wrong_mode', 'not_found', 'rejected_fields']),
      detail: z.string().optional(),
    })
    .strict(),
]);

const UPDATE_ELEMENT_FORBIDDEN_FIELDS = new Set(['id', 'type']);

const updateElement: ToolHandler<
  z.infer<typeof updateElementInput>,
  z.infer<typeof updateElementOutput>,
  MutationContext
> = {
  name: 'update_element',
  bundle: CREATE_MUTATE_BUNDLE_NAME,
  description:
    "Replace one or more fields on an existing element. `id` and `type` cannot be changed — use delete + add for that. Fields are replaced wholesale; to edit a text element's runs use element-cm1 tools (T-161).",
  inputSchema: updateElementInput,
  outputSchema: updateElementOutput,
  handle: (input, ctx) => {
    if (ctx.document.content.mode !== 'slide') {
      return { ok: false, reason: 'wrong_mode' };
    }
    const slideIndex = ctx.document.content.slides.findIndex((s) => s.id === input.slideId);
    if (slideIndex === -1) return { ok: false, reason: 'not_found' };
    const slide = ctx.document.content.slides[slideIndex];
    if (!slide) return { ok: false, reason: 'not_found' };
    const elementIndex = slide.elements.findIndex((e) => e.id === input.elementId);
    if (elementIndex === -1) return { ok: false, reason: 'not_found' };

    const rejected: string[] = [];
    const allowed: string[] = [];
    for (const key of Object.keys(input.updates)) {
      if (UPDATE_ELEMENT_FORBIDDEN_FIELDS.has(key)) rejected.push(key);
      else allowed.push(key);
    }
    if (rejected.length > 0) {
      return {
        ok: false,
        reason: 'rejected_fields',
        detail: `cannot change: ${rejected.join(', ')}`,
      };
    }

    for (const key of allowed) {
      ctx.patchSink.push({
        op: 'replace',
        path: `/content/slides/${slideIndex}/elements/${elementIndex}/${key}`,
        value: input.updates[key],
      });
    }
    return { ok: true, elementId: input.elementId, updatedFields: allowed };
  },
};

// --- delete_element -------------------------------------------------------

const deleteElementInput = z
  .object({ slideId: z.string().min(1), elementId: z.string().min(1) })
  .strict();
const deleteElementOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      deletedElementId: z.string(),
      slideId: z.string(),
    })
    .strict(),
  z.object({ ok: z.literal(false), reason: z.enum(['wrong_mode', 'not_found']) }).strict(),
]);

const deleteElement: ToolHandler<
  z.infer<typeof deleteElementInput>,
  z.infer<typeof deleteElementOutput>,
  MutationContext
> = {
  name: 'delete_element',
  bundle: CREATE_MUTATE_BUNDLE_NAME,
  description: 'Remove a single element from a slide.',
  inputSchema: deleteElementInput,
  outputSchema: deleteElementOutput,
  handle: (input, ctx) => {
    if (ctx.document.content.mode !== 'slide') {
      return { ok: false, reason: 'wrong_mode' };
    }
    const slideIndex = ctx.document.content.slides.findIndex((s) => s.id === input.slideId);
    if (slideIndex === -1) return { ok: false, reason: 'not_found' };
    const slide = ctx.document.content.slides[slideIndex];
    if (!slide) return { ok: false, reason: 'not_found' };
    const elementIndex = slide.elements.findIndex((e) => e.id === input.elementId);
    if (elementIndex === -1) return { ok: false, reason: 'not_found' };
    ctx.patchSink.push({
      op: 'remove',
      path: `/content/slides/${slideIndex}/elements/${elementIndex}`,
    });
    return {
      ok: true,
      deletedElementId: input.elementId,
      slideId: input.slideId,
    };
  },
};

// --- barrel ---------------------------------------------------------------

export const CREATE_MUTATE_HANDLERS: readonly ToolHandler<unknown, unknown, MutationContext>[] = [
  addSlide,
  updateSlide,
  duplicateSlide,
  reorderSlides,
  deleteSlide,
  addElement,
  updateElement,
  deleteElement,
] as unknown as readonly ToolHandler<unknown, unknown, MutationContext>[];

// JSONSchema tool-definitions that mirror the Zod input schemas above.
// Kept hand-authored per the same drift-gate discipline as T-155.

const positiveInt = { type: 'integer' as const, minimum: 1 };
const nonNegInt = { type: 'integer' as const, minimum: 0 };
const nonEmptyString = { type: 'string' as const, minLength: 1 };

export const CREATE_MUTATE_TOOL_DEFINITIONS: readonly LLMToolDefinition[] = [
  {
    name: 'add_slide',
    description: addSlide.description,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        position: nonNegInt,
        title: { type: 'string', minLength: 1, maxLength: 400 },
        durationMs: positiveInt,
        notes: { type: 'string', minLength: 1, maxLength: 5000 },
        background: {
          type: 'object',
          description: 'Slide background — schema validated server-side.',
        },
      },
    },
  },
  {
    name: 'update_slide',
    description: updateSlide.description,
    input_schema: {
      type: 'object',
      required: ['slideId'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        title: { type: 'string', maxLength: 400 },
        durationMs: positiveInt,
        notes: { type: 'string', maxLength: 5000 },
        background: { type: 'object' },
      },
    },
  },
  {
    name: 'duplicate_slide',
    description: duplicateSlide.description,
    input_schema: {
      type: 'object',
      required: ['slideId'],
      additionalProperties: false,
      properties: { slideId: nonEmptyString, position: nonNegInt },
    },
  },
  {
    name: 'reorder_slides',
    description: reorderSlides.description,
    input_schema: {
      type: 'object',
      required: ['order'],
      additionalProperties: false,
      properties: {
        order: { type: 'array', minItems: 1, items: nonEmptyString },
      },
    },
  },
  {
    name: 'delete_slide',
    description: deleteSlide.description,
    input_schema: {
      type: 'object',
      required: ['slideId'],
      additionalProperties: false,
      properties: { slideId: nonEmptyString },
    },
  },
  {
    name: 'add_element',
    description: addElement.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'element'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        element: {
          type: 'object',
          description:
            'Element payload — Zod-validated server-side against the discriminated elementSchema (text / image / shape / chart / table / clip / …).',
        },
        position: nonNegInt,
      },
    },
  },
  {
    name: 'update_element',
    description: updateElement.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'elementId', 'updates'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        elementId: nonEmptyString,
        updates: {
          type: 'object',
          description: 'Field → new value. `id` and `type` are forbidden.',
        },
      },
    },
  },
  {
    name: 'delete_element',
    description: deleteElement.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'elementId'],
      additionalProperties: false,
      properties: { slideId: nonEmptyString, elementId: nonEmptyString },
    },
  },
];

// Tests reach for the slide element schema to build fixtures.
export { slideSchema };
