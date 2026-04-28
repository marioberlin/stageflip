# Restore procedure runbook (T-272)

Operational runbook for restoring StageFlip data from backup. Source of truth
for the architecture is `docs/ops/backup-architecture.md`. The drill log
(`docs/ops/restore-drill-2026-04.md`) records the most recent rehearsal of
this procedure.

This runbook covers three restore paths:

1. **Full restore** — catastrophic data loss; everything in a Firestore
   database or assets bucket is gone or corrupted. Drilled via T-272.
2. **Per-collection restore** — one Firestore collection corrupted, others
   intact. Documented; not drilled (lower stakes; same primitives).
3. **Per-document point-in-time recovery (PITR)** — a small number of
   documents lost to a recent bad write. Documented; uses Firestore PITR's
   7-day window.

**STOP** before executing any of these against production. Notify the
on-call engineering manager AND legal-in-the-loop AND the affected customer
(if known). Restoration overwrites live data; mistakes here do not have a
"ctrl-Z".

## Authentication + IAM prerequisites

The operator must be authenticated as a Google Cloud principal with the
following IAM roles on the StageFlip project. We assume the principal is the
human operator's `@showheroes.com` Google identity, NOT a service account
key (service-account keys are forbidden by ops policy).

| Step | Required role |
|---|---|
| Read backups bucket | `roles/storage.objectViewer` on `gs://stageflip-backups` |
| Import to Firestore | `roles/datastore.importExportAdmin` on the project |
| Write to assets buckets | `roles/storage.objectAdmin` on the assets buckets |
| Read Firestore PITR | `roles/datastore.viewer` on the project |

```bash
gcloud auth login
gcloud config set project stageflip            # or stageflip-staging
gcloud auth application-default login          # for SDKs
```

The Cloud Functions runtime service account
(`<project>@appspot.gserviceaccount.com`) needs:

- `roles/datastore.importExportAdmin` (for `backupFirestore` to call
  `firestore.exportDocuments`).
- `roles/storage.objectAdmin` on `gs://stageflip-backups` (for
  `backupStorage` and the export to write).
- `roles/storage.objectViewer` on the assets buckets (for `backupStorage`
  to list + copy).

These are operationally provisioned; verify with:

```bash
gcloud projects get-iam-policy stageflip \
  --flatten="bindings[].members" \
  --filter="bindings.members:stageflip@appspot.gserviceaccount.com"
```

## Path 1 — Full restore (drilled)

### Prerequisites

- [ ] Customer / engineering / legal sign-off on file (Slack thread linked
      in the incident channel).
- [ ] Read this entire procedure end-to-end. Yes, all of it.
- [ ] Confirm the target environment: `stageflip-staging` for drills,
      `stageflip` for prod incidents.
- [ ] Identify the backup date to restore from. List recent backups:
      ```bash
      gsutil ls gs://stageflip-backups/firestore/us/   # US backups
      gsutil ls gs://stageflip-backups/firestore/eu/   # EU backups
      gsutil ls gs://stageflip-backups/storage/        # storage backups
      ```
- [ ] Verify the chosen backup passed `verifyBackup` on its expected day
      (search Sentry for alerts on that date; absence of alert == passed).
- [ ] Snapshot the current (broken) state to a holding bucket FIRST:
      ```bash
      gcloud firestore export gs://stageflip-emergency-snapshots/$(date +%Y-%m-%dT%H%M%S)/ \
        --project=stageflip --database='(default)'
      gcloud firestore export gs://stageflip-emergency-snapshots/$(date +%Y-%m-%dT%H%M%S)/eu/ \
        --project=stageflip --database='eu-west'
      ```
      This is the rollback insurance.
- [ ] Put the affected app domain(s) into maintenance mode (gates writes;
      maintenance flag is in `apps/*/src/maintenance.ts`).

### Step-by-step

The CLI helper prints the canonical command sequence:

```bash
pnpm tsx scripts/backup-restore.ts \
  --dry-run \
  --target=staging \        # or `prod` — the CLI accepts only these two values
  --backup-date=2026-04-27
```

For a real restore, generate the executable script:

```bash
pnpm tsx scripts/backup-restore.ts \
  --execute \
  --target=staging \
  --backup-date=2026-04-27 \
  --i-have-read-the-runbook \
  > /tmp/restore.sh
# REVIEW /tmp/restore.sh end-to-end before running.
bash /tmp/restore.sh
```

For prod, the CLI prompts for an interactive `yes` confirmation; type it
exactly. The script then prints (does NOT execute) the canonical commands;
operator pipes to bash under buddy-system supervision.

The canonical commands, for reference:

