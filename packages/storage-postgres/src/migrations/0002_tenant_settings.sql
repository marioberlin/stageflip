-- packages/storage-postgres/src/migrations/0002_tenant_settings.sql
-- T-411a — TenantSettings storage table per docs/tasks/T-411.md D-T411-1
-- + docs/tasks/T-411a.md D-T411a-5. Single row per tenant; `features` is
-- JSONB so v1's `{ interactive }` shape can widen to future fields without
-- a DDL migration.

CREATE TABLE tenant_settings (
  tenant_id   TEXT PRIMARY KEY,
  features    JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL,
  updated_by  TEXT NOT NULL
);
