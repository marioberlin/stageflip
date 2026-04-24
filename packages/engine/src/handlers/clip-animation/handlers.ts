// packages/engine/src/handlers/clip-animation/handlers.ts
// `clip-animation` bundle — 14 write-tier tools for clip-element props
// and animations attached to any element. Slide-mode only. Handlers
// type against `MutationContext`; all mutations flow through
// `ctx.patchSink.push(op)` as JSON-Patch ops. The Executor drains the
// sink + applies + re-reads between tool calls, so chained edits in one
// plan step see the previous mutation.

import type { LLMToolDefinition } from '@stageflip/llm-abstraction';
import {
  animationKindSchema,
  animationSchema,
  easingSchema,
  fontRequirementSchema,
  keyframeSchema,
  timingPrimitiveSchema,
  transformSchema,
} from '@stageflip/schema';
import { z } from 'zod';
import type { MutationContext, ToolHandler } from '../../router/types.js';
import { nextElementId } from '../create-mutate/ids.js';

export const CLIP_ANIMATION_BUNDLE_NAME = 'clip-animation';

// ---------------------------------------------------------------------------
// Shared locators + helpers
// ---------------------------------------------------------------------------

type LocateFail =
  | 'wrong_mode'
  | 'slide_not_found'
  | 'element_not_found'
  | 'not_a_clip'
  | 'animation_not_found';

interface ElementLocation {
  slideIndex: number;
  elementIndex: number;
  element: {
    id: string;
    type: string;
    animations?: readonly AnimationShape[];
  } & Record<string, unknown>;
}

interface AnimationShape {
  id: string;
  timing: unknown;
  animation: { kind: string } & Record<string, unknown>;
  autoplay?: boolean;
}

function locateElement(
  ctx: MutationContext,
  slideId: string,
  elementId: string,
): ElementLocation | Exclude<LocateFail, 'not_a_clip' | 'animation_not_found'> {
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

function findAnimationIndex(el: ElementLocation['element'], animationId: string): number {
  const animations = (el.animations ?? []) as readonly AnimationShape[];
  return animations.findIndex((a) => a.id === animationId);
}

function elementPath(loc: ElementLocation): string {
  return `/content/slides/${loc.slideIndex}/elements/${loc.elementIndex}`;
}

function nextAnimationId(el: ElementLocation['element']): string {
  const animations = (el.animations ?? []) as readonly AnimationShape[];
  const needle = 'anim-';
  let max = 0;
  for (const a of animations) {
    if (!a.id.startsWith(needle)) continue;
    const tail = a.id.slice(needle.length);
    if (!/^\d+$/.test(tail)) continue;
    const n = Number.parseInt(tail, 10);
    if (n > max) max = n;
  }
  return `${needle}${max + 1}`;
}

// ---------------------------------------------------------------------------
// 1 — add_clip_element
// ---------------------------------------------------------------------------

const addClipInput = z
  .object({
    slideId: z.string().min(1),
    runtime: z.string().min(1),
    clipName: z.string().min(1),
    params: z.record(z.unknown()).optional(),
    transform: transformSchema.optional(),
    name: z.string().min(1).max(200).optional(),
    fonts: z.array(fontRequirementSchema).optional(),
    position: z.number().int().nonnegative().optional(),
  })
  .strict();
const addClipOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      elementId: z.string(),
      slideId: z.string(),
      position: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['wrong_mode', 'slide_not_found']),
    })
    .strict(),
]);

// `transformSchema` + `fontRequirementSchema` carry inner `.default()`s,
// which cause Zod's `_input` to diverge from `_output` and break the
// `z.ZodType<TInput>` constraint on `ToolHandler`. We cast through
// `z.ZodType<z.infer<...>>` at assignment — same pattern `elementSchema`
// uses in `@stageflip/schema`.
type AddClipInput = z.infer<typeof addClipInput>;
type AddClipOutput = z.infer<typeof addClipOutput>;

const addClipElement: ToolHandler<AddClipInput, AddClipOutput, MutationContext> = {
  name: 'add_clip_element',
  bundle: CLIP_ANIMATION_BUNDLE_NAME,
  description:
    'Insert a new clip element on a slide. Clip-specific shortcut over `add_element`: caller supplies only `runtime` / `clipName` / `params`, the handler fills in defaults for `visible` / `locked` / `animations` / `transform`. Element id is auto-generated as `clip-<n>`.',
  inputSchema: addClipInput as unknown as z.ZodType<AddClipInput>,
  outputSchema: addClipOutput,
  handle: (input, ctx) => {
    if (ctx.document.content.mode !== 'slide') return { ok: false, reason: 'wrong_mode' };
    const slideIndex = ctx.document.content.slides.findIndex((s) => s.id === input.slideId);
    if (slideIndex === -1) return { ok: false, reason: 'slide_not_found' };
    const slide = ctx.document.content.slides[slideIndex];
    if (!slide) return { ok: false, reason: 'slide_not_found' };

    const elementId = nextElementId(ctx.document, 'clip');
    const element: Record<string, unknown> = {
      id: elementId,
      type: 'clip',
      runtime: input.runtime,
      clipName: input.clipName,
      params: input.params ?? {},
      transform: input.transform ?? {
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
        rotation: 0,
        opacity: 1,
      },
      visible: true,
      locked: false,
      animations: [],
    };
    if (input.name !== undefined) element.name = input.name;
    if (input.fonts !== undefined) element.fonts = input.fonts;

    const elements = slide.elements;
    const insertAt = Math.min(input.position ?? elements.length, elements.length);
    ctx.patchSink.push({
      op: 'add',
      path: `/content/slides/${slideIndex}/elements/${insertAt === elements.length ? '-' : insertAt}`,
      value: element,
    });
    return { ok: true, elementId, slideId: input.slideId, position: insertAt };
  },
};

