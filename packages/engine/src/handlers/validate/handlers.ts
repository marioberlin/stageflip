// packages/engine/src/handlers/validate/handlers.ts
// `validate` bundle — 4 read-tier tools for schema + structural integrity
// checks. These report findings; they do not mutate. Handlers type against
// DocumentContext so they can run in validator / executor / pre-render
// pipelines without needing a patch sink.

import type { LLMToolDefinition } from '@stageflip/llm-abstraction';
import { documentSchema } from '@stageflip/schema';
import { z } from 'zod';
import type { DocumentContext, ToolHandler } from '../../router/types.js';

export const VALIDATE_BUNDLE_NAME = 'validate';

const findingSchema = z.object({
  kind: z.string(),
  message: z.string(),
  path: z.string().optional(),
});
type Finding = z.infer<typeof findingSchema>;

// --- validate_schema ------------------------------------------------------

const validateSchemaInput = z.object({}).strict();
const validateSchemaOutput = z
  .object({
    ok: z.boolean(),
    issues: z.array(
      z.object({
        path: z.string(),
        code: z.string(),
        message: z.string(),
      }),
    ),
  })
  .strict();

const validateSchema: ToolHandler<
  z.infer<typeof validateSchemaInput>,
  z.infer<typeof validateSchemaOutput>,
  DocumentContext
> = {
  name: 'validate_schema',
  bundle: VALIDATE_BUNDLE_NAME,
  description:
    'Run `documentSchema.parse` on the current document and report every Zod issue (path + code + message). `ok: true` when the document parses cleanly.',
  inputSchema: validateSchemaInput,
  outputSchema: validateSchemaOutput,
  handle: (_input, ctx) => {
    const result = documentSchema.safeParse(ctx.document);
    if (result.success) return { ok: true, issues: [] };
    return {
      ok: false,
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        code: issue.code,
        message: issue.message,
      })),
    };
  },
};

// --- check_duplicate_ids --------------------------------------------------

const checkDuplicateIdsInput = z.object({}).strict();
const checkDuplicateIdsOutput = z
  .object({
    ok: z.boolean(),
    duplicateSlideIds: z.array(z.string()),
    duplicateElementIds: z.array(
      z.object({
        id: z.string(),
        occurrences: z.array(z.object({ slideId: z.string() })).min(1),
      }),
    ),
  })
  .strict();

const checkDuplicateIds: ToolHandler<
  z.infer<typeof checkDuplicateIdsInput>,
  z.infer<typeof checkDuplicateIdsOutput>,
  DocumentContext
> = {
  name: 'check_duplicate_ids',
  bundle: VALIDATE_BUNDLE_NAME,
  description:
    'Scan the document for duplicate slide ids and duplicate element ids (element ids must be unique across the entire deck). Returns arrays of offenders; `ok: true` when no duplicates.',
  inputSchema: checkDuplicateIdsInput,
  outputSchema: checkDuplicateIdsOutput,
  handle: (_input, ctx) => {
    if (ctx.document.content.mode !== 'slide') {
      return { ok: true, duplicateSlideIds: [], duplicateElementIds: [] };
    }
    const slides = ctx.document.content.slides;

    const slideSeen = new Map<string, number>();
    for (const s of slides) slideSeen.set(s.id, (slideSeen.get(s.id) ?? 0) + 1);
    const duplicateSlideIds = [...slideSeen.entries()].filter(([, n]) => n > 1).map(([id]) => id);

    const elementSeen = new Map<string, Array<{ slideId: string }>>();
    for (const slide of slides) {
      for (const el of slide.elements) {
        const list = elementSeen.get(el.id) ?? [];
        list.push({ slideId: slide.id });
        elementSeen.set(el.id, list);
      }
    }
    const duplicateElementIds = [...elementSeen.entries()]
      .filter(([, occ]) => occ.length > 1)
      .map(([id, occurrences]) => ({ id, occurrences }));

    return {
      ok: duplicateSlideIds.length === 0 && duplicateElementIds.length === 0,
      duplicateSlideIds,
      duplicateElementIds,
    };
  },
};

// --- check_timing_coverage ------------------------------------------------

const checkTimingInput = z.object({}).strict();
const checkTimingOutput = z
  .object({
    mode: z.enum(['slide', 'video', 'display', 'other']),
    totalSlides: z.number().int().nonnegative(),
    slidesWithoutDuration: z.array(z.string()),
    knownDurationMs: z.number().int().nonnegative(),
  })
  .strict();

