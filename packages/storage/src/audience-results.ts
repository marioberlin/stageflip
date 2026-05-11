// packages/storage/src/audience-results.ts
// T-453 — Zod schemas for the Firestore `audience-results` collection per
// ADR-009 §D5. One root document per session
// (`/tenants/{tenantId}/projects/{projectId}/audience-sessions/{sessionId}`)
// with two sub-collections: `events/` (append-only) and `snapshots/`
// (server-emitted aggregations).
//
// The schemas are runtime-validated at every store boundary (defence-in-depth
// per the T-411a pattern). The Firestore-backed implementation lands in
// T-474; this package ships the contract + the in-memory implementation
// used by tests and the default-process-local fallback.

import { z } from 'zod';

import { AUDIENCE_CLIP_KINDS } from '@stageflip/audience-contract';

/**
 * Adapter audit envelope persisted on every session document. Records which
 * adapter served the session (per ADR-009 §D5 — surfaces into
 * `AudienceProvenance` at export time per ADR-010 §D5).
 */
export const audienceSessionAdapterDescriptorSchema = z
  .object({
    id: z.string().min(1),
    license: z.string().min(1),
  })
  .strict();

export type AudienceSessionAdapterDescriptor = z.infer<
  typeof audienceSessionAdapterDescriptorSchema
>;

/**
 * Root session document shape. Per ADR-009 §D5 verbatim:
 *
 *   /tenants/{tenantId}/projects/{projectId}/audience-sessions/{sessionId}
 *   ├── createdAt          ISO 8601
 *   ├── closedAt           ISO 8601 | null
 *   ├── clipKind           AudienceClipKind
 *   ├── voterCount         number (server-maintained running count)
 *   ├── snapshotFrame      number | null (set on close)
 *   ├── adapterDescriptor  { id, license }
 *   └── ttlAt              ISO 8601 (TTL policy per §D5)
 *
 * `snapshot` (optional) holds the most recent aggregation surface for fast
 * presenter reads; the authoritative history lives in `snapshots/{frameNo}`.
 */
export const audienceSessionDocSchema = z
  .object({
    sessionId: z.string().min(1),
    tenantId: z.string().min(1),
    projectId: z.string().min(1),
    clipKind: z.enum(AUDIENCE_CLIP_KINDS),
    createdAt: z.string().datetime(),
    closedAt: z.string().datetime().nullable(),
    voterCount: z.number().int().nonnegative(),
    snapshotFrame: z.number().int().nonnegative().nullable(),
    adapterDescriptor: audienceSessionAdapterDescriptorSchema,
    ttlAt: z.string().datetime(),
  })
  .strict();

export type AudienceSessionDoc = z.infer<typeof audienceSessionDocSchema>;

/**
 * One append-only event in `events/{eventId}`. Per ADR-009 §D5 verbatim:
 *
 *   ├── eventId            ULID (server-assigned at write)
 *   ├── voterTokenHash     SHA-256(pepper + plaintext_token) (hex)
 *   ├── serverTimestamp    ISO 8601
 *   ├── clientTimestamp    ISO 8601
 *   ├── payload            VotePayload (opaque to the store; clip routers parse)
 *   └── accepted           boolean (false rows kept for audit)
 *
 * `voterTokenHash` is the hash — the plaintext voter token MUST NOT be
 * persisted (ADR-009 §D5 voter-token-hashing-at-rest invariant).
 *
 * `payload` is typed as `unknown` here because the store is clip-kind-agnostic;
 * routing code in `apps/api` parses it against `votePayloadSchema` from
 * `@stageflip/audience-contract` before calling `appendEvent`.
 */
export const audienceEventDocSchema = z
  .object({
    eventId: z.string().min(1),
    sessionId: z.string().min(1),
    voterTokenHash: z.string().regex(/^[0-9a-f]{64}$/, 'voterTokenHash must be 64 lowercase hex'),
    serverTimestamp: z.string().datetime(),
    clientTimestamp: z.string().datetime(),
    payload: z.unknown(),
    accepted: z.boolean(),
    rejectReason: z.string().min(1).optional(),
  })
  .strict();

export type AudienceEventDoc = z.infer<typeof audienceEventDocSchema>;