// ---------------------------------------------------------------------------
// 2 — update_clip_element
// ---------------------------------------------------------------------------

const updateClipInput = z
  .object({
    slideId: z.string().min(1),
    elementId: z.string().min(1),
    runtime: z.string().min(1).optional(),
    clipName: z.string().min(1).optional(),
    params: z.record(z.unknown()).optional(),
    fonts: z.array(fontRequirementSchema).optional(),
  })
  .strict();
const updateClipOutput = z.discriminatedUnion('ok', [
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
      reason: z.enum(['wrong_mode', 'slide_not_found', 'element_not_found', 'not_a_clip']),
    })
    .strict(),
]);

type UpdateClipInput = z.infer<typeof updateClipInput>;
type UpdateClipOutput = z.infer<typeof updateClipOutput>;

const updateClipElement: ToolHandler<UpdateClipInput, UpdateClipOutput, MutationContext> = {
  name: 'update_clip_element',
  bundle: CLIP_ANIMATION_BUNDLE_NAME,
  description:
    "Replace top-level fields on an existing clip element (`runtime`, `clipName`, `params`, `fonts`). Fields left out remain unchanged. `params` and `fonts` are replaced wholesale; use `set_clip_params` for a partial-merge of `params`. Refuses with `not_a_clip` if the element's `type` isn't `clip`.",
  inputSchema: updateClipInput as unknown as z.ZodType<UpdateClipInput>,
  outputSchema: updateClipOutput,
  handle: (input, ctx) => {
    const loc = locateElement(ctx, input.slideId, input.elementId);
    if (typeof loc === 'string') return { ok: false, reason: loc };
    if (loc.element.type !== 'clip') return { ok: false, reason: 'not_a_clip' };

    const updated: string[] = [];
    for (const field of ['runtime', 'clipName', 'params', 'fonts'] as const) {
      const value = input[field];
      if (value === undefined) continue;
      updated.push(field);
      ctx.patchSink.push({
        op: 'replace',
        path: `${elementPath(loc)}/${field}`,
        value,
      });
    }
    return { ok: true, elementId: input.elementId, updatedFields: updated };
  },
};

// ---------------------------------------------------------------------------
// 3 — set_clip_params
// ---------------------------------------------------------------------------

const setClipParamsInput = z
  .object({
    slideId: z.string().min(1),
    elementId: z.string().min(1),
    merge: z.record(z.unknown()).optional(),
    remove: z.array(z.string().min(1)).optional(),
  })
  .strict();
const setClipParamsOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      elementId: z.string(),
      mergedKeys: z.array(z.string()),
      removedKeys: z.array(z.string()),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['wrong_mode', 'slide_not_found', 'element_not_found', 'not_a_clip']),
    })
    .strict(),
]);

const setClipParams: ToolHandler<
  z.infer<typeof setClipParamsInput>,
  z.infer<typeof setClipParamsOutput>,
  MutationContext
> = {
  name: 'set_clip_params',
  bundle: CLIP_ANIMATION_BUNDLE_NAME,
  description:
    "Partial-merge edit on a clip element's `params` object. `merge` sets/replaces values at individual keys; `remove` deletes keys. Use this instead of `update_clip_element` when you only want to tweak one or two params without rewriting the whole object. Refuses with `not_a_clip` if the element's `type` isn't `clip`.",
  inputSchema: setClipParamsInput,
  outputSchema: setClipParamsOutput,
  handle: (input, ctx) => {
    const loc = locateElement(ctx, input.slideId, input.elementId);
    if (typeof loc === 'string') return { ok: false, reason: loc };
    if (loc.element.type !== 'clip') return { ok: false, reason: 'not_a_clip' };

    const paramsPath = `${elementPath(loc)}/params`;
    const mergedKeys: string[] = [];
    const removedKeys: string[] = [];
    const existing = (loc.element.params ?? {}) as Record<string, unknown>;

    if (input.merge) {
      for (const [key, value] of Object.entries(input.merge)) {
        mergedKeys.push(key);
        const op = key in existing ? 'replace' : 'add';
        ctx.patchSink.push({
          op,
          path: `${paramsPath}/${encodePointerSegment(key)}`,
          value,
        });
      }
    }
    if (input.remove) {
      for (const key of input.remove) {
        if (!(key in existing)) continue;
        removedKeys.push(key);
        ctx.patchSink.push({
          op: 'remove',
          path: `${paramsPath}/${encodePointerSegment(key)}`,
        });
      }
    }
    return {
      ok: true,
      elementId: input.elementId,
      mergedKeys,
      removedKeys,
    };
  },
};

