// packages/engine/src/handlers/slide-cm1/handlers.ts
// `slide-cm1` bundle — 6 write-tier tools for slide-level content
// mutation + accessibility affordances: dedicated title / notes / notes-
// append / background tools, reading-order reordering (a11y), and a
// per-slide bulk alt-text setter (a11y). Slide-mode only.
//
// Scope boundary: `create-mutate` (T-156) still owns slide CRUD (add /
// duplicate / reorder / delete) and the catch-all `update_slide`; this
// bundle offers focused affordances the LLM can reach for without
// packing everything into one generic call. Reading-order reordering
// is unique here — no other bundle re-orders the per-slide elements
// array.

import type { LLMToolDefinition } from '@stageflip/llm-abstraction';
import { slideBackgroundSchema } from '@stageflip/schema';
import { z } from 'zod';
import type { MutationContext, ToolHandler } from '../../router/types.js';

export const SLIDE_CM1_BUNDLE_NAME = 'slide-cm1';

// ---------------------------------------------------------------------------
// Shared locators
// ---------------------------------------------------------------------------

interface SlideLocation {
  slideIndex: number;
  slide: {
    id: string;
    title?: string;
    notes?: string;
    background?: unknown;
    elements: readonly { id: string; type: string }[];
  } & Record<string, unknown>;
}

function locateSlide(
  ctx: MutationContext,
  slideId: string,
): SlideLocation | 'wrong_mode' | 'slide_not_found' {
  if (ctx.document.content.mode !== 'slide') return 'wrong_mode';
  const slideIndex = ctx.document.content.slides.findIndex((s) => s.id === slideId);
  if (slideIndex === -1) return 'slide_not_found';
  const slide = ctx.document.content.slides[slideIndex];
  if (!slide) return 'slide_not_found';
  return {
    slideIndex,
    slide: slide as unknown as SlideLocation['slide'],
  };
}

function slidePath(loc: SlideLocation): string {
  return `/content/slides/${loc.slideIndex}`;
}

// ---------------------------------------------------------------------------
// 1 — set_slide_title
// ---------------------------------------------------------------------------

const setSlideTitleInput = z
  .object({
    slideId: z.string().min(1),
    title: z.string().max(400),
  })
  .strict();
const setSlideTitleOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      slideId: z.string(),
      action: z.enum(['set', 'cleared']),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['wrong_mode', 'slide_not_found']),
    })
    .strict(),
]);

const setSlideTitle: ToolHandler<
  z.infer<typeof setSlideTitleInput>,
  z.infer<typeof setSlideTitleOutput>,
  MutationContext
> = {
  name: 'set_slide_title',
  bundle: SLIDE_CM1_BUNDLE_NAME,
  description:
    "Set or clear a slide's title. Empty-string `title` removes the field entirely (follows the T-156 empty-string-removes convention). Reports `action: 'set' | 'cleared'`.",
  inputSchema: setSlideTitleInput,
  outputSchema: setSlideTitleOutput,
  handle: (input, ctx) => {
    const loc = locateSlide(ctx, input.slideId);
    if (typeof loc === 'string') return { ok: false, reason: loc };
    if (input.title.length === 0) {
      if ('title' in loc.slide && loc.slide.title !== undefined) {
        ctx.patchSink.push({ op: 'remove', path: `${slidePath(loc)}/title` });
      }
      return { ok: true, slideId: input.slideId, action: 'cleared' };
    }
    const op = 'title' in loc.slide && loc.slide.title !== undefined ? 'replace' : 'add';
    ctx.patchSink.push({
      op,
      path: `${slidePath(loc)}/title`,
      value: input.title,
    });
    return { ok: true, slideId: input.slideId, action: 'set' };
  },
};

// ---------------------------------------------------------------------------
// 2 — set_slide_notes
// ---------------------------------------------------------------------------

const setSlideNotesInput = z
  .object({
    slideId: z.string().min(1),
    notes: z.string().max(5000),
  })
  .strict();
const setSlideNotesOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      slideId: z.string(),
      action: z.enum(['set', 'cleared']),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['wrong_mode', 'slide_not_found']),
    })
    .strict(),
]);

