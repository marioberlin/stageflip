// packages/schema/src/elements/word-cloud.ts
// T-467 — Schema-side `WordCloudClipElement` RIRElement variant.
// Seventh audience-clip variant on the `Element` discriminated union.
// Live aggregating word weights — voters submit one or more words per
// vote (up to `maxWordsPerVoter`), the server aggregates per-word
// frequency, the renderer lays out the words at sizes proportional to
// their weight.
//
// Per ADR-010 §D2 / §D5 + the T-467 spec:
//   - `type: 'word-cloud'` discriminator value.
//   - `props: { prompt: string, maxWords?: number (1..500, default 100),
//     maxWordsPerVoter?: number (1..20, default 3),
//     sessionId?: string }`.
//   - `provenance?: AudienceProvenance` per T-460.
//   - `permissions: readonly ['audience-network']` — frozen literal
//     tuple matching T-455's `AudienceClipManifest` runtime declaration.
//
// Browser-safe — pure Zod. No Node-only imports.

import { z } from 'zod';

import { audienceProvenanceSchema } from './audience-provenance.js';
import { elementBaseSchema } from './base.js';

/**
 * Props shape for the `WordCloudClipElement`. The voter UI parses a
 * comma-separated list, trims + filters empties, and slices to
 * `maxWordsPerVoter`. The aggregation snapshot's `words` length is
 * bounded by `maxWords` (the server-side top-N cap).
 *
 * The optional `sessionId` is bound at session-start time (absent for
 * pre-session authoring stubs and for static-fallback exports where
 * the snapshot is inlined via `provenance` instead).
 */
export const wordCloudClipPropsSchema = z
  .object({
    /**
     * Prompt shown to voters above the input (e.g., "Describe today's
     * keynote in three words"). Non-empty.
     */
    prompt: z.string().min(1),
    /**
     * Server-side top-N cap on the aggregation snapshot's `words`
     * array length. Bounded 1..500; defaults to 100.
     */
    maxWords: z.number().int().positive().max(500).default(100),
    /**
     * Maximum number of words a single voter may submit per vote.
     * Bounded 1..20; defaults to 3. The voter UI enforces this on
     * submission by slicing the parsed list.
     */
    maxWordsPerVoter: z.number().int().positive().max(20).default(3),
    /**
     * Optional session id for live-mount routing. Absent for
     * pre-session authoring (the editor binds it at session-start time)
     * and for static-fallback exports (the snapshot is inlined via
     * `provenance` instead).
     */
    sessionId: z.string().min(1).optional(),
  })
  .strict();

export type WordCloudClipProps = z.infer<typeof wordCloudClipPropsSchema>;

/**
 * `WordCloudClipElement` schema — seventh audience-clip variant on the
 * `Element` union. Mirrors the per-element pattern from the prior
 * audience clip variants: extends `elementBaseSchema` with the `type`
 * discriminator, the per-clip `props`, the `permissions` literal tuple,
 * and the optional `provenance` slot.
 *
 * Permissions are typed as the literal tuple `['audience-network']` so
 * downstream consumers (the audience runtime's mount-time permission
 * check, the `check-audience-permissions` CI gate's runtime-side
 * counterpart) cannot widen the scope at the schema layer.
 */
export const wordCloudClipElementSchema = elementBaseSchema
  .merge(
    z.object({
      type: z.literal('word-cloud'),
      props: wordCloudClipPropsSchema,
      /**
       * Frozen permissions tuple — exactly `['audience-network']` per
       * ADR-009 §D13 + ADR-010 §D6. The tuple shape matches T-455's
       * `AudienceClipManifest.permissions` so the schema-side and the
       * runtime-side declarations cannot drift.
       */
      permissions: z.tuple([z.literal('audience-network')]),
      /**
       * Optional `AudienceProvenance` slot per T-460 / ADR-010 §D5.
       * Present at export time + on persisted post-session documents;
       * absent on a fresh authoring stub.
       */
      provenance: audienceProvenanceSchema.optional(),
    }),
  )
  .strict();

/**
 * Inferred TypeScript type for the schema. Carried across the Element
 * union so downstream type-narrowing on `el.type === 'word-cloud'`
 * gets the strongly-typed props shape.
 */
export type WordCloudClipElement = z.infer<typeof wordCloudClipElementSchema>;
