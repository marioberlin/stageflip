---
"@stageflip/storage": minor
"@stageflip/app-api": minor
---

T-458 — Rate-limit / spam protection per ADR-009 §D3 + §D8.

`@stageflip/storage` adds:
- `AbuseTrackingStore` facet (sibling to `TenantSettingsStore` /
  `TenantCostTrackerStore` / `AudienceResultsStore`). Five-method
  contract: `recordHit / getCounter / flag / getFlag / cleanup`.
- `AbuseSource` discriminated union (`voter-token` / `ip`); `AbuseFlag`
  + `AbuseCounter` Zod-validated wire types.
- `InMemoryAbuseTrackingStore` reference impl with sliding-window hit
  accumulation (default 60 s) + injectable clock (T-443 / T-453
  pattern). The Firestore-backed adapter lands in T-474.

`@stageflip/app-api` adds:
- `TenantRateLimiter` + `VoterRateLimiter` + new `IpJoinRateLimiter`
  consult `AbuseTrackingStore` BEFORE the bucket check; flagged sources
  inside their cooldown window are refused with
  `rejectReason: 'abuse-cooldown'` + the active `flagLevel` (1 / 2 / 3).
- On bucket-exhausted refusals, the limiter records a hit + escalates
  the source's flag when the threshold is crossed:
  level 1 = 30 s cooldown → level 2 = 5 min → level 3 = 1 h
  (within a 1 h escalation window; resets to level 1 after a clean
  hour).
- `VoterRateLimiter.setClipKindOverride(clipKind, rateHz)` lets the
  audience-WS dispatcher admit reaction-stream votes at 10 Hz / voter
  while the default 2 Hz / voter applies elsewhere (per ADR-009 §D3
  line 231). Production wiring registers the
  `'reaction-stream' → 10` override in `server.ts`.
- All limiter `tryConsume` methods are now async (the abuse store is
  async-by-contract). Existing callers updated.
- Per-IP join refusals now carry the same `rejectReason` + `abuseLevel`
  shape on the 429 response body, alongside the existing `lossFlag`.

The eight `LF_AUDIENCE_*` codes from T-452 stay frozen — abuse level is
conveyed via response-body / WS-error metadata, not new codes.

Seventh post-hard-gate task in Phase 15 β. Not a structural extension
per CLAUDE.md §13 (no new degree of freedom in document / binding /
renderer pipeline; render verification N/A).