// JSON-Pointer segment encoding (RFC 6901): ~ → ~0, / → ~1. Param keys are
// author-supplied strings; encode defensively.
function encodePointerSegment(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

// ---------------------------------------------------------------------------
// 4 — add_animation
// ---------------------------------------------------------------------------

const addAnimationInput = z
  .object({
    slideId: z.string().min(1),
    elementId: z.string().min(1),
    animation: animationKindSchema,
    timing: timingPrimitiveSchema,
    autoplay: z.boolean().optional(),
    id: z.string().min(1).optional(),
    position: z.number().int().nonnegative().optional(),
  })
  .strict();
const addAnimationOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      animationId: z.string(),
      elementId: z.string(),
      position: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['wrong_mode', 'slide_not_found', 'element_not_found']),
    })
    .strict(),
]);

type AddAnimationInput = z.infer<typeof addAnimationInput>;
type AddAnimationOutput = z.infer<typeof addAnimationOutput>;

const addAnimation: ToolHandler<AddAnimationInput, AddAnimationOutput, MutationContext> = {
  name: 'add_animation',
  bundle: CLIP_ANIMATION_BUNDLE_NAME,
  description:
    'Attach a new animation to any element. Caller provides the inner kind-specific `animation` object (fade / slide / scale / rotate / color / keyframed / runtime) plus a `timing` primitive. Animation id is auto-generated as `anim-<n>` when omitted; if a caller-supplied id collides, a fresh one is assigned. `position` inserts at an index; default is the end of the array.',
  inputSchema: addAnimationInput as unknown as z.ZodType<AddAnimationInput>,
  outputSchema: addAnimationOutput,
  handle: (input, ctx) => {
    const loc = locateElement(ctx, input.slideId, input.elementId);
    if (typeof loc === 'string') return { ok: false, reason: loc };

    const animations = (loc.element.animations ?? []) as readonly AnimationShape[];
    const existingIds = new Set(animations.map((a) => a.id));
    const id =
      input.id !== undefined && !existingIds.has(input.id)
        ? input.id
        : nextAnimationId(loc.element);

    const animation: Record<string, unknown> = {
      id,
      timing: input.timing,
      animation: input.animation,
      autoplay: input.autoplay ?? true,
    };

    const insertAt = Math.min(input.position ?? animations.length, animations.length);
    ctx.patchSink.push({
      op: 'add',
      path: `${elementPath(loc)}/animations/${insertAt === animations.length ? '-' : insertAt}`,
      value: animation,
    });
    return {
      ok: true,
      animationId: id,
      elementId: input.elementId,
      position: insertAt,
    };
  },
};

// ---------------------------------------------------------------------------
// 5 — remove_animation
// ---------------------------------------------------------------------------

const removeAnimationInput = z
  .object({
    slideId: z.string().min(1),
    elementId: z.string().min(1),
    animationId: z.string().min(1),
  })
  .strict();
const removeAnimationOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      animationId: z.string(),
      elementId: z.string(),
      remainingCount: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['wrong_mode', 'slide_not_found', 'element_not_found', 'animation_not_found']),
    })
    .strict(),
]);

const removeAnimation: ToolHandler<
  z.infer<typeof removeAnimationInput>,
  z.infer<typeof removeAnimationOutput>,
  MutationContext
> = {
  name: 'remove_animation',
  bundle: CLIP_ANIMATION_BUNDLE_NAME,
  description: 'Remove a single animation from an element by animation id.',
  inputSchema: removeAnimationInput,
  outputSchema: removeAnimationOutput,
  handle: (input, ctx) => {
    const loc = locateElement(ctx, input.slideId, input.elementId);
    if (typeof loc === 'string') return { ok: false, reason: loc };
    const animIndex = findAnimationIndex(loc.element, input.animationId);
    if (animIndex === -1) return { ok: false, reason: 'animation_not_found' };
    const animations = (loc.element.animations ?? []) as readonly AnimationShape[];
    ctx.patchSink.push({
      op: 'remove',
      path: `${elementPath(loc)}/animations/${animIndex}`,
    });
    return {
      ok: true,
      animationId: input.animationId,
      elementId: input.elementId,
      remainingCount: animations.length - 1,
    };
  },
};

// ---------------------------------------------------------------------------
// 6 — clear_animations
// ---------------------------------------------------------------------------

const clearAnimationsInput = z
  .object({
    slideId: z.string().min(1),
    elementId: z.string().min(1),
  })
  .strict();
const clearAnimationsOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      elementId: z.string(),
      cleared: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['wrong_mode', 'slide_not_found', 'element_not_found']),
    })
    .strict(),
]);

const clearAnimations: ToolHandler<
  z.infer<typeof clearAnimationsInput>,
  z.infer<typeof clearAnimationsOutput>,
  MutationContext