```bash
# 1. Import (default) Firestore (US, T-271).
gcloud firestore import gs://stageflip-backups/firestore/us/2026-04-27 \
  --project=stageflip \
  --database='(default)'

# 2. Import eu-west Firestore (EU, T-271).
gcloud firestore import gs://stageflip-backups/firestore/eu/2026-04-27 \
  --project=stageflip \
  --database='eu-west'

# 3. Mirror US assets back to the live bucket. --delete-unmatched=false:
#    we do not want to remove objects that arrived AFTER the backup date.
gsutil -m rsync -r \
  gs://stageflip-backups/storage/stageflip.appspot.com/2026-04-27/ \
  gs://stageflip.appspot.com/

# 4. Mirror EU assets.
gsutil -m rsync -r \
  gs://stageflip-backups/storage/stageflip-eu-assets/2026-04-27/ \
  gs://stageflip-eu-assets/

# 5. Sanity check: document counts, bucket sizes.
firebase firestore:databases:list --project=stageflip
gsutil du -sh gs://stageflip.appspot.com/ gs://stageflip-eu-assets/
```

Firestore `gcloud firestore import` is asynchronous and returns an
operation handle. Poll until done:

```bash
gcloud firestore operations list --project=stageflip
gcloud firestore operations describe <opName> --project=stageflip
```

### Verification

- [ ] Smoke test with the `e2e:slide` suite against the restored project:
      `pnpm e2e:slide` (configured to hit `stageflip-staging`).
- [ ] Spot-check 3–5 known-good org IDs: visit each in a browser and
      confirm decks load, members are present.
- [ ] Compare document counts in `orgs/`, `users/`, and any backup-relevant
      collections to the pre-incident snapshot (best-effort — counts may
      drift if the incident itself caused churn).
- [ ] Inspect the Firestore audit logs for the restore operation; no
      unexpected mutations after the import operation completed.

### Rollback plan

If verification fails or the restored state is worse than the broken state:

1. Re-import from the **emergency snapshot** taken in pre-flight:
   ```bash
   gcloud firestore import gs://stageflip-emergency-snapshots/<timestamp>/ \
     --project=stageflip --database='(default)'
   ```
2. Repeat for `eu-west`.
3. For storage: `gsutil -m rsync -r` from the emergency snapshot to the
   live bucket. (Storage rollback is best-effort; objects added during
   the failed restore window may be lost.)
4. Document the failed restore in the incident postmortem; update this
   runbook with the discovered failure mode.

### Communication

- During restore: pin a Slack message in the incident channel every
  15 minutes with the operation status.
- Post-restore: write the postmortem within 48h. Update this runbook AND
  `docs/ops/backup-architecture.md` with any architectural lessons.

## Path 2 — Per-collection restore (documented; not drilled)

When one Firestore collection is corrupted but the rest of the database is
intact:

1. Create a SCRATCH database in the same project to avoid clobbering
   intact collections:
   ```bash
   gcloud firestore databases create --database=scratch-restore \
     --location=nam5 --type=firestore-native --project=stageflip
   ```
2. Import the affected backup into the scratch database, restricted to the
   single collection:
   ```bash
   gcloud firestore import gs://stageflip-backups/firestore/us/2026-04-27 \
     --project=stageflip \
     --database=scratch-restore \
     --collection-ids=invites
   ```
3. Read the recovered collection from `scratch-restore` via the Admin SDK
   and write it back to `(default)` with a small migration script. Lock
   writes on the affected collection during the migration.
4. Verify, then delete the scratch database:
   ```bash
   gcloud firestore databases delete --database=scratch-restore \
     --project=stageflip
   ```

NOTE: Firestore `import` is all-or-nothing per collection. Partial
documents within a collection cannot be restored without a custom
migration script — escalate if you need that.

## Path 3 — Per-document point-in-time recovery (PITR)

Firestore PITR retains 7 days of fine-grained history. For older data, use
Path 1 or Path 2 instead.

PITR is enabled per database. Verify it's on:

```bash
gcloud firestore databases describe --database='(default)' --project=stageflip
gcloud firestore databases describe --database='eu-west'   --project=stageflip
# Look for: pointInTimeRecoveryEnablement: POINT_IN_TIME_RECOVERY_ENABLED
```

To recover a single document at a point in time within the last 7 days:

```bash
# Read the doc as-of T:
gcloud firestore documents describe orgs/<orgId>/members/<userId> \
  --project=stageflip --database='(default)' \
  --read-time='2026-04-27T03:00:00Z'
```

Or via the Admin SDK with `firestore.runTransaction({ readOnly: { readTime } })`.

Reconstructed documents are written back via a normal admin SDK write. Pin
a small script per incident; do not productize PITR-restore as
self-service (high-stakes).

## Cross-references

- `docs/ops/backup-architecture.md` — what's backed up, where, retention.
- `docs/ops/restore-drill-2026-04.md` — most recent drill log.
- `firebase/functions/src/backup/` — backup + verify Cloud Functions.
- `scripts/backup-restore.ts` — CLI helper (T-272 AC #13/#14).
- `skills/stageflip/concepts/observability/SKILL.md` §"Backup + restore" —
  one-line cross-link.