const setSlideNotes: ToolHandler<
  z.infer<typeof setSlideNotesInput>,
  z.infer<typeof setSlideNotesOutput>,
  MutationContext
> = {
  name: 'set_slide_notes',
  bundle: SLIDE_CM1_BUNDLE_NAME,
  description:
    "Set or clear a slide's speaker notes. Empty-string `notes` removes the field. Use `append_slide_notes` when you want to preserve existing notes.",
  inputSchema: setSlideNotesInput,
  outputSchema: setSlideNotesOutput,
  handle: (input, ctx) => {
    const loc = locateSlide(ctx, input.slideId);
    if (typeof loc === 'string') return { ok: false, reason: loc };
    if (input.notes.length === 0) {
      if ('notes' in loc.slide && loc.slide.notes !== undefined) {
        ctx.patchSink.push({ op: 'remove', path: `${slidePath(loc)}/notes` });
      }
      return { ok: true, slideId: input.slideId, action: 'cleared' };
    }
    const op = 'notes' in loc.slide && loc.slide.notes !== undefined ? 'replace' : 'add';
    ctx.patchSink.push({
      op,
      path: `${slidePath(loc)}/notes`,
      value: input.notes,
    });
    return { ok: true, slideId: input.slideId, action: 'set' };
  },
};

// ---------------------------------------------------------------------------
// 3 — append_slide_notes
// ---------------------------------------------------------------------------

const appendSlideNotesInput = z
  .object({
    slideId: z.string().min(1),
    text: z.string().min(1),
    separator: z.string().optional(),
  })
  .strict();
const appendSlideNotesOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      slideId: z.string(),
      lengthBefore: z.number().int().nonnegative(),
      lengthAfter: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['wrong_mode', 'slide_not_found', 'exceeds_max_length']),
      detail: z.string().optional(),
    })
    .strict(),
]);

const NOTES_MAX_LENGTH = 5000;

const appendSlideNotes: ToolHandler<
  z.infer<typeof appendSlideNotesInput>,
  z.infer<typeof appendSlideNotesOutput>,
  MutationContext
> = {
  name: 'append_slide_notes',
  bundle: SLIDE_CM1_BUNDLE_NAME,
  description:
    "Append text to a slide's speaker notes. `separator` defaults to two newlines (paragraph break); use `' '` for inline joins. Adds the field when absent. Refuses `exceeds_max_length` when the appended total would exceed 5000 chars (schema limit).",
  inputSchema: appendSlideNotesInput,
  outputSchema: appendSlideNotesOutput,
  handle: (input, ctx) => {
    const loc = locateSlide(ctx, input.slideId);
    if (typeof loc === 'string') return { ok: false, reason: loc };
    const existing = typeof loc.slide.notes === 'string' ? loc.slide.notes : '';
    const separator = input.separator ?? '\n\n';
    const next = existing.length === 0 ? input.text : `${existing}${separator}${input.text}`;
    if (next.length > NOTES_MAX_LENGTH) {
      return {
        ok: false,
        reason: 'exceeds_max_length',
        detail: `total would be ${next.length} chars (limit ${NOTES_MAX_LENGTH})`,
      };
    }
    const op = existing.length > 0 ? 'replace' : 'add';
    ctx.patchSink.push({
      op,
      path: `${slidePath(loc)}/notes`,
      value: next,
    });
    return {
      ok: true,
      slideId: input.slideId,
      lengthBefore: existing.length,
      lengthAfter: next.length,
    };
  },
};

// ---------------------------------------------------------------------------
// 4 — set_slide_background
// ---------------------------------------------------------------------------

const setSlideBackgroundInput = z
  .object({
    slideId: z.string().min(1),
    background: slideBackgroundSchema.nullable(),
  })
  .strict();
const setSlideBackgroundOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      slideId: z.string(),
      action: z.enum(['set', 'cleared']),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['wrong_mode', 'slide_not_found']),
    })
    .strict(),
]);

const setSlideBackground: ToolHandler<
  z.infer<typeof setSlideBackgroundInput>,
  z.infer<typeof setSlideBackgroundOutput>,
  MutationContext