const checkTimingCoverage: ToolHandler<
  z.infer<typeof checkTimingInput>,
  z.infer<typeof checkTimingOutput>,
  DocumentContext
> = {
  name: 'check_timing_coverage',
  bundle: VALIDATE_BUNDLE_NAME,
  description:
    'Report which slides have a static `durationMs` and sum them. Useful before an export: slides without `durationMs` advance on user click and are unsuitable for non-interactive outputs.',
  inputSchema: checkTimingInput,
  outputSchema: checkTimingOutput,
  handle: (_input, ctx) => {
    if (ctx.document.content.mode !== 'slide') {
      const mode =
        ctx.document.content.mode === 'video' || ctx.document.content.mode === 'display'
          ? ctx.document.content.mode
          : 'other';
      return {
        mode,
        totalSlides: 0,
        slidesWithoutDuration: [],
        knownDurationMs: 0,
      };
    }
    const slides = ctx.document.content.slides;
    const slidesWithoutDuration: string[] = [];
    let knownDurationMs = 0;
    for (const s of slides) {
      if (s.durationMs === undefined) slidesWithoutDuration.push(s.id);
      else knownDurationMs += s.durationMs;
    }
    return {
      mode: 'slide',
      totalSlides: slides.length,
      slidesWithoutDuration,
      knownDurationMs,
    };
  },
};

// --- validate_all ---------------------------------------------------------

const validateAllInput = z.object({}).strict();
const validateAllOutput = z
  .object({
    ok: z.boolean(),
    findings: z.array(findingSchema),
  })
  .strict();

const validateAll: ToolHandler<
  z.infer<typeof validateAllInput>,
  z.infer<typeof validateAllOutput>,
  DocumentContext
> = {
  name: 'validate_all',
  bundle: VALIDATE_BUNDLE_NAME,
  description:
    "Run every validate-bundle check and aggregate findings. Convenient for a 'please lint the doc' call site; prefer the individual tools when the agent already knows which axis to inspect.",
  inputSchema: validateAllInput,
  outputSchema: validateAllOutput,
  handle: async (_input, ctx) => {
    const findings: Finding[] = [];

    const schemaResult = await validateSchema.handle({}, ctx);
    for (const issue of schemaResult.issues) {
      findings.push({
        kind: 'schema_issue',
        message: `${issue.code}: ${issue.message}`,
        path: issue.path,
      });
    }

    const dupResult = await checkDuplicateIds.handle({}, ctx);
    for (const id of dupResult.duplicateSlideIds) {
      findings.push({
        kind: 'duplicate_slide_id',
        message: `slide id "${id}" used more than once`,
      });
    }
    for (const dup of dupResult.duplicateElementIds) {
      findings.push({
        kind: 'duplicate_element_id',
        message: `element id "${dup.id}" appears on ${dup.occurrences.length} slides`,
      });
    }

    const timingResult = await checkTimingCoverage.handle({}, ctx);
    if (timingResult.slidesWithoutDuration.length > 0) {
      findings.push({
        kind: 'missing_duration',
        message: `${timingResult.slidesWithoutDuration.length} slide(s) have no durationMs; non-interactive export will hang on them`,
      });
    }

    return { ok: findings.length === 0, findings };
  },
};

// --- barrel ---------------------------------------------------------------

export const VALIDATE_HANDLERS: readonly ToolHandler<unknown, unknown, DocumentContext>[] = [
  validateSchema,
  checkDuplicateIds,
  checkTimingCoverage,
  validateAll,
] as unknown as readonly ToolHandler<unknown, unknown, DocumentContext>[];

const emptyInput = { type: 'object' as const, properties: {}, additionalProperties: false };

export const VALIDATE_TOOL_DEFINITIONS: readonly LLMToolDefinition[] = [
  {
    name: 'validate_schema',
    description: validateSchema.description,
    input_schema: emptyInput,
  },
  {
    name: 'check_duplicate_ids',
    description: checkDuplicateIds.description,
    input_schema: emptyInput,
  },
  {
    name: 'check_timing_coverage',
    description: checkTimingCoverage.description,
    input_schema: emptyInput,
  },
  {
    name: 'validate_all',
    description: validateAll.description,
    input_schema: emptyInput,
  },
];
