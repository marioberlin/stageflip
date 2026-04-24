// packages/engine/src/handlers/read/handlers.ts
// `read` bundle — 5 read-only tools that let the agent inspect the current
// document without mutating it. Per skills/stageflip/concepts/tool-bundles
// §"The 14 bundles". These handlers carry no write-side concerns; they
// type against DocumentContext (not the wider ExecutorContext) so they can
// be registered into any router whose context extends DocumentContext.

import type { LLMToolDefinition } from '@stageflip/llm-abstraction';
import { z } from 'zod';
import type { DocumentContext, ToolHandler } from '../../router/types.js';

export const READ_BUNDLE_NAME = 'read';

// --- get_document ---------------------------------------------------------

const getDocumentInput = z.object({}).strict();
const getDocumentOutput = z
  .object({
    id: z.string(),
    mode: z.enum(['slide', 'video', 'display']),
    title: z.string().optional(),
    locale: z.string(),
    slideCount: z.number().int().nonnegative().optional(),
    trackCount: z.number().int().nonnegative().optional(),
    sizeCount: z.number().int().nonnegative().optional(),
  })
  .strict();

const getDocumentHandler: ToolHandler<
  z.infer<typeof getDocumentInput>,
  z.infer<typeof getDocumentOutput>,
  DocumentContext
> = {
  name: 'get_document',
  bundle: READ_BUNDLE_NAME,
  description:
    'Return top-level document metadata: id, mode, title, locale, and a mode-specific count (slides / tracks / sizes). Never returns the full document payload.',
  inputSchema: getDocumentInput,
  outputSchema: getDocumentOutput,
  handle: (_input, ctx) => {
    const { meta, content } = ctx.document;
    const base = {
      id: meta.id,
      mode: content.mode,
      locale: meta.locale,
      ...(meta.title !== undefined ? { title: meta.title } : {}),
    };
    switch (content.mode) {
      case 'slide':
        return { ...base, slideCount: content.slides.length };
      case 'video':
        return { ...base, trackCount: content.tracks.length };
      case 'display':
        return { ...base, sizeCount: content.sizes.length };
    }
  },
};

// --- get_slide ------------------------------------------------------------

const getSlideInput = z.object({ slideId: z.string().min(1) }).strict();
const getSlideOutput = z.discriminatedUnion('found', [
  z
    .object({
      found: z.literal(true),
      id: z.string(),
      title: z.string().optional(),
      elementCount: z.number().int().nonnegative(),
      durationMs: z.number().int().positive().optional(),
      hasBackground: z.boolean(),
      hasTransition: z.boolean(),
      hasNotes: z.boolean(),
    })
    .strict(),
  z
    .object({
      found: z.literal(false),
      reason: z.enum(['wrong_mode', 'not_found']),
    })
    .strict(),
]);

const getSlideHandler: ToolHandler<
  z.infer<typeof getSlideInput>,
  z.infer<typeof getSlideOutput>,
  DocumentContext
> = {
  name: 'get_slide',
  bundle: READ_BUNDLE_NAME,
  description:
    'Fetch metadata for a single slide by id: element count, duration, flags for background/transition/notes. Slide-mode only.',
  inputSchema: getSlideInput,
  outputSchema: getSlideOutput,
  handle: ({ slideId }, ctx) => {
    if (ctx.document.content.mode !== 'slide') {
      return { found: false, reason: 'wrong_mode' };
    }
    const slide = ctx.document.content.slides.find((s) => s.id === slideId);
    if (!slide) return { found: false, reason: 'not_found' };
    return {
      found: true,
      id: slide.id,
      ...(slide.title !== undefined ? { title: slide.title } : {}),
      elementCount: slide.elements.length,
      ...(slide.durationMs !== undefined ? { durationMs: slide.durationMs } : {}),
      hasBackground: slide.background !== undefined,
      hasTransition: slide.transition !== undefined,
      hasNotes: slide.notes !== undefined && slide.notes.length > 0,
    };
  },
};

// --- list_elements --------------------------------------------------------

const listElementsInput = z.object({ slideId: z.string().min(1) }).strict();
const elementSummary = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string().optional(),
  visible: z.boolean(),
});
const listElementsOutput = z.discriminatedUnion('found', [
  z
    .object({
      found: z.literal(true),
      slideId: z.string(),
      elements: z.array(elementSummary),
    })
    .strict(),
  z
    .object({
      found: z.literal(false),
      reason: z.enum(['wrong_mode', 'not_found']),
    })
    .strict(),
]);

const listElementsHandler: ToolHandler<
  z.infer<typeof listElementsInput>,
  z.infer<typeof listElementsOutput>,
  DocumentContext
