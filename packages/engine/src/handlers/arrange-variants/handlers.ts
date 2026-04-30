// packages/engine/src/handlers/arrange-variants/handlers.ts
// `arrange-variants` bundle — one tool, `arrange_variants` (T-386 D-T386-6).
//
// Wraps `@stageflip/variant-gen`'s `generateVariants` in the agent-tool
// surface. Each variant Document is persisted via the
// `VariantPersistenceContext.persistVariant` seam (the executor wires this
// to real storage — T-408 owns the persistence consumer side); the
// response carries variant IDs + cacheKey + coordinate, never full
// Document payloads (would blow the agent context).
//
// Cap-exceeded (AC #24): the variant-gen layer throws
// `VariantMatrixCapExceededError` synchronously; the handler converts it
// into a typed `{ ok: false, reason: 'matrix_cap_exceeded' }` response
// (no partial output, no patches emitted).

import type { LLMToolDefinition } from '@stageflip/llm-abstraction';
import type { Document } from '@stageflip/schema';
import { VariantMatrixCapExceededError, generateVariants } from '@stageflip/variant-gen';
import { z } from 'zod';
import type { MutationContext, ToolHandler } from '../../router/types.js';

export const ARRANGE_VARIANTS_BUNDLE_NAME = 'arrange-variants';

/**
 * Persistence seam — the executor (T-408) wires this to real storage; tests
 * stub it with an in-memory recorder. Synchronous; persistence latency
 * lives below the seam so the variant-gen tool stays
 * synchronous-by-shape with the engine's other bundles.
 *
 * Returns the persisted variant Document's id (which the variant-gen layer
 * already derives from `sha256(sourceDocId + coordinate)` via
 * `doc.meta.id`; the seam exists so the executor can override storage
 * without forking the handler).
 */
export interface VariantPersistenceContext extends MutationContext {
  persistVariant(doc: Document): string | Promise<string>;
}

// ---------------------------------------------------------------------------
// arrange_variants — single tool
// ---------------------------------------------------------------------------

const variantSlotEntrySchema = z
  .object({
    id: z.string().min(1),
    slots: z.record(z.string()),
  })
  .strict();

const localeEntrySchema = z
  .object({
    tag: z
      .string()
      .min(1)
      .regex(/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/, 'tag must be a BCP-47 identifier'),
  })
  .strict();

const matrixSpecSchema = z
  .object({
    messages: z.array(variantSlotEntrySchema).optional(),
    locales: z.array(localeEntrySchema).optional(),
    maxVariants: z.number().int().positive().optional(),
  })
  .strict();

const arrangeVariantsInput = z
  .object({
    matrixSpec: matrixSpecSchema,
  })
  .strict();
type ArrangeVariantsInput = z.infer<typeof arrangeVariantsInput>;

const variantOutputEntrySchema = z
  .object({
    coordinate: z
      .object({
        messageId: z.string().optional(),
        locale: z.string().optional(),
      })
      .strict(),
    documentId: z.string().min(1),
    cacheKey: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict();

const arrangeVariantsOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      variants: z.array(variantOutputEntrySchema),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['matrix_cap_exceeded']),
      detail: z.string().optional(),
    })
    .strict(),
]);
type ArrangeVariantsOutput = z.infer<typeof arrangeVariantsOutput>;

const arrangeVariants: ToolHandler<
  ArrangeVariantsInput,
  ArrangeVariantsOutput,
  VariantPersistenceContext
> = {
  name: 'arrange_variants',
  bundle: ARRANGE_VARIANTS_BUNDLE_NAME,
  description:
    'Generate the message × locale variant matrix from the source document and the supplied `matrixSpec`. Persists each variant Document via the executor-supplied storage seam and returns `{ coordinate, documentId, cacheKey }` per variant — never full Document payloads (would blow the agent context). Empty matrix returns an empty `variants` array. Exceeding `matrixSpec.maxVariants` (default 100) returns `{ ok: false, reason: "matrix_cap_exceeded" }` with no partial output. Size axis is OUT OF SCOPE in T-386 (T-386a follow-up); passing `size:` is rejected by the schema.',
  inputSchema: arrangeVariantsInput,
  outputSchema: arrangeVariantsOutput,
  handle: async (input, ctx) => {
    // Strip undefineds — the variant-gen interface is `exactOptionalPropertyTypes`-strict.
    const spec: Parameters<typeof generateVariants>[1] = {};
    if (input.matrixSpec.messages !== undefined) spec.messages = input.matrixSpec.messages;
    if (input.matrixSpec.locales !== undefined) spec.locales = input.matrixSpec.locales;
    if (input.matrixSpec.maxVariants !== undefined) spec.maxVariants = input.matrixSpec.maxVariants;
    let outputs: ReturnType<typeof generateVariants>;
    try {
      outputs = generateVariants(ctx.document, spec);
    } catch (err) {
      if (err instanceof VariantMatrixCapExceededError) {
        return {
          ok: false,
          reason: 'matrix_cap_exceeded',
          detail: err.message,
        };
      }
      throw err;
    }
    const variants: Array<{
      coordinate: { messageId?: string; locale?: string };
      documentId: string;
      cacheKey: string;
    }> = [];
    for (const v of outputs) {
      const documentId = await ctx.persistVariant(v.document);
      variants.push({
        coordinate: v.coordinate,
        documentId,
        cacheKey: v.cacheKey,
      });
    }
    return { ok: true, variants };
  },
};

// ---------------------------------------------------------------------------
// Barrel
// ---------------------------------------------------------------------------

export const ARRANGE_VARIANTS_HANDLERS: readonly ToolHandler<
  unknown,
  unknown,
  VariantPersistenceContext
>[] = [arrangeVariants] as unknown as readonly ToolHandler<
  unknown,
  unknown,
  VariantPersistenceContext
>[];

export const ARRANGE_VARIANTS_TOOL_DEFINITIONS: readonly LLMToolDefinition[] = [
  {
    name: 'arrange_variants',
    description: arrangeVariants.description,
    input_schema: {
      type: 'object',
      required: ['matrixSpec'],
      additionalProperties: false,
      properties: {
        matrixSpec: {
          type: 'object',
          additionalProperties: false,
          properties: {
            messages: {
              type: 'array',
              items: {
                type: 'object',
                required: ['id', 'slots'],
                additionalProperties: false,
                properties: {
                  id: { type: 'string', minLength: 1 },
                  slots: {
                    type: 'object',
                    additionalProperties: { type: 'string' },
                  },
                },
              },
            },
            locales: {
              type: 'array',
              items: {
                type: 'object',
                required: ['tag'],
                additionalProperties: false,
                properties: {
                  tag: { type: 'string', minLength: 1 },
                },
              },
            },
            maxVariants: { type: 'integer', minimum: 1 },
          },
        },
      },
    },
  },
];
