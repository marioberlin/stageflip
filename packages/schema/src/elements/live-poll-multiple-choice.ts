// packages/schema/src/elements/live-poll-multiple-choice.ts
// T-461 — Schema-side `LivePollMultipleChoiceClipElement` RIRElement
// variant. The first audience-clip variant on the `Element`
// discriminated union; sets the precedent for T-462..T-471 (the eight
// sibling clip families).
//
// Per ADR-010 §D2 / §D5 + the T-461 spec:
//   - `kind: 'live-poll-multiple-choice'` discriminator value, but per
//     the schema convention we use `type: 'live-poll-multiple-choice'`
//     (matching every other element variant in this directory; see
//     `text.ts`, `interactive.ts`).
//   - `props: { question: string (min 1), options: 2..10 strings (min 1
//     each), sessionId?: string }`.
//   - `provenance?: AudienceProvenance` per T-460.
//   - `permissions: readonly ['audience-network']` — frozen literal
//     tuple matching T-455's `AudienceClipManifest` runtime declaration.
//
// Browser-safe — pure Zod. No Node-only imports.

import { z } from 'zod';

import { audienceProvenanceSchema } from './audience-provenance.js';
import { elementBaseSchema } from './base.js';

/**
 * Props shape for the `LivePollMultipleChoiceClipElement`. Per ADR-010
 * §D2 the matching `LivePollMultipleChoiceVote` is `{ kind:
 * 'live-poll-multiple-choice', optionIndex: 0..(options.length - 1) }`;
 * the option indices voters submit are bounded by `options.length` here.
 */
export const livePollMultipleChoiceClipPropsSchema = z
  .object({
    /** The question put to the audience. Must be non-empty. */
    question: z.string().min(1),
    /**
     * Closed list of options voters can pick from. ADR-010 §D2 + §D3
     * imply a small fan-out (the bar-chart layout becomes unreadable
     * past ~10 options); the 2..10 bound is the T-461 spec constraint.
     */
    options: z.array(z.string().min(1)).min(2).max(10),
    /**
     * Optional session id for live-mount routing. Absent for
     * pre-session authoring (the editor binds it at session-start time)
     * and for static-fallback exports (the snapshot is inlined via
     * `provenance` instead).
     */
    sessionId: z.string().min(1).optional(),
  })
  .strict();

export type LivePollMultipleChoiceClipProps = z.infer<typeof livePollMultipleChoiceClipPropsSchema>;

/**
 * `LivePollMultipleChoiceClipElement` schema — first audience-clip
 * variant on the `Element` union. Mirrors the per-element pattern from
 * `text.ts` / `image.ts`: extends `elementBaseSchema` with the
 * `type` discriminator, the per-clip `props`, the `permissions`
 * literal tuple, and the optional `provenance` slot.
 *
 * Permissions are typed as the literal tuple `['audience-network']` so
 * downstream consumers (the audience runtime's mount-time permission
 * check, the `check-audience-permissions` CI gate's runtime-side
 * counterpart) cannot widen the scope at the schema layer.
 */
export const livePollMultipleChoiceClipElementSchema = elementBaseSchema
  .merge(
    z.object({
      type: z.literal('live-poll-multiple-choice'),
      props: livePollMultipleChoiceClipPropsSchema,
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
 * union so downstream type-narrowing on `el.type ===
 * 'live-poll-multiple-choice'` gets the strongly-typed props shape.
 */
export type LivePollMultipleChoiceClipElement = z.infer<
  typeof livePollMultipleChoiceClipElementSchema
>;
