// packages/engine/src/handlers/qc-export-bulk/handlers.ts
// `qc-export-bulk` bundle — 9 write-tier tools covering:
//   QC (4)     — alt-text / speaker-notes / off-canvas / orphan-animation
//                audits. Read the document, emit no patches; return a list
//                of findings the LLM can triage.
//   Bulk (3)   — multi-slide / multi-element mutations that would otherwise
//                take N separate tool calls.
//   Export (2) — static profile list + a `freeze_animations_for_static_export`
//                helper that clears every element's animations (useful before
//                PDF / image-sequence export where animations can't render).
//
// Slide-mode only. All handlers type against `MutationContext` even when
// they only read — keeps the register signature aligned with every other
// write-tier bundle in the suite.

import type { LLMToolDefinition } from '@stageflip/llm-abstraction';
import { z } from 'zod';
import type { MutationContext, ToolHandler } from '../../router/types.js';

export const QC_EXPORT_BULK_BUNDLE_NAME = 'qc-export-bulk';

// Canvas dimensions: the RIR compiler emits at 1920×1080 reference px (see
// skills/stageflip/concepts/rir/SKILL.md). The off-canvas QC uses this as
// the slide viewport bound.
const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function ensureSlideMode(
  ctx: MutationContext,
): readonly { id: string; elements: readonly unknown[] }[] | 'wrong_mode' {
  if (ctx.document.content.mode !== 'slide') return 'wrong_mode';
  return ctx.document.content.slides as unknown as readonly {
    id: string;
    elements: readonly unknown[];
  }[];
}

// ---------------------------------------------------------------------------
// 1 — check_alt_text_coverage (QC, read-tier)
// ---------------------------------------------------------------------------

const checkAltInput = z.object({}).strict();
const checkAltOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      totalImages: z.number().int().nonnegative(),
      missingAlt: z.array(
        z
          .object({
            slideId: z.string(),
            elementId: z.string(),
          })
          .strict(),
      ),
    })
    .strict(),
  z.object({ ok: z.literal(false), reason: z.enum(['wrong_mode']) }).strict(),
]);

const checkAltTextCoverage: ToolHandler<
  z.infer<typeof checkAltInput>,
  z.infer<typeof checkAltOutput>,
  MutationContext
> = {
  name: 'check_alt_text_coverage',
  bundle: QC_EXPORT_BULK_BUNDLE_NAME,
  description:
    "A11y audit: find every image element with no `alt` field (or an empty-string alt that WASN'T explicitly marked decorative). Reports `totalImages` + a list of `{ slideId, elementId }` pairs needing attention. Empty-string alt is treated as decorative (per ARIA convention) and does NOT show up as missing.",
  inputSchema: checkAltInput,
  outputSchema: checkAltOutput,
  handle: (_input, ctx) => {
    const slides = ensureSlideMode(ctx);
    if (typeof slides === 'string') return { ok: false, reason: slides };
    const missingAlt: Array<{ slideId: string; elementId: string }> = [];
    let totalImages = 0;
    for (const slide of slides) {
      for (const raw of slide.elements) {
        const el = raw as Record<string, unknown>;
        if (el.type !== 'image') continue;
        totalImages += 1;
        // alt: undefined → missing. alt: '' → explicitly decorative, OK.
        if (el.alt === undefined) {
          missingAlt.push({ slideId: slide.id, elementId: el.id as string });
        }
      }
    }
    return { ok: true, totalImages, missingAlt };
  },
};

// ---------------------------------------------------------------------------
// 2 — check_notes_coverage (QC, read-tier)
// ---------------------------------------------------------------------------

const checkNotesInput = z.object({}).strict();
const checkNotesOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      totalSlides: z.number().int().positive(),
      missingNotes: z.array(z.string()),
    })
    .strict(),
  z.object({ ok: z.literal(false), reason: z.enum(['wrong_mode']) }).strict(),
]);

const checkNotesCoverage: ToolHandler<
  z.infer<typeof checkNotesInput>,
  z.infer<typeof checkNotesOutput>,
  MutationContext
