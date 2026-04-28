-- packages/storage-postgres/src/migrations/0001_init.sql
-- Initial schema for the StorageAdapter (snapshot + delta + patch tiers).
-- See docs/tasks/T-270.md D-T270-1 for rationale.

-- documents: one row per logical document. `current_version` is the
-- canonical version pointer; `applyPatch` advances it transactionally.
-- Defaults are managed by the adapter's INSERTs (see adapter.ts) rather than
-- DDL-level DEFAULT clauses, so the schema parses identically under pg-mem
-- (used for unit tests) and real PG.
CREATE TABLE documents (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL,
  current_version BIGINT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL
);
CREATE INDEX documents_org_idx ON documents(org_id);

-- snapshots: append-only, never updated. The latest is fetched via
-- documents.current_version. `(doc_id, version)` is the natural primary key
-- so concurrent putSnapshot calls for the same version surface as a
-- unique_violation.
CREATE TABLE snapshots (
  doc_id     TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version    BIGINT NOT NULL,
  content    JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (doc_id, version)
);

-- updates: binary CRDT deltas, one row per applyUpdate call. Indexed by
-- (doc_id, id) so subscribeUpdates' fan-out by id is cheap.
CREATE TABLE updates (
  id         BIGSERIAL PRIMARY KEY,
  doc_id     TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  payload    BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX updates_doc_idx ON updates(doc_id, id);

-- changesets: JSON-Patch ops ordered by (doc_id, created_at).
CREATE TABLE changesets (
  id             TEXT PRIMARY KEY,
  doc_id         TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  parent_version BIGINT NOT NULL,
  ops            JSONB NOT NULL,
  actor          TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL
);
CREATE INDEX changesets_doc_idx ON changesets(doc_id, created_at);
