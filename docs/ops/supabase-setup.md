# Supabase Setup — Postgres StorageAdapter

T-270 ships `@stageflip/storage-postgres`, a `StorageAdapter` implementation
against any Postgres ≥ 13 (the contract from T-025). Supabase is the
documented dev-grade target. This runbook walks through provisioning a
Supabase project, wiring the connection string, and applying the migration.

The adapter does NOT ship a production deployment. T-270 stands the adapter
up; if/when StageFlip cuts over from Firestore to PG for canonical state,
that's a separate strategic decision (see `docs/tasks/T-270.md` Out of Scope).

## 1. Create the Supabase project

1. Sign in at https://supabase.com.
2. **New Project** → choose an organization → set a project name.
3. Generate a strong database password — store it in 1Password under the
   StageFlip vault. The password is only visible at create-time; rotating
   later requires the dashboard.
4. **Region** — pick the region matching your dev tenant's residency
   (`eu-west-1` for the EU tenant, `us-east-1` for US). T-271 routes by
   tenant region; align the storage region.
5. Wait ~2 minutes for the project to provision.

## 2. Connection string

From the Supabase dashboard:

- **Settings → Database → Connection string → URI**.
- Format: `postgres://postgres.<ref>:<password>@<host>:5432/postgres`.

Use the **session pooler (port 5432)**, NOT the transaction pooler (port
6543). The transaction pooler does not support session-bound features that
T-270's LISTEN/NOTIFY relies on — `LISTEN` on a transaction-pooled
connection drops as soon as the transaction returns.

> **Verification, before relying on Supabase for live LISTEN/NOTIFY**:
> Supabase's free tier supports LISTEN/NOTIFY on direct (port 5432)
> connections — verified Apr 2026. Pgbouncer in transaction mode (port
> 6543) does NOT. If Supabase changes this posture in the future, the
> spec's recommended dev-grade target switches; see T-270 escalation
> trigger #3.

## 3. Environment variables

```bash
# StageFlip storage-postgres adapter
STAGEFLIP_PG_URL="postgres://postgres.<ref>:<password>@<host>:5432/postgres"

# (Optional) For integration test runs
STAGEFLIP_TEST_PG_INTEGRATION=1
STAGEFLIP_TEST_PG_URL="${STAGEFLIP_PG_URL}"
```

Add `STAGEFLIP_PG_URL` to the Cloud Run service's secret-manager binding
(see T-231 deployment runbook for the secret-manager wiring pattern).

## 4. Apply the migration

The adapter ships its own migrations and runner. Apply once, on first
deploy or whenever a new migration lands.

```ts
import { Pool } from 'pg';
import {
  PostgresStorageAdapter,
  loadMigrations,
  runMigrations,
} from '@stageflip/storage-postgres';

const pool = new Pool({ connectionString: process.env.STAGEFLIP_PG_URL });
const report = await runMigrations(pool, await loadMigrations());
console.log('applied:', report.applied);
console.log('skipped:', report.skipped);

const storage = new PostgresStorageAdapter({
  pool,
  defaultOrgId: 'org_default', // or the active tenant's org id
});
```

`runMigrations` is idempotent — re-running it on a populated DB skips
already-applied migrations and is safe at every deploy.

## 5. RLS posture

We do **not** use Postgres Row-Level Security. Authorization is enforced in
the application tier (`@stageflip/auth-middleware`); the storage adapter is
authoritative-trust (the upstream caller has already verified the principal
and resolved the tenant). The Supabase service-role key is treated as a
production secret, scoped to the Cloud Run service account.

The justification: app-side enforcement gives us a single auth model
across Firestore (no RLS), Postgres (no RLS), and Realtime DB (security
rules at the leaf, not gateway). Re-implementing the role model in RLS
would split the source of truth.

If StageFlip ever cuts over to Postgres as the primary backend AND we
decide to publish the database to a wider set of services, RLS becomes
worth the duplication. Out of scope for T-270.

## 6. Backups

Supabase provides daily point-in-time backups on paid tiers. The free tier
does NOT — for dev-grade Supabase, accept that the `documents` /
`snapshots` / `updates` / `changesets` tables can be lost between session.

Production deployments should:

- Pin the Supabase tier with backups enabled, OR
- Migrate to Cloud SQL / Neon (both ship branchable / point-in-time
  recovery), OR
- Run a periodic `pg_dump` (cron — out of T-270 scope; pattern matches
  `firebase/functions/backup` from T-272).

## 7. Verification checklist

After applying the migration:

```sql
SELECT name, applied_at FROM __migrations;
SELECT count(*) FROM documents;
```

Then exercise the adapter end-to-end:

```ts
await storage.putSnapshot('demo_doc', {
  docId: 'demo_doc',
  version: 0,
  content: { hello: 'world' },
  updatedAt: new Date().toISOString(),
});
const got = await storage.getSnapshot('demo_doc');
console.log(got);
```

If both succeed, the adapter is wired correctly.

## Related

- `docs/tasks/T-270.md` — task spec (21 acceptance criteria).
- `skills/stageflip/concepts/storage-contract/SKILL.md` — the contract
  this adapter implements.
- T-271 region routing — the Supabase region MUST align with the
  tenant's `org.region`.
- T-272 Firebase backup runbook — pattern for periodic exports.