> = {
  name: 'list_elements',
  bundle: READ_BUNDLE_NAME,
  description:
    'List every element on a slide with id, type, optional name, and visibility. Slide-mode only.',
  inputSchema: listElementsInput,
  outputSchema: listElementsOutput,
  handle: ({ slideId }, ctx) => {
    if (ctx.document.content.mode !== 'slide') {
      return { found: false, reason: 'wrong_mode' };
    }
    const slide = ctx.document.content.slides.find((s) => s.id === slideId);
    if (!slide) return { found: false, reason: 'not_found' };
    return {
      found: true,
      slideId,
      elements: slide.elements.map((el) => ({
        id: el.id,
        type: el.type,
        ...(el.name !== undefined ? { name: el.name } : {}),
        visible: el.visible,
      })),
    };
  },
};

// --- describe_selection ---------------------------------------------------

const describeSelectionInput = z.object({}).strict();
const describeSelectionOutput = z.object({
  slideId: z.string().optional(),
  selectedIds: z.array(z.string()),
  elements: z.array(elementSummary),
});

const describeSelectionHandler: ToolHandler<
  z.infer<typeof describeSelectionInput>,
  z.infer<typeof describeSelectionOutput>,
  DocumentContext
> = {
  name: 'describe_selection',
  bundle: READ_BUNDLE_NAME,
  description:
    'Describe the elements the user currently has selected in the editor. Returns empty arrays when nothing is selected.',
  inputSchema: describeSelectionInput,
  outputSchema: describeSelectionOutput,
  handle: (_input, ctx) => {
    const sel = ctx.selection;
    if (!sel) return { selectedIds: [], elements: [] };

    const selectedIds = [...sel.elementIds];
    if (ctx.document.content.mode !== 'slide') {
      return {
        ...(sel.slideId !== undefined ? { slideId: sel.slideId } : {}),
        selectedIds,
        elements: [],
      };
    }
    const slide = sel.slideId
      ? ctx.document.content.slides.find((s) => s.id === sel.slideId)
      : undefined;
    const pool = slide ? slide.elements : ctx.document.content.slides.flatMap((s) => s.elements);
    const picked = pool
      .filter((el) => selectedIds.includes(el.id))
      .map((el) => ({
        id: el.id,
        type: el.type,
        ...(el.name !== undefined ? { name: el.name } : {}),
        visible: el.visible,
      }));
    return {
      ...(sel.slideId !== undefined ? { slideId: sel.slideId } : {}),
      selectedIds,
      elements: picked,
    };
  },
};

// --- get_theme ------------------------------------------------------------

const getThemeInput = z.object({}).strict();
const getThemeOutput = z.object({
  palette: z.record(z.string()),
  tokens: z.record(z.union([z.string(), z.number()])),
});

const getThemeHandler: ToolHandler<
  z.infer<typeof getThemeInput>,
  z.infer<typeof getThemeOutput>,
  DocumentContext
> = {
  name: 'get_theme',
  bundle: READ_BUNDLE_NAME,
  description:
    'Return the theme — named palette entries (primary / secondary / etc.) plus dotted-path design tokens. Small payload; safe to call whenever the model needs to reason about brand colours or token values.',
  inputSchema: getThemeInput,
  outputSchema: getThemeOutput,
  handle: (_input, ctx) => {
    const palette: Record<string, string> = {};
    const entries = ctx.document.theme.palette ?? {};
    for (const [key, value] of Object.entries(entries)) {
      if (typeof value === 'string') palette[key] = value;
    }
    return {
      palette,
      tokens: { ...ctx.document.theme.tokens } as Record<string, string | number>,
    };
  },
};

// --- barrel ---------------------------------------------------------------

export const READ_HANDLERS: readonly ToolHandler<unknown, unknown, DocumentContext>[] = [
  getDocumentHandler,
  getSlideHandler,
  listElementsHandler,
  describeSelectionHandler,
  getThemeHandler,
] as unknown as readonly ToolHandler<unknown, unknown, DocumentContext>[];

/**
 * LLM-facing JSONSchema tool definitions. Hand-authored to mirror the Zod
 * input schemas above — drift is enforced structurally (register both on
 * the registry + router) and by the registerReadBundle smoke test.
 */
export const READ_TOOL_DEFINITIONS: readonly LLMToolDefinition[] = [
  {
    name: 'get_document',
    description: getDocumentHandler.description,
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_slide',
    description: getSlideHandler.description,
    input_schema: {
      type: 'object',
      required: ['slideId'],
      additionalProperties: false,
      properties: {
        slideId: { type: 'string', minLength: 1, description: 'Target slide id.' },
      },
    },
  },
  {
    name: 'list_elements',
    description: listElementsHandler.description,
    input_schema: {
      type: 'object',
      required: ['slideId'],
      additionalProperties: false,
      properties: {
        slideId: { type: 'string', minLength: 1, description: 'Target slide id.' },
      },
    },
  },
  {
    name: 'describe_selection',
    description: describeSelectionHandler.description,
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_theme',
    description: getThemeHandler.description,
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
];