> = {
  name: 'clear_animations',
  bundle: CLIP_ANIMATION_BUNDLE_NAME,
  description:
    'Remove every animation from an element in a single `replace` op. `cleared` reports how many animations were present before the reset (0 is valid).',
  inputSchema: clearAnimationsInput,
  outputSchema: clearAnimationsOutput,
  handle: (input, ctx) => {
    const loc = locateElement(ctx, input.slideId, input.elementId);
    if (typeof loc === 'string') return { ok: false, reason: loc };
    const animations = (loc.element.animations ?? []) as readonly AnimationShape[];
    ctx.patchSink.push({
      op: 'replace',
      path: `${elementPath(loc)}/animations`,
      value: [],
    });
    return { ok: true, elementId: input.elementId, cleared: animations.length };
  },
};

// ---------------------------------------------------------------------------
// 7 — replace_animation
// ---------------------------------------------------------------------------

const replaceAnimationInput = z
  .object({
    slideId: z.string().min(1),
    elementId: z.string().min(1),
    animationId: z.string().min(1),
    animation: animationSchema,
  })
  .strict();
const replaceAnimationOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      animationId: z.string(),
      elementId: z.string(),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum([
        'wrong_mode',
        'slide_not_found',
        'element_not_found',
        'animation_not_found',
        'mismatched_ids',
      ]),
      detail: z.string().optional(),
    })
    .strict(),
]);

type ReplaceAnimationInput = z.infer<typeof replaceAnimationInput>;
type ReplaceAnimationOutput = z.infer<typeof replaceAnimationOutput>;

const replaceAnimation: ToolHandler<
  ReplaceAnimationInput,
  ReplaceAnimationOutput,
  MutationContext
> = {
  name: 'replace_animation',
  bundle: CLIP_ANIMATION_BUNDLE_NAME,
  description:
    "Wholesale-replace an existing animation by id. The new animation's `id` must equal `animationId` (use delete + add to change the id). Use this to swap animation kinds (e.g. fade → keyframed).",
  inputSchema: replaceAnimationInput as unknown as z.ZodType<ReplaceAnimationInput>,
  outputSchema: replaceAnimationOutput,
  handle: (input, ctx) => {
    const loc = locateElement(ctx, input.slideId, input.elementId);
    if (typeof loc === 'string') return { ok: false, reason: loc };
    const animIndex = findAnimationIndex(loc.element, input.animationId);
    if (animIndex === -1) return { ok: false, reason: 'animation_not_found' };
    if (input.animation.id !== input.animationId) {
      return {
        ok: false,
        reason: 'mismatched_ids',
        detail: `animation.id '${input.animation.id}' does not match animationId '${input.animationId}'`,
      };
    }
    ctx.patchSink.push({
      op: 'replace',
      path: `${elementPath(loc)}/animations/${animIndex}`,
      value: input.animation,
    });
    return { ok: true, animationId: input.animationId, elementId: input.elementId };
  },
};

// ---------------------------------------------------------------------------
// 8 — reorder_animations
// ---------------------------------------------------------------------------

const reorderAnimationsInput = z
  .object({
    slideId: z.string().min(1),
    elementId: z.string().min(1),
    order: z.array(z.string().min(1)).min(1),
  })
  .strict();
const reorderAnimationsOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      elementId: z.string(),
      applied: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum([
        'wrong_mode',
        'slide_not_found',
        'element_not_found',
        'mismatched_ids',
        'mismatched_count',
      ]),
      detail: z.string().optional(),
    })
    .strict(),
]);

const reorderAnimations: ToolHandler<
  z.infer<typeof reorderAnimationsInput>,
  z.infer<typeof reorderAnimationsOutput>,
  MutationContext
> = {
  name: 'reorder_animations',
  bundle: CLIP_ANIMATION_BUNDLE_NAME,
  description:
    "Replace the element's animation order. `order` must contain every existing animation id exactly once. Emits a single `replace` op on the element's `animations` array. The RIR compiler resolves animations in array order at timing-flatten, so this reorder directly affects render ordering.",
  inputSchema: reorderAnimationsInput,
  outputSchema: reorderAnimationsOutput,
  handle: (input, ctx) => {
    const loc = locateElement(ctx, input.slideId, input.elementId);
    if (typeof loc === 'string') return { ok: false, reason: loc };
    const animations = (loc.element.animations ?? []) as readonly AnimationShape[];
    if (input.order.length !== animations.length) {
      return {
        ok: false,
        reason: 'mismatched_count',
        detail: `order had ${input.order.length} ids; element has ${animations.length} animations`,
      };
    }
    const currentSet = new Set(animations.map((a) => a.id));
    const orderSet = new Set(input.order);
    if (orderSet.size !== input.order.length) {
      return { ok: false, reason: 'mismatched_ids', detail: 'order contains duplicates' };
    }
    for (const id of input.order) {
      if (!currentSet.has(id)) {
        return { ok: false, reason: 'mismatched_ids', detail: `unknown animation id: ${id}` };
      }
    }
    const byId = new Map(animations.map((a) => [a.id, a]));
    const reordered = input.order.map((id) => byId.get(id));
    ctx.patchSink.push({
      op: 'replace',
      path: `${elementPath(loc)}/animations`,
      value: reordered,
    });
    return { ok: true, elementId: input.elementId, applied: animations.length };
  },
};