> = {
  name: 'set_slide_background',
  bundle: SLIDE_CM1_BUNDLE_NAME,
  description:
    "Set or clear a slide's background. Pass a `{ kind: 'color', value }` or `{ kind: 'asset', value }` to set; pass `null` to clear. Noop when asked to clear a slide that has no background.",
  inputSchema: setSlideBackgroundInput,
  outputSchema: setSlideBackgroundOutput,
  handle: (input, ctx) => {
    const loc = locateSlide(ctx, input.slideId);
    if (typeof loc === 'string') return { ok: false, reason: loc };
    const hasBackground = 'background' in loc.slide && loc.slide.background !== undefined;
    if (input.background === null) {
      if (hasBackground) {
        ctx.patchSink.push({ op: 'remove', path: `${slidePath(loc)}/background` });
      }
      return { ok: true, slideId: input.slideId, action: 'cleared' };
    }
    ctx.patchSink.push({
      op: hasBackground ? 'replace' : 'add',
      path: `${slidePath(loc)}/background`,
      value: input.background,
    });
    return { ok: true, slideId: input.slideId, action: 'set' };
  },
};

// ---------------------------------------------------------------------------
// 5 — reorder_slide_elements (a11y reading order)
// ---------------------------------------------------------------------------

const reorderSlideElementsInput = z
  .object({
    slideId: z.string().min(1),
    order: z.array(z.string().min(1)).min(1),
  })
  .strict();
const reorderSlideElementsOutput = z.discriminatedUnion('ok', [
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
      reason: z.enum(['wrong_mode', 'slide_not_found', 'mismatched_ids', 'mismatched_count']),
      detail: z.string().optional(),
    })
    .strict(),
]);

const reorderSlideElements: ToolHandler<
  z.infer<typeof reorderSlideElementsInput>,
  z.infer<typeof reorderSlideElementsOutput>,
  MutationContext
> = {
  name: 'reorder_slide_elements',
  bundle: SLIDE_CM1_BUNDLE_NAME,
  description:
    "Reorder a slide's `elements` array. `order` must contain every existing element id exactly once — drift-gate checks match `reorder_slides` (T-156). Element array order is the a11y reading order (screen readers announce in document order) AND drives RIR z-index (array-index × 10). Changing this order therefore affects both a11y and stacking.",
  inputSchema: reorderSlideElementsInput,
  outputSchema: reorderSlideElementsOutput,
  handle: (input, ctx) => {
    const loc = locateSlide(ctx, input.slideId);
    if (typeof loc === 'string') return { ok: false, reason: loc };
    const elements = loc.slide.elements;
    if (input.order.length !== elements.length) {
      return {
        ok: false,
        reason: 'mismatched_count',
        detail: `order had ${input.order.length} ids; slide has ${elements.length}`,
      };
    }
    const currentSet = new Set(elements.map((e) => e.id));
    const orderSet = new Set(input.order);
    if (orderSet.size !== input.order.length) {
      return { ok: false, reason: 'mismatched_ids', detail: 'order contains duplicates' };
    }
    for (const id of input.order) {
      if (!currentSet.has(id)) {
        return { ok: false, reason: 'mismatched_ids', detail: `unknown element id: ${id}` };
      }
    }
    const byId = new Map(elements.map((e) => [e.id, e]));
    const reordered = input.order.map((id) => byId.get(id));
    ctx.patchSink.push({
      op: 'replace',
      path: `${slidePath(loc)}/elements`,
      value: reordered,
    });
    return { ok: true, slideId: input.slideId, applied: elements.length };
  },
};

// ---------------------------------------------------------------------------
// 6 — bulk_set_alt_text (a11y)
// ---------------------------------------------------------------------------

