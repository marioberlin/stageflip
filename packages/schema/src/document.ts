// packages/schema/src/document.ts
// Top-level Document shape. Every persisted StageFlip doc is this type.
// Invariant I-1 (CLAUDE.md §3): every input, edit, and export round-trips
// through `documentSchema`.

import { z } from 'zod';
import { layoutDescriptorSchema, slotDefinitionSchema } from './components.js';
import { contentSchema } from './content/index.js';
import { researchSessionRefSchema } from './research-session.js';
import { slideLayoutSchema, slideMasterSchema } from './templates.js';
import { themeSchema } from './theme.js';
import { variantSlotsSchema } from './variants/variant-slots.js';

/** Current canonical schema version. Bump when the doc shape breaks. */
export const SCHEMA_VERSION = 1;

/** Document metadata. `authorId` is the primary author; co-authors live in collab metadata. */
export const documentMetaSchema = z
  .object({
    id: z.string().min(1),
    version: z.number().int().nonnegative(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    title: z.string().max(400).optional(),
    authorId: z.string().min(1).optional(),
    locale: z.string().min(2).max(20).default('en'),
    schemaVersion: z.number().int().nonnegative().default(SCHEMA_VERSION),
  })
  .strict();
export type DocumentMeta = z.infer<typeof documentMetaSchema>;

/**
 * Variables dict. Values are primitive (strings/numbers/booleans) at document
 * level; structured data lives in data-source bindings (T-167).
 */
export const variablesSchema = z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]));
export type Variables = z.infer<typeof variablesSchema>;

/**
 * Component definition. T-249's design-system pipeline emits these from
 * recurring-grouping detection (step 5); the body carries a slot list +
 * a normalized layout descriptor. Existing documents with `components: {}`
 * continue to parse — only documents that opt into components ever produce
 * a populated body, and T-249 is the first emitter.
 */
export const componentDefinitionSchema = z
  .object({
    id: z.string().min(1),
    body: z
      .object({
        slots: z.array(slotDefinitionSchema).default([]),
        layout: layoutDescriptorSchema,
      })
      .strict(),
  })
  .strict();
export type ComponentDefinition = z.infer<typeof componentDefinitionSchema>;

export const documentSchema = z
  .object({
    meta: documentMetaSchema,
    theme: themeSchema,
    variables: variablesSchema.default({}),
    components: z.record(componentDefinitionSchema).default({}),
    /**
     * Deck-level template stores (T-251). Both default to `[]` so existing
     * persisted documents continue to parse unchanged. PPTX importers (T-244,
     * T-243d) and Google Slides importer (T-244) populate these on round-trip
     * import; today only hand-authored deck-template documents fill them.
     */
    masters: z.array(slideMasterSchema).default([]),
    layouts: z.array(slideLayoutSchema).default([]),
    content: contentSchema,
    /**
     * Variant-generation slot bindings (T-386). Optional; absent on existing
     * documents. Each slot points to an Element + property-path that
     * `@stageflip/variant-gen` substitutes per matrix coordinate. The key is
     * the author-chosen slot name; the value is the element / path pointer.
     */
    variantSlots: variantSlotsSchema.optional(),
    /**
     * Research-session binding (T-421 / ADR-008 §D3). Optional; absent on
     * ungrounded documents. When set, asset-gen calls fired against this
     * document inherit the session id (per ADR-008 §D7 routing). A
     * document may be grounded later by populating this field via the
     * `ground_existing_project` AI tool; ungrounded by clearing it.
     * Existing assets keep their `provenance.researchSessionId` audit
     * trail in either direction.
     */
    research: researchSessionRefSchema.optional(),
  })
  .strict();
export type Document = z.infer<typeof documentSchema>;
