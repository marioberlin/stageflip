// packages/schema/src/document.ts
// Top-level Document shape. Every persisted StageFlip doc is this type.
// Invariant I-1 (CLAUDE.md §3): every input, edit, and export round-trips
// through `documentSchema`.

import { z } from 'zod';
import { contentSchema } from './content/index.js';
import { slideLayoutSchema, slideMasterSchema } from './templates.js';
import { themeSchema } from './theme.js';

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
 * Component definition. Placeholder shape — T-249 theme learning + the RIR
 * compiler's component-expand pass fill out the contract. Today we accept
 * any JSON shape so imports can store component parameters without needing
 * every import adapter to know the final shape.
 */
export const componentDefinitionSchema = z
  .object({
    id: z.string().min(1),
    /** Component body is a JSON-safe blob for now. Typed by T-249. */
    body: z.unknown(),
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
  })
  .strict();
export type Document = z.infer<typeof documentSchema>;
