// packages/engine/src/handlers/layout/handlers.ts
// `layout` bundle — 5 write-tier tools for element alignment,
// distribution, grid snap, direct transform edits, and size matching.
// Slide-mode only. All handlers operate on `slide.elements[*].transform`
// and emit per-element `replace` patches.

import type { LLMToolDefinition } from '@stageflip/llm-abstraction';
import { z } from 'zod';
import type { MutationContext, ToolHandler } from '../../router/types.js';

export const LAYOUT_BUNDLE_NAME = 'layout';

interface ElementLocation {
  slideIndex: number;
  elementIndex: number;
  element: {
    id: string;
    transform: {
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
      opacity: number;
    };
  };
}

function locateElements(
  ctx: MutationContext,
  slideId: string,
  elementIds: readonly string[],
): ElementLocation[] | 'wrong_mode' | 'slide_not_found' | 'element_not_found' {
  if (ctx.document.content.mode !== 'slide') return 'wrong_mode';
  const slideIndex = ctx.document.content.slides.findIndex((s) => s.id === slideId);
  if (slideIndex === -1) return 'slide_not_found';
  const slide = ctx.document.content.slides[slideIndex];
  if (!slide) return 'slide_not_found';

  const out: ElementLocation[] = [];
  for (const elementId of elementIds) {
    const elementIndex = slide.elements.findIndex((e) => e.id === elementId);
    if (elementIndex === -1) return 'element_not_found';
    const element = slide.elements[elementIndex];
    if (!element) return 'element_not_found';
    out.push({
      slideIndex,
      elementIndex,
      element: element as unknown as ElementLocation['element'],
    });
  }
  return out;
}

// --- align_elements -------------------------------------------------------

const alignInput = z
  .object({
    slideId: z.string().min(1),
    elementIds: z.array(z.string().min(1)).min(2),
    axis: z.enum(['horizontal', 'vertical']),
    mode: z.enum(['start', 'center', 'end']),
  })
  .strict();
const alignOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      aligned: z.number().int().positive(),
      axis: z.enum(['horizontal', 'vertical']),
      mode: z.enum(['start', 'center', 'end']),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['wrong_mode', 'slide_not_found', 'element_not_found']),
    })
    .strict(),
]);

const alignElements: ToolHandler<
  z.infer<typeof alignInput>,
  z.infer<typeof alignOutput>,
  MutationContext
> = {
  name: 'align_elements',
  bundle: LAYOUT_BUNDLE_NAME,
  description:
    'Align 2+ elements along an axis. `axis=horizontal` + `mode=start` aligns their top edges (y = min y); `mode=center` aligns vertical centers; `mode=end` aligns bottom edges. `axis=vertical` mirrors this for x.',
  inputSchema: alignInput,
  outputSchema: alignOutput,
  handle: (input, ctx) => {
    const located = locateElements(ctx, input.slideId, input.elementIds);
    if (typeof located === 'string') return { ok: false, reason: located };

    const { axis, mode } = input;
    // For axis=horizontal we align on the Y dimension (top/center/bottom).
    // For axis=vertical we align on X (left/center/right). Naming follows
    // "axis of the line the elements sit on".
    const [posKey, sizeKey] =
      axis === 'horizontal' ? (['y', 'height'] as const) : (['x', 'width'] as const);

    const positions = located.map((l) => l.element.transform[posKey]);
    const edges = located.map((l) => l.element.transform[posKey] + l.element.transform[sizeKey]);
    const centers = located.map(
      (l) => l.element.transform[posKey] + l.element.transform[sizeKey] / 2,
    );

    let targetCenter: number;
    let targetStart: number;
    let targetEnd: number;
    if (mode === 'start') {
      targetStart = Math.min(...positions);
      targetEnd = targetStart; // unused
      targetCenter = targetStart; // unused
    } else if (mode === 'end') {
      targetEnd = Math.max(...edges);
      targetStart = targetEnd;
      targetCenter = targetEnd;
    } else {
      // center: pick the midpoint of the bounding extent
      targetCenter = (Math.min(...positions) + Math.max(...edges)) / 2;
      targetStart = targetCenter;
      targetEnd = targetCenter;
    }

    for (const l of located) {
      const size = l.element.transform[sizeKey];
      const newPos =
        mode === 'start'
          ? targetStart
          : mode === 'end'
            ? targetEnd - size
            : targetCenter - size / 2;
      const transform = { ...l.element.transform, [posKey]: newPos };
      ctx.patchSink.push({
        op: 'replace',
        path: `/content/slides/${l.slideIndex}/elements/${l.elementIndex}/transform`,
        value: transform,
      });
    }

    // Keep `centers` referenced for readability + debuggability.
    void centers;

    return { ok: true, aligned: located.length, axis, mode };
  },
};

// --- distribute_elements --------------------------------------------------

const distributeInput = z
  .object({
    slideId: z.string().min(1),
    elementIds: z.array(z.string().min(1)).min(3),
    axis: z.enum(['horizontal', 'vertical']),
  })
  .strict();
const distributeOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      distributed: z.number().int().positive(),
      axis: z.enum(['horizontal', 'vertical']),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['wrong_mode', 'slide_not_found', 'element_not_found']),
    })
    .strict(),
]);

const distributeElements: ToolHandler<
  z.infer<typeof distributeInput>,
  z.infer<typeof distributeOutput>,
  MutationContext
> = {
  name: 'distribute_elements',
  bundle: LAYOUT_BUNDLE_NAME,
  description:
    'Evenly space 3+ elements between the outermost two. `axis=horizontal` distributes along x; `axis=vertical` along y. The outermost elements stay put; middle elements are repositioned so inter-centre gaps are equal.',
  inputSchema: distributeInput,
  outputSchema: distributeOutput,
  handle: (input, ctx) => {
    const located = locateElements(ctx, input.slideId, input.elementIds);
    if (typeof located === 'string') return { ok: false, reason: located };

    const [posKey, sizeKey] =
      input.axis === 'vertical' ? (['x', 'width'] as const) : (['y', 'height'] as const);
    // "horizontal" distribution spreads along y in the current schema
    // convention (axis = the line the elements sit on). Flip here if your
    // mental model is different.

    const sorted = [...located].sort(
      (a, b) =>
        a.element.transform[posKey] +
        a.element.transform[sizeKey] / 2 -
        (b.element.transform[posKey] + b.element.transform[sizeKey] / 2),
    );

    const first = sorted[0];
    const last = sorted.at(-1);
    if (!first || !last) return { ok: false, reason: 'element_not_found' };
    const firstCenter = first.element.transform[posKey] + first.element.transform[sizeKey] / 2;
    const lastCenter = last.element.transform[posKey] + last.element.transform[sizeKey] / 2;
    const span = lastCenter - firstCenter;
    const step = span / (sorted.length - 1);

    for (let i = 1; i < sorted.length - 1; i += 1) {
      const l = sorted[i];
      if (!l) continue;
      const targetCenter = firstCenter + step * i;
      const newPos = targetCenter - l.element.transform[sizeKey] / 2;
      const transform = { ...l.element.transform, [posKey]: newPos };
      ctx.patchSink.push({
        op: 'replace',
        path: `/content/slides/${l.slideIndex}/elements/${l.elementIndex}/transform`,
        value: transform,
      });
    }

    return { ok: true, distributed: located.length, axis: input.axis };
  },
};

// --- snap_to_grid ---------------------------------------------------------

const snapInput = z
  .object({
    slideId: z.string().min(1),
    elementIds: z.array(z.string().min(1)).min(1),
    gridSize: z.number().positive(),
  })
  .strict();
const snapOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      snapped: z.number().int().positive(),
      gridSize: z.number().positive(),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['wrong_mode', 'slide_not_found', 'element_not_found']),
    })
    .strict(),
]);

const snapToGrid: ToolHandler<
  z.infer<typeof snapInput>,
  z.infer<typeof snapOutput>,
  MutationContext
> = {
  name: 'snap_to_grid',
  bundle: LAYOUT_BUNDLE_NAME,
  description:
    "Snap each element's `x` + `y` to the nearest multiple of `gridSize`. Width / height left untouched. `gridSize` is in the document's transform units (typically px against a 1920×1080 reference).",
  inputSchema: snapInput,
  outputSchema: snapOutput,
  handle: (input, ctx) => {
    const located = locateElements(ctx, input.slideId, input.elementIds);
    if (typeof located === 'string') return { ok: false, reason: located };
    const round = (v: number) => Math.round(v / input.gridSize) * input.gridSize;
    for (const l of located) {
      const transform = {
        ...l.element.transform,
        x: round(l.element.transform.x),
        y: round(l.element.transform.y),
      };
      ctx.patchSink.push({
        op: 'replace',
        path: `/content/slides/${l.slideIndex}/elements/${l.elementIndex}/transform`,
        value: transform,
      });
    }
    return { ok: true, snapped: located.length, gridSize: input.gridSize };
  },
};

// --- set_element_transform ------------------------------------------------

const transformPatchSchema = z
  .object({
    x: z.number().finite().optional(),
    y: z.number().finite().optional(),
    width: z.number().finite().positive().optional(),
    height: z.number().finite().positive().optional(),
    rotation: z.number().finite().optional(),
    opacity: z.number().min(0).max(1).optional(),
  })
  .strict();

const setTransformInput = z
  .object({
    slideId: z.string().min(1),
    elementId: z.string().min(1),
    transform: transformPatchSchema,
  })
  .strict();