> = {
  name: 'check_notes_coverage',
  bundle: QC_EXPORT_BULK_BUNDLE_NAME,
  description:
    'Find slides without speaker notes (or with empty-string notes). Returns `totalSlides` + the list of slide ids needing attention.',
  inputSchema: checkNotesInput,
  outputSchema: checkNotesOutput,
  handle: (_input, ctx) => {
    const slides = ensureSlideMode(ctx);
    if (typeof slides === 'string') return { ok: false, reason: slides };
    const missingNotes: string[] = [];
    for (const slide of slides) {
      const notes = (slide as unknown as { notes?: string }).notes;
      if (notes === undefined || notes.length === 0) {
        missingNotes.push(slide.id);
      }
    }
    return { ok: true, totalSlides: slides.length, missingNotes };
  },
};

// ---------------------------------------------------------------------------
// 3 — check_element_outside_canvas (QC, read-tier)
// ---------------------------------------------------------------------------

const checkOutsideInput = z.object({}).strict();
const checkOutsideOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      canvasWidth: z.number(),
      canvasHeight: z.number(),
      outsideElements: z.array(
        z
          .object({
            slideId: z.string(),
            elementId: z.string(),
            direction: z.array(z.enum(['left', 'right', 'top', 'bottom'])),
          })
          .strict(),
      ),
    })
    .strict(),
  z.object({ ok: z.literal(false), reason: z.enum(['wrong_mode']) }).strict(),
]);

const checkElementOutsideCanvas: ToolHandler<
  z.infer<typeof checkOutsideInput>,
  z.infer<typeof checkOutsideOutput>,
  MutationContext
> = {
  name: 'check_element_outside_canvas',
  bundle: QC_EXPORT_BULK_BUNDLE_NAME,
  description:
    'Find elements whose transform bounding box extends outside the 1920×1080 reference canvas. Reports direction tags (`left` / `right` / `top` / `bottom`) so the caller can understand which edge is violated. Elements entirely off-canvas report all four directions the box exits.',
  inputSchema: checkOutsideInput,
  outputSchema: checkOutsideOutput,
  handle: (_input, ctx) => {
    const slides = ensureSlideMode(ctx);
    if (typeof slides === 'string') return { ok: false, reason: slides };
    const outside: Array<{
      slideId: string;
      elementId: string;
      direction: ('left' | 'right' | 'top' | 'bottom')[];
    }> = [];
    for (const slide of slides) {
      for (const raw of slide.elements) {
        const el = raw as {
          id: string;
          transform?: { x: number; y: number; width: number; height: number };
        };
        const t = el.transform;
        if (!t) continue;
        const dirs: ('left' | 'right' | 'top' | 'bottom')[] = [];
        if (t.x < 0) dirs.push('left');
        if (t.x + t.width > CANVAS_WIDTH) dirs.push('right');
        if (t.y < 0) dirs.push('top');
        if (t.y + t.height > CANVAS_HEIGHT) dirs.push('bottom');
        if (dirs.length > 0) {
          outside.push({ slideId: slide.id, elementId: el.id, direction: dirs });
        }
      }
    }
    return {
      ok: true,
      canvasWidth: CANVAS_WIDTH,
      canvasHeight: CANVAS_HEIGHT,
      outsideElements: outside,
    };
  },
};

// ---------------------------------------------------------------------------
// 4 — check_orphan_animations (QC, read-tier)
// ---------------------------------------------------------------------------

const checkOrphanInput = z.object({}).strict();
const checkOrphanOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      orphans: z.array(
        z
          .object({
            slideId: z.string(),
            elementId: z.string(),
            animationId: z.string(),
            missingAnchor: z.string(),
          })
          .strict(),
      ),
    })
    .strict(),
  z.object({ ok: z.literal(false), reason: z.enum(['wrong_mode']) }).strict(),
]);

const checkOrphanAnimations: ToolHandler<
  z.infer<typeof checkOrphanInput>,
  z.infer<typeof checkOrphanOutput>,
  MutationContext
