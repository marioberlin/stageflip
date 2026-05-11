---
'@stageflip/asset-cache': minor
---

T-420 — `@stageflip/asset-cache` ships the content-addressed
cache primitive specified by ADR-008 §D1. Pure interface +
in-memory default; AssetStorage-backed adapters and captions
package migration are deferred per the spec.

Surface (5 named exports + 3 type exports):

- `canonicalize(value)` — JSON canonical-form serializer; recursive
  key-sort; preserves array order; omits undefined object props.
- `normalizePrompt(prompt)` — trim + collapse whitespace + Unicode
  NFC + lowercase per ADR-008 §D1.
- `deriveCacheKey({ modality, model, voice?, prompt, params, seed? })`
  → `{ modality, hash }` — async SHA-256 via Web Crypto SubtleCrypto;
  identical inputs (in any object key order) produce identical hashes.
- `cacheKeyString({ modality, hash })` → `"${modality}/${hash}"` —
  matches ADR-008 §D1's storage-layer modality-bucket prefix.
- `AssetCacheStore<T>` interface — `get` / `set` / `has`, all async.
- `InMemoryAssetCacheStore<T>` — `Map`-backed default; isolated per
  instance; unbounded (production callers wrap with eviction policy).

NOT a structural extension per CLAUDE.md §13 — adds a new package
implementing existing ADR-008 §D1 contract. Render verification N/A.

Captions package migration is deferred to a future task (provisionally
T-436a) — keeps T-420 scoped to the contract package and avoids
bundling churn from adding a new workspace dep to a browser-app
consumer. See `docs/tasks/T-420.md` "Migration tradeoff" for the
mapping decisions the migration task will need to make.