const setTransformOutput = z.discriminatedUnion('ok', [
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

const setElementTransform: ToolHandler<
  z.infer<typeof setTransformInput>,
  z.infer<typeof setTransformOutput>,
  MutationContext
> = {
  name: 'set_element_transform',
  bundle: LAYOUT_BUNDLE_NAME,
  description:
    "Patch one or more fields on a single element's `transform`. Fields left out remain unchanged. Prefer this over raw `update_element` for geometry edits — this handler always emits per-field `replace` patches so other transform fields survive.",
  inputSchema: setTransformInput,
  outputSchema: setTransformOutput,
  handle: (input, ctx) => {
    const located = locateElements(ctx, input.slideId, [input.elementId]);
    if (typeof located === 'string') return { ok: false, reason: located };
    const l = located[0];
    if (!l) return { ok: false, reason: 'element_not_found' };

    const updated: string[] = [];
    for (const [key, value] of Object.entries(input.transform)) {
      if (value === undefined) continue;
      updated.push(key);
      ctx.patchSink.push({
        op: 'replace',
        path: `/content/slides/${l.slideIndex}/elements/${l.elementIndex}/transform/${key}`,
        value,
      });
    }
    return { ok: true, elementId: input.elementId, updatedFields: updated };
  },
};

// --- match_size -----------------------------------------------------------

const matchSizeInput = z
  .object({
    slideId: z.string().min(1),
    sourceElementId: z.string().min(1),
    targetElementIds: z.array(z.string().min(1)).min(1),
    dimensions: z.enum(['width', 'height', 'both']).optional(),
  })
  .strict();
const matchSizeOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      matched: z.number().int().positive(),
      dimensions: z.enum(['width', 'height', 'both']),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['wrong_mode', 'slide_not_found', 'element_not_found']),
    })
    .strict(),
]);

const matchSize: ToolHandler<
  z.infer<typeof matchSizeInput>,
  z.infer<typeof matchSizeOutput>,
  MutationContext
> = {
  name: 'match_size',
  bundle: LAYOUT_BUNDLE_NAME,
  description:
    "Copy the source element's `width` / `height` / both onto each target element. Position is unchanged. Use after `align_elements` when a row of cards needs uniform sizing.",
  inputSchema: matchSizeInput,
  outputSchema: matchSizeOutput,
  handle: (input, ctx) => {
    const all = locateElements(ctx, input.slideId, [
      input.sourceElementId,
      ...input.targetElementIds,
    ]);
    if (typeof all === 'string') return { ok: false, reason: all };
    const [source, ...targets] = all;
    if (!source || targets.length === 0) return { ok: false, reason: 'element_not_found' };

    const { width, height } = source.element.transform;
    const dimensions = input.dimensions ?? 'both';
    for (const t of targets) {
      if (dimensions === 'width' || dimensions === 'both') {
        ctx.patchSink.push({
          op: 'replace',
          path: `/content/slides/${t.slideIndex}/elements/${t.elementIndex}/transform/width`,
          value: width,
        });
      }
      if (dimensions === 'height' || dimensions === 'both') {
        ctx.patchSink.push({
          op: 'replace',
          path: `/content/slides/${t.slideIndex}/elements/${t.elementIndex}/transform/height`,
          value: height,
        });
      }
    }
    return { ok: true, matched: targets.length, dimensions };
  },
};

// --- barrel ---------------------------------------------------------------

export const LAYOUT_HANDLERS: readonly ToolHandler<unknown, unknown, MutationContext>[] = [
  alignElements,
  distributeElements,
  snapToGrid,
  setElementTransform,
  matchSize,
] as unknown as readonly ToolHandler<unknown, unknown, MutationContext>[];

const nonEmptyString = { type: 'string' as const, minLength: 1 };
const positiveNumber = { type: 'number' as const, exclusiveMinimum: 0 };

export const LAYOUT_TOOL_DEFINITIONS: readonly LLMToolDefinition[] = [
  {
    name: 'align_elements',
    description: alignElements.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'elementIds', 'axis', 'mode'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        elementIds: { type: 'array', minItems: 2, items: nonEmptyString },
        axis: { type: 'string', enum: ['horizontal', 'vertical'] },
        mode: { type: 'string', enum: ['start', 'center', 'end'] },
      },
    },
  },
  {
    name: 'distribute_elements',
    description: distributeElements.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'elementIds', 'axis'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        elementIds: { type: 'array', minItems: 3, items: nonEmptyString },
        axis: { type: 'string', enum: ['horizontal', 'vertical'] },
      },
    },
  },
  {
    name: 'snap_to_grid',
    description: snapToGrid.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'elementIds', 'gridSize'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        elementIds: { type: 'array', minItems: 1, items: nonEmptyString },
        gridSize: positiveNumber,
      },
    },
  },
  {
    name: 'set_element_transform',
    description: setElementTransform.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'elementId', 'transform'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        elementId: nonEmptyString,
        transform: {
          type: 'object',
          additionalProperties: false,
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            width: positiveNumber,
            height: positiveNumber,
            rotation: { type: 'number' },
            opacity: { type: 'number', minimum: 0, maximum: 1 },
          },
        },
      },
    },
  },
  {
    name: 'match_size',
    description: matchSize.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'sourceElementId', 'targetElementIds'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        sourceElementId: nonEmptyString,
        targetElementIds: { type: 'array', minItems: 1, items: nonEmptyString },
        dimensions: { type: 'string', enum: ['width', 'height', 'both'] },
      },
    },
  },
];