> = {
  name: 'check_orphan_animations',
  bundle: QC_EXPORT_BULK_BUNDLE_NAME,
  description:
    "Find B3 `anchored` animations whose `anchor` id references a non-existent element on the same slide. Reports `{ slideId, elementId, animationId, missingAnchor }` per orphan. Only checks same-slide scope (cross-slide anchoring isn't allowed by the RIR compiler).",
  inputSchema: checkOrphanInput,
  outputSchema: checkOrphanOutput,
  handle: (_input, ctx) => {
    const slides = ensureSlideMode(ctx);
    if (typeof slides === 'string') return { ok: false, reason: slides };
    const orphans: Array<{
      slideId: string;
      elementId: string;
      animationId: string;
      missingAnchor: string;
    }> = [];
    for (const slide of slides) {
      const slideElementIds = new Set(
        (slide.elements as readonly { id: string }[]).map((e) => e.id),
      );
      for (const raw of slide.elements) {
        const el = raw as {
          id: string;
          animations?: Array<{
            id: string;
            timing?: { kind?: string; anchor?: string };
          }>;
        };
        for (const a of el.animations ?? []) {
          if (a.timing?.kind !== 'anchored') continue;
          const anchor = a.timing.anchor;
          if (typeof anchor === 'string' && !slideElementIds.has(anchor)) {
            orphans.push({
              slideId: slide.id,
              elementId: el.id,
              animationId: a.id,
              missingAnchor: anchor,
            });
          }
        }
      }
    }
    return { ok: true, orphans };
  },
};

// ---------------------------------------------------------------------------
// 5 — bulk_set_slide_duration
// ---------------------------------------------------------------------------

