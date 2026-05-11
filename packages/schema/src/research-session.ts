// packages/schema/src/research-session.ts
// ResearchSessionRef + ResearchSource schemas — per ADR-008 §D3.
//
// `Document.research?` binds a document to a research-session-scoped
// source corpus. Asset-gen calls fired against the document inherit
// the session id (per ADR-008 §D7 routing). Absent for ungrounded
// documents — the schema field is independently optional, and a
// document may be grounded / ungrounded freely via the
// `ground_existing_project` AI tool (per ADR-008 §D3 commentary).
//
// Existing assets retain their `provenance.researchSessionId` audit
// trail across grounding state changes.
//
// Cross-reference: `packages/asset-gen-contract/src/provenance-placeholder.ts`
// (T-419) mirrors this shape verbatim until the placeholder swap.

import { z } from 'zod';

/**
 * Per-source kind taxonomy. Mirrors ADR-007 §D5 `ResearchSourceKind`.
 * Kept inline rather than importing from `@stageflip/adapters-core`
 * because the schema package has no runtime dep on adapters-core; the
 * literal union is small and stable enough to duplicate.
 */
export const RESEARCH_SOURCE_KINDS = [
  'pdf',
  'doc',
  'slides',
  'audio',
  'video',
  'web',
  'text',
] as const;
export type ResearchSourceKind = (typeof RESEARCH_SOURCE_KINDS)[number];

/**
 * Per-source manifest entry. Mirrored on the document side so a
 * reload can re-bind to the live session.
 */
export const researchSourceSchema = z
  .object({
    /** User-visible name. */
    name: z.string().min(1),
    /** Source kind (per ADR-007 §D5). */
    kind: z.enum(RESEARCH_SOURCE_KINDS),
    /** Provider-side id; opaque. */
    providerSourceId: z.string().min(1),
    /** ISO 8601 of last upload. */
    lastModified: z.string().datetime(),
    /** SHA-256 of the source bytes for change detection. */
    contentHash: z.string().min(1),
  })
  .strict();
export type ResearchSource = z.infer<typeof researchSourceSchema>;

/**
 * Document-level binding to a research session. When set, asset-gen
 * calls fired against the document inherit the session id (per
 * ADR-008 §D7 routing).
 */
export const researchSessionRefSchema = z
  .object({
    /** Provider name registered on the adapter side (e.g. `'notebooklm'`). */
    provider: z.string().min(1),
    /** Provider-specific session id; opaque to consumers. */
    sessionId: z.string().min(1),
    /** User-visible source manifest; mirrors the provider's view. */
    sources: z.array(researchSourceSchema),
    /** ISO 8601. */
    createdAt: z.string().datetime(),
  })
  .strict();
export type ResearchSessionRef = z.infer<typeof researchSessionRefSchema>;