// ---------------------------------------------------------------------------
// 9 — set_animation_timing
// ---------------------------------------------------------------------------

const setAnimationTimingInput = z
  .object({
    slideId: z.string().min(1),
    elementId: z.string().min(1),
    animationId: z.string().min(1),
    timing: timingPrimitiveSchema,
  })
  .strict();
const setAnimationTimingOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      animationId: z.string(),
      kind: z.enum(['absolute', 'relative', 'anchored', 'beat', 'event']),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['wrong_mode', 'slide_not_found', 'element_not_found', 'animation_not_found']),
    })
    .strict(),
]);

type SetAnimationTimingInput = z.infer<typeof setAnimationTimingInput>;
type SetAnimationTimingOutput = z.infer<typeof setAnimationTimingOutput>;

const setAnimationTiming: ToolHandler<
  SetAnimationTimingInput,
  SetAnimationTimingOutput,
  MutationContext
> = {
  name: 'set_animation_timing',
  bundle: CLIP_ANIMATION_BUNDLE_NAME,
  description:
    'Replace the timing primitive on an animation. Any of the five B1–B5 kinds (`absolute` / `relative` / `anchored` / `beat` / `event`) is accepted; the router validates the payload against `timingPrimitiveSchema`.',
  inputSchema: setAnimationTimingInput as unknown as z.ZodType<SetAnimationTimingInput>,
  outputSchema: setAnimationTimingOutput,
  handle: (input, ctx) => {
    const loc = locateElement(ctx, input.slideId, input.elementId);
    if (typeof loc === 'string') return { ok: false, reason: loc };
    const animIndex = findAnimationIndex(loc.element, input.animationId);
    if (animIndex === -1) return { ok: false, reason: 'animation_not_found' };
    ctx.patchSink.push({
      op: 'replace',
      path: `${elementPath(loc)}/animations/${animIndex}/timing`,
      value: input.timing,
    });
    return { ok: true, animationId: input.animationId, kind: input.timing.kind };
  },
};

// ---------------------------------------------------------------------------
// 10 — set_animation_easing
// ---------------------------------------------------------------------------

const EASED_ANIMATION_KINDS = ['fade', 'slide', 'scale', 'rotate', 'color'] as const;
type EasedAnimationKind = (typeof EASED_ANIMATION_KINDS)[number];

const setAnimationEasingInput = z
  .object({
    slideId: z.string().min(1),
    elementId: z.string().min(1),
    animationId: z.string().min(1),
    easing: easingSchema,
  })
  .strict();
const setAnimationEasingOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      animationId: z.string(),
      animationKind: z.enum(EASED_ANIMATION_KINDS),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum([
        'wrong_mode',
        'slide_not_found',
        'element_not_found',
        'animation_not_found',
        'wrong_animation_kind',
      ]),
      detail: z.string().optional(),
    })
    .strict(),
]);

type SetAnimationEasingInput = z.infer<typeof setAnimationEasingInput>;
type SetAnimationEasingOutput = z.infer<typeof setAnimationEasingOutput>;

const setAnimationEasing: ToolHandler<
  SetAnimationEasingInput,
  SetAnimationEasingOutput,
  MutationContext
> = {
  name: 'set_animation_easing',
  bundle: CLIP_ANIMATION_BUNDLE_NAME,
  description:
    'Replace the `easing` on a fade / slide / scale / rotate / color animation. Refuses with `wrong_animation_kind` for `keyframed` (easing lives per-keyframe) and `runtime` (opaque to engine). Easing payload can be a named keyword, cubic-bezier, spring, or steps.',
  inputSchema: setAnimationEasingInput as unknown as z.ZodType<SetAnimationEasingInput>,
  outputSchema: setAnimationEasingOutput,
  handle: (input, ctx) => {
    const loc = locateElement(ctx, input.slideId, input.elementId);
    if (typeof loc === 'string') return { ok: false, reason: loc };
    const animIndex = findAnimationIndex(loc.element, input.animationId);
    if (animIndex === -1) return { ok: false, reason: 'animation_not_found' };
    const animations = (loc.element.animations ?? []) as readonly AnimationShape[];
    const current = animations[animIndex];
    if (!current) return { ok: false, reason: 'animation_not_found' };
    const kind = current.animation.kind as EasedAnimationKind | 'keyframed' | 'runtime';
    if (kind === 'keyframed' || kind === 'runtime') {
      return {
        ok: false,
        reason: 'wrong_animation_kind',
        detail: `easing not supported on '${kind}' animations`,
      };
    }
    ctx.patchSink.push({
      op: 'replace',
      path: `${elementPath(loc)}/animations/${animIndex}/animation/easing`,
      value: input.easing,
    });
    return { ok: true, animationId: input.animationId, animationKind: kind };
  },
};

// ---------------------------------------------------------------------------
// 11 — set_animation_autoplay
// ---------------------------------------------------------------------------