const bulkDurationInput = z
  .object({
    assignments: z
      .array(
        z
          .object({
            slideId: z.string().min(1),
            durationMs: z.number().int().positive(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();
const bulkDurationOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      applied: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['wrong_mode', 'slide_not_found']),
      detail: z.string().optional(),
    })
    .strict(),
]);

const bulkSetSlideDuration: ToolHandler<
  z.infer<typeof bulkDurationInput>,
  z.infer<typeof bulkDurationOutput>,
  MutationContext
> = {
  name: 'bulk_set_slide_duration',
  bundle: QC_EXPORT_BULK_BUNDLE_NAME,
  description:
    'Set `durationMs` on multiple slides at once. Validates every assignment (slide exists) before emitting any patches; rejects atomically with `slide_not_found` on first offender.',
  inputSchema: bulkDurationInput,
  outputSchema: bulkDurationOutput,
  handle: (input, ctx) => {
    if (ctx.document.content.mode !== 'slide') return { ok: false, reason: 'wrong_mode' };
    const slides = ctx.document.content.slides;
    const targets: Array<{ index: number; had: boolean; value: number }> = [];
    for (const a of input.assignments) {
      const index = slides.findIndex((s) => s.id === a.slideId);
      if (index === -1) {
        return { ok: false, reason: 'slide_not_found', detail: `unknown: ${a.slideId}` };
      }
      targets.push({
        index,
        had: slides[index]?.durationMs !== undefined,
        value: a.durationMs,
      });
    }
    for (const t of targets) {
      ctx.patchSink.push({
        op: t.had ? 'replace' : 'add',
        path: `/content/slides/${t.index}/durationMs`,
        value: t.value,
      });
    }
    return { ok: true, applied: targets.length };
  },
};

// ---------------------------------------------------------------------------
// 6 — bulk_set_element_flags
// ---------------------------------------------------------------------------

const bulkFlagsInput = z
  .object({
    assignments: z
      .array(
        z
          .object({
            slideId: z.string().min(1),
            elementId: z.string().min(1),
            visible: z.boolean().optional(),
            locked: z.boolean().optional(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();
const bulkFlagsOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      applied: z.number().int().positive(),
      patchCount: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['wrong_mode', 'slide_not_found', 'element_not_found']),
      detail: z.string().optional(),
    })
    .strict(),
]);

const bulkSetElementFlags: ToolHandler<
  z.infer<typeof bulkFlagsInput>,
  z.infer<typeof bulkFlagsOutput>,
  MutationContext
> = {
  name: 'bulk_set_element_flags',
  bundle: QC_EXPORT_BULK_BUNDLE_NAME,
  description:
    'Bulk version of `set_element_flags` (element-cm1): flip `visible` / `locked` across many elements spanning multiple slides. Fails atomically on first `slide_not_found` / `element_not_found`. Reports `applied` assignments + total `patchCount` emitted (one patch per flip per element).',
  inputSchema: bulkFlagsInput,
  outputSchema: bulkFlagsOutput,
  handle: (input, ctx) => {
    if (ctx.document.content.mode !== 'slide') return { ok: false, reason: 'wrong_mode' };
    const slides = ctx.document.content.slides;
    const targets: Array<{
      slideIndex: number;
      elementIndex: number;
      existing: Record<string, unknown>;
      visible: boolean | undefined;
      locked: boolean | undefined;
    }> = [];
    for (const a of input.assignments) {
      const slideIndex = slides.findIndex((s) => s.id === a.slideId);
      if (slideIndex === -1) {
        return { ok: false, reason: 'slide_not_found', detail: `unknown: ${a.slideId}` };
      }
      const slide = slides[slideIndex];
      if (!slide) return { ok: false, reason: 'slide_not_found' };
      const elementIndex = slide.elements.findIndex((e) => e.id === a.elementId);
      if (elementIndex === -1) {
        return {
          ok: false,
          reason: 'element_not_found',
          detail: `unknown: ${a.slideId}/${a.elementId}`,
        };
      }
      const existing = slide.elements[elementIndex] as unknown as Record<string, unknown>;
      targets.push({
        slideIndex,
        elementIndex,
        existing,
        visible: a.visible,
        locked: a.locked,
      });
    }
    let patchCount = 0;
    for (const t of targets) {
      for (const field of ['visible', 'locked'] as const) {
        const v = t[field];
        if (v === undefined) continue;
        ctx.patchSink.push({
          op: field in t.existing ? 'replace' : 'add',
          path: `/content/slides/${t.slideIndex}/elements/${t.elementIndex}/${field}`,
          value: v,
        });
        patchCount += 1;
      }
    }
    return { ok: true, applied: targets.length, patchCount };
  },
};

// ---------------------------------------------------------------------------
// 7 — bulk_delete_elements
// ---------------------------------------------------------------------------

const bulkDeleteInput = z
  .object({
    assignments: z
      .array(
        z
          .object({
            slideId: z.string().min(1),
            elementId: z.string().min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();
const bulkDeleteOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      deleted: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['wrong_mode', 'slide_not_found', 'element_not_found']),
      detail: z.string().optional(),
    })
    .strict(),
]);

const bulkDeleteElements: ToolHandler<
  z.infer<typeof bulkDeleteInput>,
  z.infer<typeof bulkDeleteOutput>,
  MutationContext
> = {
  name: 'bulk_delete_elements',
  bundle: QC_EXPORT_BULK_BUNDLE_NAME,
  description:
    'Delete multiple elements across slides in one call. Atomic: validates every assignment first. Patches are emitted per-slide in reverse element-index order so successive removes within a slide stay index-stable.',
  inputSchema: bulkDeleteInput,
  outputSchema: bulkDeleteOutput,
  handle: (input, ctx) => {
    if (ctx.document.content.mode !== 'slide') return { ok: false, reason: 'wrong_mode' };
    const slides = ctx.document.content.slides;
    // Validate all; group by slide so we can reverse-sort within each.
    const bySlide = new Map<number, number[]>();
    for (const a of input.assignments) {
      const slideIndex = slides.findIndex((s) => s.id === a.slideId);
      if (slideIndex === -1) {
        return { ok: false, reason: 'slide_not_found', detail: `unknown: ${a.slideId}` };
      }
      const slide = slides[slideIndex];
      if (!slide) return { ok: false, reason: 'slide_not_found' };
      const elementIndex = slide.elements.findIndex((e) => e.id === a.elementId);
      if (elementIndex === -1) {
        return {
          ok: false,
          reason: 'element_not_found',
          detail: `unknown: ${a.slideId}/${a.elementId}`,
        };
      }
      const list = bySlide.get(slideIndex) ?? [];
      list.push(elementIndex);
      bySlide.set(slideIndex, list);
    }
    let deleted = 0;
    for (const [slideIndex, elementIndices] of bySlide.entries()) {
      const sorted = [...new Set(elementIndices)].sort((a, b) => b - a);
      for (const ei of sorted) {
        ctx.patchSink.push({
          op: 'remove',
          path: `/content/slides/${slideIndex}/elements/${ei}`,
        });
        deleted += 1;
      }
    }
    return { ok: true, deleted };
  },
};

// ---------------------------------------------------------------------------
// 8 — list_export_profiles
// ---------------------------------------------------------------------------

/** Static catalog of export profiles — mirrors packages/export-* dirs. */
const EXPORT_PROFILES = [
  {
    name: 'pdf',
    description: 'Static PDF export via @stageflip/export-pdf.',
    animationsSupported: false,
  },
  {
    name: 'pptx',
    description: 'PowerPoint .pptx export via @stageflip/export-pptx.',
    animationsSupported: true,
  },
  { name: 'marp', description: 'Markdown / Marp-compatible export.', animationsSupported: false },
  {
    name: 'html5-zip',
    description: 'Standalone HTML5 zip bundle with runtimes.',
    animationsSupported: true,
  },
  {
    name: 'video',
    description: 'Frame-by-frame video export via CDP renderer.',
    animationsSupported: true,
  },
] as const;

const listExportProfilesInput = z.object({}).strict();
const listExportProfilesOutput = z
  .object({
    ok: z.literal(true),
    profiles: z.array(
      z
        .object({
          name: z.string(),
          description: z.string(),
          animationsSupported: z.boolean(),
        })
        .strict(),
    ),
  })
  .strict();

const listExportProfiles: ToolHandler<
  z.infer<typeof listExportProfilesInput>,
  z.infer<typeof listExportProfilesOutput>,
  MutationContext
> = {
  name: 'list_export_profiles',
  bundle: QC_EXPORT_BULK_BUNDLE_NAME,
  description:
    'Return the static catalog of known export profiles. Each entry has `name`, `description`, and `animationsSupported` — callers that target profiles with `animationsSupported: false` (PDF / Marp) should prep with `freeze_animations_for_static_export` first.',
  inputSchema: listExportProfilesInput,
  outputSchema: listExportProfilesOutput,
  handle: () => ({
    ok: true,
    profiles: EXPORT_PROFILES.map((p) => ({ ...p })),
  }),
};

// ---------------------------------------------------------------------------
// 9 — freeze_animations_for_static_export
// ---------------------------------------------------------------------------

const freezeInput = z.object({}).strict();
const freezeOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      slidesTouched: z.number().int().nonnegative(),
      animationsCleared: z.number().int().nonnegative(),
    })
    .strict(),
  z.object({ ok: z.literal(false), reason: z.enum(['wrong_mode']) }).strict(),
]);

