---
"@stageflip/storage": patch
"@stageflip/app-api": minor
---

T-459 — Result-export endpoint per ADR-009 §D5 + the implementation-plan
T-459 entry. Eighth post-hard-gate task in Phase 15 β.

`@stageflip/storage` adds:
- `AudienceResultsStore.listEvents(sessionId, opts?)` interface method
  returning `Promise<readonly AudienceEventDoc[]>` ordered by
  `serverTimestamp` ascending. Cursor pagination via
  `opts.after` (exclusive ISO 8601) + `opts.limit` (default 10000).
- `ListEventsOptions` exported type.
- `InMemoryAudienceResultsStore.listEvents` implementation (sorts +
  filters + slices in-memory). The Firestore-backed implementation
  lands in T-474.
- The previously test-only `listEvents(sessionId): readonly
  AudienceEventDoc[]` is now async (`Promise<readonly
  AudienceEventDoc[]>`) and accepts the optional `ListEventsOptions`.
  In-tree callers (apps/api/src/routes/audience-ws.test.ts) updated.

`@stageflip/app-api` adds:
- `GET /v1/audience/sessions/:sessionId/export?format=csv|json` —
  presenter-authenticated, tenant rate-limited (reuses the same
  `TenantRateLimiter` axis as openSession), pages through `listEvents`
  with the configured page-size window.
  - `format=json` (default) returns
    `{ session: AudienceSessionDoc, events: AudienceEventDoc[] }`.
  - `format=csv` returns RFC 4180-compliant CSV with
    `Content-Disposition: attachment; filename="audience-<sessionId>.csv"`.
  - Unknown format → HTTP 400 `error: 'invalid_format'`.
  - Both responses set `Vary: format`.
- `encodeAudienceEventsCsv(events)` — pure RFC 4180 encoder. Header
  `eventId,sessionId,clipKind,voterTokenHash,kind,appendedAt,payload`;
  per-cell quoting per RFC 4180 §2.6 + §2.7; payload column is
  `JSON.stringify(payload)` then RFC-quoted.

Voter-token hashing posture preserved per ADR-009 §D5: the
`voterTokenHash` column emits the stored hash directly (NEVER
un-hashed).

Not a structural extension per CLAUDE.md §13 (no new degree of freedom
in the document / binding / renderer pipeline; render verification
N/A).
