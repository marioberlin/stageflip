---
'@stageflip/storage-postgres': minor
---

T-270: `@stageflip/storage-postgres` — Postgres-backed StorageAdapter
implementing the same three-tier contract as `InMemoryStorageAdapter`
(snapshot + binary CRDT delta + JSON-Patch). Target dev-grade deployment is
Supabase; the adapter runs unchanged against Cloud SQL, Neon, or
self-hosted Postgres ≥ 13.

The package ships:

- `PostgresStorageAdapter` — the contract implementation. Snapshot tier
  uses `documents` + `snapshots` tables; the patch tier serializes through
  a transactional `SELECT ... FOR UPDATE` row lock so concurrent writers
  cannot both succeed against the same `parentVersion` (one wins, the
  other gets `StorageVersionMismatchError`); the update tier writes to
  `updates` and fires `NOTIFY updates_<docId> '<update_id>'` so per-doc
  subscribers wake up.
- `subscribeUpdates` checks out a dedicated long-lived `LISTEN`
  connection per subscriber, fans the notification stream into an async
  iterator, and releases the connection on `AbortSignal.abort` —
  multi-subscriber fan-out, per-doc isolation, no connection leaks.
- A bundled migration runner (`runMigrations`, `loadMigrations`) with a
  `__migrations` tracking table and per-migration BEGIN/COMMIT (rollback
  on failure). Idempotent at re-run.
- SQLSTATE → application-error mapping (`mapPgError`,
  `StorageContentionError`, `StorageConnectionError`) — `unique_violation`
  on snapshots becomes a version-mismatch-shaped error; deadlocks +
  serialization failures surface as `StorageContentionError`; 08* family
  surfaces as `StorageConnectionError`.

Tests:

- 61 unit tests against `pg-mem` (default `pnpm test` runs these).
- 5 integration tests against a real Postgres container, gated by
  `STAGEFLIP_TEST_PG_INTEGRATION=1`. Required because pg-mem's
  LISTEN/NOTIFY does not deliver across connections, and FOR UPDATE
  blocking under genuine concurrency needs real PG.

Skill + ops docs:

- `skills/stageflip/concepts/storage-contract/SKILL.md` — new concept
  skill enumerating the three tiers and the active adapter set.
- `docs/ops/supabase-setup.md` — Supabase project provisioning,
  connection-string format, migration application, RLS posture (we
  enforce in the app tier, not in the database).

Also adds `jsonify@0.0.1` (Public Domain, transitive via pg-mem →
json-stable-stringify) to the licenses-checker `REVIEWED_OK` allow list
with a rationale comment — equivalent to Unlicense / CC0, already in our
allow set.