const freezeAnimationsForStaticExport: ToolHandler<
  z.infer<typeof freezeInput>,
  z.infer<typeof freezeOutput>,
  MutationContext
> = {
  name: 'freeze_animations_for_static_export',
  bundle: QC_EXPORT_BULK_BUNDLE_NAME,
  description:
    "Clear every element's `animations` array across the deck (replaces with `[]`) so static exports (PDF / Marp / image sequence) render deterministically from the first frame. Reports `animationsCleared` total. Idempotent — rerunning on a frozen deck emits patches (still replacing with `[]`) but leaves visible state unchanged.",
  inputSchema: freezeInput,
  outputSchema: freezeOutput,
  handle: (_input, ctx) => {
    if (ctx.document.content.mode !== 'slide') return { ok: false, reason: 'wrong_mode' };
    const slides = ctx.document.content.slides;
    let slidesTouched = 0;
    let animationsCleared = 0;
    for (let si = 0; si < slides.length; si += 1) {
      const slide = slides[si];
      if (!slide) continue;
      let slideHadAnimations = false;
      for (let ei = 0; ei < slide.elements.length; ei += 1) {
        const el = slide.elements[ei] as unknown as {
          animations?: readonly unknown[];
        };
        const n = el.animations?.length ?? 0;
        if (n === 0) continue;
        slideHadAnimations = true;
        animationsCleared += n;
        ctx.patchSink.push({
          op: 'replace',
          path: `/content/slides/${si}/elements/${ei}/animations`,
          value: [],
        });
      }
      if (slideHadAnimations) slidesTouched += 1;
    }
    return { ok: true, slidesTouched, animationsCleared };
  },
};

