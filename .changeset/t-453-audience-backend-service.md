---
"@stageflip/app-api": minor
"@stageflip/storage": minor
---

T-453 — Audience backend service per ADR-009 §D1 / §D3 / §D5 / §D6 / §D8 / §D11.

`@stageflip/storage` adds:
- `features.audience` sub-namespace on `TenantSettings`
  (`{ enabled, motionNativeEnabled, maxIngestRateHz,
  maxConcurrentVotersPerSession, retentionDays }`, all required when
  present; the sub-namespace itself is optional). Non-breaking: existing
  tenant-settings rows round-trip unchanged.
- `AudienceSessionDoc` + `AudienceEventDoc` Zod schemas per ADR-009 §D5.
- `AudienceResultsStore` interface + `InMemoryAudienceResultsStore`
  implementation with five methods (`openSession` / `closeSession` /
  `appendEvent` / `readSnapshot` / `setTtl`). Voter-token SHA-256
  hashing with per-tenant pepper injected at construction.

`@stageflip/app-api` adds:
- REST routes at `/v1/audience/sessions/*`: POST `/`,
  POST `/:id/close`, GET `/:id/state`, POST `/:id/join`.
- WebSocket multiplexer (`createAudienceWebSocketServer`) at
  `/v1/audience/ws/:sessionId` using `ws@^8.18.0` (MIT). Handshake
  validates voter token (subprotocol header) or presenter token
  (Authorization header); close codes 4000 / 4001 / 4002 / 4003 per
  ADR-009 §D6. Reconnect-budget tracker (6 attempts / voter).
- Token-bucket `TenantRateLimiter` + `VoterRateLimiter` + generic
  `TokenBucketRateLimiter` with injected clock for tests.
- Server-side emitter for seven `LF-AUDIENCE-*` codes
  (`TENANT-RATE-LIMITED` / `VOTER-RATE-LIMITED` / `SESSION-CLOSED` /
  `CAPACITY-CAP` / `ADAPTER-UNAVAILABLE` / `VENDOR-API-FAILURE` /
  `SNAPSHOT-MISSING`); the client-side `CONNECTION-LOST` code remains
  T-454's responsibility per ADR-009 §D11.

Second post-hard-gate task in Phase 15 β. Not a structural extension
per CLAUDE.md §13 (no new degree of freedom in the document / binding /
renderer pipeline).