const setAnimationAutoplayInput = z
  .object({
    slideId: z.string().min(1),
    elementId: z.string().min(1),
    animationId: z.string().min(1),
    autoplay: z.boolean(),
  })
  .strict();
const setAnimationAutoplayOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      animationId: z.string(),
      autoplay: z.boolean(),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['wrong_mode', 'slide_not_found', 'element_not_found', 'animation_not_found']),
    })
    .strict(),
]);

const setAnimationAutoplay: ToolHandler<
  z.infer<typeof setAnimationAutoplayInput>,
  z.infer<typeof setAnimationAutoplayOutput>,
  MutationContext
> = {
  name: 'set_animation_autoplay',
  bundle: CLIP_ANIMATION_BUNDLE_NAME,
  description:
    "Set the animation's `autoplay` boolean. `false` stages the animation but leaves its visual parked until a runtime `resume` event fires.",
  inputSchema: setAnimationAutoplayInput,
  outputSchema: setAnimationAutoplayOutput,
  handle: (input, ctx) => {
    const loc = locateElement(ctx, input.slideId, input.elementId);
    if (typeof loc === 'string') return { ok: false, reason: loc };
    const animIndex = findAnimationIndex(loc.element, input.animationId);
    if (animIndex === -1) return { ok: false, reason: 'animation_not_found' };
    ctx.patchSink.push({
      op: 'replace',
      path: `${elementPath(loc)}/animations/${animIndex}/autoplay`,
      value: input.autoplay,
    });
    return { ok: true, animationId: input.animationId, autoplay: input.autoplay };
  },
};

// ---------------------------------------------------------------------------
// 12 — set_animation_kind_params
// ---------------------------------------------------------------------------

const setAnimationKindParamsInput = z
  .object({
    slideId: z.string().min(1),
    elementId: z.string().min(1),
    animationId: z.string().min(1),
    updates: z.record(z.unknown()),
  })
  .strict();
const setAnimationKindParamsOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      animationId: z.string(),
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
        'animation_not_found',
        'rejected_fields',
      ]),
      detail: z.string().optional(),
    })
    .strict(),
]);

const KIND_PARAMS_FORBIDDEN_FIELDS = new Set(['kind']);

const setAnimationKindParams: ToolHandler<
  z.infer<typeof setAnimationKindParamsInput>,
  z.infer<typeof setAnimationKindParamsOutput>,
  MutationContext
> = {
  name: 'set_animation_kind_params',
  bundle: CLIP_ANIMATION_BUNDLE_NAME,
  description:
    'Partial-merge into the inner `animation` object (the kind-specific params — `from`, `to`, `direction`, `distance`, `fromDegrees`, etc.). Cannot change `kind` — use `replace_animation` for that. Each update becomes one `replace` op on `.../animation/<field>`.',
  inputSchema: setAnimationKindParamsInput,
  outputSchema: setAnimationKindParamsOutput,
  handle: (input, ctx) => {
    const loc = locateElement(ctx, input.slideId, input.elementId);
    if (typeof loc === 'string') return { ok: false, reason: loc };
    const animIndex = findAnimationIndex(loc.element, input.animationId);
    if (animIndex === -1) return { ok: false, reason: 'animation_not_found' };

    const rejected: string[] = [];
    const allowed: string[] = [];
    for (const key of Object.keys(input.updates)) {
      if (KIND_PARAMS_FORBIDDEN_FIELDS.has(key)) rejected.push(key);
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
        path: `${elementPath(loc)}/animations/${animIndex}/animation/${encodePointerSegment(key)}`,
        value: input.updates[key],
      });
    }
    return { ok: true, animationId: input.animationId, updatedFields: allowed };
  },
};

// ---------------------------------------------------------------------------
// 13 — add_keyframe
// ---------------------------------------------------------------------------

const addKeyframeInput = z
  .object({
    slideId: z.string().min(1),
    elementId: z.string().min(1),
    animationId: z.string().min(1),
    keyframe: keyframeSchema,
    position: z.number().int().nonnegative().optional(),
  })
  .strict();
const addKeyframeOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      animationId: z.string(),
      position: z.number().int().nonnegative(),
      keyframeCount: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum([
        'wrong_mode',
        'slide_not_found',
        'element_not_found',
        'animation_not_found',
        'wrong_animation_kind',
      ]),
      detail: z.string().optional(),
    })
    .strict(),
]);

type AddKeyframeInput = z.infer<typeof addKeyframeInput>;
type AddKeyframeOutput = z.infer<typeof addKeyframeOutput>;