// ---------------------------------------------------------------------------
// Barrel
// ---------------------------------------------------------------------------

export const QC_EXPORT_BULK_HANDLERS: readonly ToolHandler<unknown, unknown, MutationContext>[] = [
  checkAltTextCoverage,
  checkNotesCoverage,
  checkElementOutsideCanvas,
  checkOrphanAnimations,
  bulkSetSlideDuration,
  bulkSetElementFlags,
  bulkDeleteElements,
  listExportProfiles,
  freezeAnimationsForStaticExport,
] as unknown as readonly ToolHandler<unknown, unknown, MutationContext>[];

const nonEmptyString = { type: 'string' as const, minLength: 1 };
const posInt = { type: 'integer' as const, minimum: 1 };
const emptyObject = { type: 'object' as const, additionalProperties: false };

export const QC_EXPORT_BULK_TOOL_DEFINITIONS: readonly LLMToolDefinition[] = [
  {
    name: 'check_alt_text_coverage',
    description: checkAltTextCoverage.description,
    input_schema: emptyObject,
  },
  {
    name: 'check_notes_coverage',
    description: checkNotesCoverage.description,
    input_schema: emptyObject,
  },
  {
    name: 'check_element_outside_canvas',
    description: checkElementOutsideCanvas.description,
    input_schema: emptyObject,
  },
  {
    name: 'check_orphan_animations',
    description: checkOrphanAnimations.description,
    input_schema: emptyObject,
  },
  {
    name: 'bulk_set_slide_duration',
    description: bulkSetSlideDuration.description,
    input_schema: {
      type: 'object',
      required: ['assignments'],
      additionalProperties: false,
      properties: {
        assignments: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['slideId', 'durationMs'],
            additionalProperties: false,
            properties: { slideId: nonEmptyString, durationMs: posInt },
          },
        },
      },
    },
  },
  {
    name: 'bulk_set_element_flags',
    description: bulkSetElementFlags.description,
    input_schema: {
      type: 'object',
      required: ['assignments'],
      additionalProperties: false,
      properties: {
        assignments: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['slideId', 'elementId'],
            additionalProperties: false,
            properties: {
              slideId: nonEmptyString,
              elementId: nonEmptyString,
              visible: { type: 'boolean' },
              locked: { type: 'boolean' },
            },
          },
        },
      },
    },
  },
  {
    name: 'bulk_delete_elements',
    description: bulkDeleteElements.description,
    input_schema: {
      type: 'object',
      required: ['assignments'],
      additionalProperties: false,
      properties: {
        assignments: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['slideId', 'elementId'],
            additionalProperties: false,
            properties: { slideId: nonEmptyString, elementId: nonEmptyString },
          },
        },
      },
    },
  },
  {
    name: 'list_export_profiles',
    description: listExportProfiles.description,
    input_schema: emptyObject,
  },
  {
    name: 'freeze_animations_for_static_export',
    description: freezeAnimationsForStaticExport.description,
    input_schema: emptyObject,
  },
];
