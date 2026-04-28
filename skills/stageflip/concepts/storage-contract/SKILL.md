---
title: Storage Contract
id: skills/stageflip/concepts/storage-contract
tier: concept
status: substantive
last_updated: 2026-04-27
owner_task: T-270
related:
  - skills/stageflip/concepts/collab/SKILL.md
  - skills/stageflip/concepts/auth/SKILL.md
---

# Storage Contract

`@stageflip/storage` defines a single `StorageAdapter` interface; concrete
backends implement it. Higher layers (the CRDT provider in T-260, the audit
log, snapshot compaction) bind to the contract, not to a specific backend.

## Three tiers, one interface

| Tier | Methods | Timescale | Purpose |
|---|---|---|---|
| Snapshot | `getSnapshot`, `putSnapshot` | Low frequency | Durable, full-document reads/writes |
| Update | `applyUpdate`, `subscribeUpdates` | High frequency | Binary CRDT deltas (Yjs `Uint8Array`) for live collab |
| Patch | `applyPatch`, `getHistory` | Per-command | Semantic JSON-Patch (RFC 6902) for undo/redo + audit log |

Snapshot and Patch are durable. Update is real-time fan-out — adapters may
or may not persist deltas (in-memory does not; PG appends to an `updates`
table so late readers can replay).

## Concurrency primitive: `parentVersion`

`applyPatch` carries a `parentVersion`. The adapter compares it to the
current version under a lock; on mismatch it throws
`StorageVersionMismatchError`. Callers rebase and retry. This is the
optimistic-concurrency primitive; it's the same shape across every adapter.

## Adapters

| Adapter | Package | Backend | Status |
|---|---|---|---|
| `InMemoryStorageAdapter` | `@stageflip/storage` | `Map`s | T-025 / T-026 — shipped |
| `PostgresStorageAdapter` | `@stageflip/storage-postgres` | pg / Supabase | **T-270 — shipped** |
| (Firestore document adapter) | `@stageflip/storage-firebase` | Firestore | Planned, not yet shipped (the package today exposes asset-storage + region routing only) |

T-270 is the second backend that ships against the contract. It exists to
prove the abstraction holds — Postgres is categorically different from
Firestore (relational, ACID, LISTEN/NOTIFY) but the contract surface is
identical. If T-270 had required contract changes to land, that would have
been evidence the abstraction was leaking; it didn't.

## PostgresStorageAdapter

Schema (four tables, `migrations/0001_init.sql`):

- `documents(id, org_id, current_version, created_at, updated_at)` — one row
  per logical document; `current_version` is the canonical pointer.
- `snapshots(doc_id, version, content JSONB, updated_at)` — append-only,
  primary key `(doc_id, version)`.
- `updates(id BIGSERIAL, doc_id, payload BYTEA, created_at)` — binary CRDT
  deltas.
- `changesets(id, doc_id, parent_version, ops JSONB, actor, created_at)` —
  JSON-Patch entries.

Real-time delta fan-out uses LISTEN/NOTIFY:

- `applyUpdate` INSERTs the row, then fires `NOTIFY updates_<docId>
  '<update_id>'`. The payload carries the row id only — PG NOTIFY caps
  payloads at 8000 bytes.
- `subscribeUpdates` checks out a dedicated long-lived connection from the
  pool, runs `LISTEN updates_<docId>`, fans the notification stream into an
  async iterator, and reads each update by id from the `updates` table.
  On `AbortSignal.abort` the connection is `UNLISTEN`ed and returned to
  the pool.

Concurrency for `applyPatch`:

- `BEGIN`
- `SELECT current_version FROM documents WHERE id = $1 FOR UPDATE`
- if `parentVersion !== current_version`, `ROLLBACK` + throw
  `StorageVersionMismatchError`
- INSERT the changeset; UPDATE `current_version`
- `COMMIT`

The `FOR UPDATE` row lock is the correctness primitive: two concurrent
writers serialize against the same row, the second sees the bumped version,
and exactly one wins.

## Test infrastructure

The package ships two test paths:

- **Unit tests** run against pg-mem (in-memory PG, no Docker) — fast, run
  by default in `pnpm test`.
- **Integration tests** run against a real PG container (testcontainers or
  a local docker-postgres) — gated by `STAGEFLIP_TEST_PG_INTEGRATION=1`.
  The integration path is required because pg-mem's LISTEN/NOTIFY does not
  deliver across connections; cross-connection notification semantics
  (AC #5–#9) and FOR UPDATE blocking under genuine concurrency (AC #10)
  are pinned only there.

## Deployment targets

The same adapter runs against:

- **Supabase** — managed PG, dev-grade target. Setup in
  `docs/ops/supabase-setup.md`.
- **Cloud SQL** — production-grade managed PG.
- **Neon** — production-grade managed PG with branchable databases.
- **Self-hosted** — any PG ≥ 13.

No code changes between targets; the connection string changes.

## What's NOT in the contract

- Multi-tenancy (org_id) is stamped at construction time
  (`PostgresStorageAdapterOptions.defaultOrgId`); the contract is
  per-document. Multi-tenant deployments construct one adapter per org.
- Asset bytes (images, video). Those live in object storage
  (`@stageflip/storage-firebase`'s `createFirebaseAssetStorage`, or any
  S3-compatible alternative).
- Presence (cursors, selection). That's `@stageflip/presence` over RTDB.
- Real-time billing / audit logs. Those subscribe to ChangeSet streams
  (out of band) but don't go through the contract.

## Related

- Tasks: T-025 (contract), T-026 (in-memory dev-grade), T-270
  (Postgres adapter).
- ADR: `docs/decisions/ADR-006-collab-crdt-transport.md` — the CRDT
  transport layer that uses the contract's update tier.
- Ops: `docs/ops/supabase-setup.md` — Supabase project provisioning.