const addKeyframe: ToolHandler<AddKeyframeInput, AddKeyframeOutput, MutationContext> = {
  name: 'add_keyframe',
  bundle: CLIP_ANIMATION_BUNDLE_NAME,
  description:
    "Insert a keyframe into a `keyframed` animation's `keyframes` array. `position` defaults to the end. `at` in the keyframe is 0..1 over the animation duration (Zod-validated). Refuses with `wrong_animation_kind` if the animation isn't `keyframed`.",
  inputSchema: addKeyframeInput as unknown as z.ZodType<AddKeyframeInput>,
  outputSchema: addKeyframeOutput,
  handle: (input, ctx) => {
    const loc = locateElement(ctx, input.slideId, input.elementId);
    if (typeof loc === 'string') return { ok: false, reason: loc };
    const animIndex = findAnimationIndex(loc.element, input.animationId);
    if (animIndex === -1) return { ok: false, reason: 'animation_not_found' };
    const animations = (loc.element.animations ?? []) as readonly AnimationShape[];
    const current = animations[animIndex];
    if (!current) return { ok: false, reason: 'animation_not_found' };
    if (current.animation.kind !== 'keyframed') {
      return {
        ok: false,
        reason: 'wrong_animation_kind',
        detail: `add_keyframe requires kind='keyframed'; got '${current.animation.kind}'`,
      };
    }
    const keyframes = (current.animation.keyframes ?? []) as readonly unknown[];
    const insertAt = Math.min(input.position ?? keyframes.length, keyframes.length);
    ctx.patchSink.push({
      op: 'add',
      path: `${elementPath(loc)}/animations/${animIndex}/animation/keyframes/${insertAt === keyframes.length ? '-' : insertAt}`,
      value: input.keyframe,
    });
    return {
      ok: true,
      animationId: input.animationId,
      position: insertAt,
      keyframeCount: keyframes.length + 1,
    };
  },
};

// ---------------------------------------------------------------------------
// 14 — remove_keyframe
// ---------------------------------------------------------------------------

const removeKeyframeInput = z
  .object({
    slideId: z.string().min(1),
    elementId: z.string().min(1),
    animationId: z.string().min(1),
    index: z.number().int().nonnegative(),
  })
  .strict();
const removeKeyframeOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      animationId: z.string(),
      removedIndex: z.number().int().nonnegative(),
      keyframeCount: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum([
        'wrong_mode',
        'slide_not_found',
        'element_not_found',
        'animation_not_found',
        'wrong_animation_kind',
        'keyframe_not_found',
        'min_keyframes',
      ]),
      detail: z.string().optional(),
    })
    .strict(),
]);

const removeKeyframe: ToolHandler<
  z.infer<typeof removeKeyframeInput>,
  z.infer<typeof removeKeyframeOutput>,
  MutationContext
> = {
  name: 'remove_keyframe',
  bundle: CLIP_ANIMATION_BUNDLE_NAME,
  description:
    "Remove a keyframe by zero-based `index`. Refuses with `wrong_animation_kind` if the animation isn't `keyframed`, `keyframe_not_found` if the index is out of range, and `min_keyframes` if the animation only has 2 keyframes (schema requires ≥2 — use `replace_animation` to change kind instead).",
  inputSchema: removeKeyframeInput,
  outputSchema: removeKeyframeOutput,
  handle: (input, ctx) => {
    const loc = locateElement(ctx, input.slideId, input.elementId);
    if (typeof loc === 'string') return { ok: false, reason: loc };
    const animIndex = findAnimationIndex(loc.element, input.animationId);
    if (animIndex === -1) return { ok: false, reason: 'animation_not_found' };
    const animations = (loc.element.animations ?? []) as readonly AnimationShape[];
    const current = animations[animIndex];
    if (!current) return { ok: false, reason: 'animation_not_found' };
    if (current.animation.kind !== 'keyframed') {
      return {
        ok: false,
        reason: 'wrong_animation_kind',
        detail: `remove_keyframe requires kind='keyframed'; got '${current.animation.kind}'`,
      };
    }
    const keyframes = (current.animation.keyframes ?? []) as readonly unknown[];
    if (input.index >= keyframes.length) {
      return {
        ok: false,
        reason: 'keyframe_not_found',
        detail: `index ${input.index} out of range (length ${keyframes.length})`,
      };
    }
    if (keyframes.length <= 2) {
      return {
        ok: false,
        reason: 'min_keyframes',
        detail: 'keyframed animations must keep ≥2 keyframes',
      };
    }
    ctx.patchSink.push({
      op: 'remove',
      path: `${elementPath(loc)}/animations/${animIndex}/animation/keyframes/${input.index}`,
    });
    return {
      ok: true,
      animationId: input.animationId,
      removedIndex: input.index,
      keyframeCount: keyframes.length - 1,
    };
  },
};

// ---------------------------------------------------------------------------
// Barrel
// ---------------------------------------------------------------------------

export const CLIP_ANIMATION_HANDLERS: readonly ToolHandler<unknown, unknown, MutationContext>[] = [
  addClipElement,
  updateClipElement,
  setClipParams,
  addAnimation,
  removeAnimation,
  clearAnimations,
  replaceAnimation,
  reorderAnimations,
  setAnimationTiming,
  setAnimationEasing,
  setAnimationAutoplay,
  setAnimationKindParams,
  addKeyframe,
  removeKeyframe,
] as unknown as readonly ToolHandler<unknown, unknown, MutationContext>[];

// ---------------------------------------------------------------------------
// LLM tool definitions (JSONSchema mirror of the Zod input schemas)
// ---------------------------------------------------------------------------