const bulkSetAltTextInput = z
  .object({
    slideId: z.string().min(1),
    assignments: z
      .array(
        z
          .object({
            elementId: z.string().min(1),
            alt: z.string().max(500),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();
const bulkSetAltTextOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      slideId: z.string(),
      applied: z.array(
        z
          .object({
            elementId: z.string(),
            action: z.enum(['set', 'cleared']),
          })
          .strict(),
      ),
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

const bulkSetAltText: ToolHandler<
  z.infer<typeof bulkSetAltTextInput>,
  z.infer<typeof bulkSetAltTextOutput>,
  MutationContext
> = {
  name: 'bulk_set_alt_text',
  bundle: SLIDE_CM1_BUNDLE_NAME,
  description:
    'A11y: set alt text on multiple image elements in one call. Each assignment targets an image element by id; empty-string `alt` marks the image as decorative (removes the field). Fails atomically — validates every assignment before emitting any patches. Refuses `element_not_found` / `wrong_element_type` with `detail` on first offender.',
  inputSchema: bulkSetAltTextInput,
  outputSchema: bulkSetAltTextOutput,
  handle: (input, ctx) => {
    const loc = locateSlide(ctx, input.slideId);
    if (typeof loc === 'string') return { ok: false, reason: loc };
    // Validate every assignment first — all-or-nothing semantics.
    const targets: Array<{
      elementIndex: number;
      elementId: string;
      alt: string;
      had: boolean;
    }> = [];
    for (const a of input.assignments) {
      const elementIndex = loc.slide.elements.findIndex((e) => e.id === a.elementId);
      if (elementIndex === -1) {
        return {
          ok: false,
          reason: 'element_not_found',
          detail: `unknown element id: ${a.elementId}`,
        };
      }
      const element = loc.slide.elements[elementIndex] as unknown as Record<string, unknown>;
      if (element.type !== 'image') {
        return {
          ok: false,
          reason: 'wrong_element_type',
          detail: `element ${a.elementId} is '${String(element.type)}', not 'image'`,
        };
      }
      targets.push({
        elementIndex,
        elementId: a.elementId,
        alt: a.alt,
        had: 'alt' in element && element.alt !== undefined,
      });
    }
    const applied: Array<{ elementId: string; action: 'set' | 'cleared' }> = [];
    for (const t of targets) {
      const basePath = `${slidePath(loc)}/elements/${t.elementIndex}/alt`;
      if (t.alt.length === 0) {
        if (t.had) {
          ctx.patchSink.push({ op: 'remove', path: basePath });
        }
        applied.push({ elementId: t.elementId, action: 'cleared' });
      } else {
        ctx.patchSink.push({
          op: t.had ? 'replace' : 'add',
          path: basePath,
          value: t.alt,
        });
        applied.push({ elementId: t.elementId, action: 'set' });
      }
    }
    return { ok: true, slideId: input.slideId, applied };
  },
};

// ---------------------------------------------------------------------------
// Barrel
// ---------------------------------------------------------------------------

export const SLIDE_CM1_HANDLERS: readonly ToolHandler<unknown, unknown, MutationContext>[] = [
  setSlideTitle,
  setSlideNotes,
  appendSlideNotes,
  setSlideBackground,
  reorderSlideElements,
  bulkSetAltText,
] as unknown as readonly ToolHandler<unknown, unknown, MutationContext>[];

// ---------------------------------------------------------------------------
// LLM tool definitions
// ---------------------------------------------------------------------------

const nonEmptyString = { type: 'string' as const, minLength: 1 };

export const SLIDE_CM1_TOOL_DEFINITIONS: readonly LLMToolDefinition[] = [
  {
    name: 'set_slide_title',
    description: setSlideTitle.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'title'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        title: { type: 'string', maxLength: 400 },
      },
    },
  },
  {
    name: 'set_slide_notes',
    description: setSlideNotes.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'notes'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        notes: { type: 'string', maxLength: 5000 },
      },
    },
  },
  {
    name: 'append_slide_notes',
    description: appendSlideNotes.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'text'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        text: { type: 'string', minLength: 1 },
        separator: { type: 'string' },
      },
    },
  },
  {
    name: 'set_slide_background',
    description: setSlideBackground.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'background'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        background: {
          description:
            "Background — `{ kind: 'color', value }` or `{ kind: 'asset', value }`, or `null` to clear.",
        },
      },
    },
  },
  {
    name: 'reorder_slide_elements',
    description: reorderSlideElements.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'order'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        order: { type: 'array', minItems: 1, items: nonEmptyString },
      },
    },
  },
  {
    name: 'bulk_set_alt_text',
    description: bulkSetAltText.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'assignments'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        assignments: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['elementId', 'alt'],
            additionalProperties: false,
            properties: {
              elementId: nonEmptyString,
              alt: { type: 'string', maxLength: 500 },
            },
          },
        },
      },
    },
  },
];