const nonEmptyString = { type: 'string' as const, minLength: 1 };
const nonNegInt = { type: 'integer' as const, minimum: 0 };
const animationObject = {
  type: 'object' as const,
  description:
    'Inner animation kind — Zod-validated server-side against `animationKindSchema` (fade / slide / scale / rotate / color / keyframed / runtime, discriminated on `kind`).',
};
const timingObject = {
  type: 'object' as const,
  description:
    'Timing primitive — Zod-validated server-side against `timingPrimitiveSchema` (one of the five B1–B5 kinds).',
};
const easingObject = {
  type: 'object' as const,
  description:
    'Easing — Zod-validated server-side against `easingSchema`. Accepts a named string, or a parametric object (`cubic-bezier` / `spring` / `steps`). Strings are also accepted at the top level.',
};
const keyframeObject = {
  type: 'object' as const,
  description: 'Keyframe — `{ at: 0..1, value: any, easing?: Easing }`. Zod-validated server-side.',
};
const fontRequirementArray = {
  type: 'array' as const,
  items: {
    type: 'object' as const,
    description: 'Font requirement — Zod-validated server-side.',
  },
};
const transformObject = {
  type: 'object' as const,
  description:
    'Element transform — `{ x, y, width, height, rotation, opacity }`. Zod-validated server-side.',
};

export const CLIP_ANIMATION_TOOL_DEFINITIONS: readonly LLMToolDefinition[] = [
  {
    name: 'add_clip_element',
    description: addClipElement.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'runtime', 'clipName'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        runtime: nonEmptyString,
        clipName: nonEmptyString,
        params: { type: 'object' },
        transform: transformObject,
        name: { type: 'string', minLength: 1, maxLength: 200 },
        fonts: fontRequirementArray,
        position: nonNegInt,
      },
    },
  },
  {
    name: 'update_clip_element',
    description: updateClipElement.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'elementId'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        elementId: nonEmptyString,
        runtime: nonEmptyString,
        clipName: nonEmptyString,
        params: { type: 'object' },
        fonts: fontRequirementArray,
      },
    },
  },
  {
    name: 'set_clip_params',
    description: setClipParams.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'elementId'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        elementId: nonEmptyString,
        merge: { type: 'object' },
        remove: { type: 'array', items: nonEmptyString },
      },
    },
  },
  {
    name: 'add_animation',
    description: addAnimation.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'elementId', 'animation', 'timing'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        elementId: nonEmptyString,
        animation: animationObject,
        timing: timingObject,
        autoplay: { type: 'boolean' },
        id: nonEmptyString,
        position: nonNegInt,
      },
    },
  },
  {
    name: 'remove_animation',
    description: removeAnimation.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'elementId', 'animationId'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        elementId: nonEmptyString,
        animationId: nonEmptyString,
      },
    },
  },
  {
    name: 'clear_animations',
    description: clearAnimations.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'elementId'],
      additionalProperties: false,
      properties: { slideId: nonEmptyString, elementId: nonEmptyString },
    },
  },
  {
    name: 'replace_animation',
    description: replaceAnimation.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'elementId', 'animationId', 'animation'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        elementId: nonEmptyString,
        animationId: nonEmptyString,
        animation: {
          type: 'object',
          description:
            'Full animation object — `{ id, timing, animation, autoplay? }`. Zod-validated server-side; `animation.id` must equal `animationId`.',
        },
      },
    },
  },
  {
    name: 'reorder_animations',
    description: reorderAnimations.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'elementId', 'order'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        elementId: nonEmptyString,
        order: { type: 'array', minItems: 1, items: nonEmptyString },
      },
    },
  },
  {
    name: 'set_animation_timing',
    description: setAnimationTiming.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'elementId', 'animationId', 'timing'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        elementId: nonEmptyString,
        animationId: nonEmptyString,
        timing: timingObject,
      },
    },
  },
  {
    name: 'set_animation_easing',
    description: setAnimationEasing.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'elementId', 'animationId', 'easing'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        elementId: nonEmptyString,
        animationId: nonEmptyString,
        easing: easingObject,
      },
    },
  },
  {
    name: 'set_animation_autoplay',
    description: setAnimationAutoplay.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'elementId', 'animationId', 'autoplay'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        elementId: nonEmptyString,
        animationId: nonEmptyString,
        autoplay: { type: 'boolean' },
      },
    },
  },
  {
    name: 'set_animation_kind_params',
    description: setAnimationKindParams.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'elementId', 'animationId', 'updates'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        elementId: nonEmptyString,
        animationId: nonEmptyString,
        updates: {
          type: 'object',
          description:
            'Field → new value within the inner `animation` object. `kind` is forbidden.',
        },
      },
    },
  },
  {
    name: 'add_keyframe',
    description: addKeyframe.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'elementId', 'animationId', 'keyframe'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        elementId: nonEmptyString,
        animationId: nonEmptyString,
        keyframe: keyframeObject,
        position: nonNegInt,
      },
    },
  },
  {
    name: 'remove_keyframe',
    description: removeKeyframe.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'elementId', 'animationId', 'index'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        elementId: nonEmptyString,
        animationId: nonEmptyString,
        index: nonNegInt,
      },
    },
  },
];
