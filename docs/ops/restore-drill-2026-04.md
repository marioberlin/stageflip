# Restore drill log — 2026-04 (T-272)

Status: **PENDING — execution gated on staging readiness**.

## Status disclosure

T-272 ships the backup + verification + runbook + CLI. The full-restore
drill (T-272 D-T272-5 / AC #11–#12) requires an operational staging
Firebase project with seeded data and at least one daily backup landed in
`gs://stageflip-backups-staging/`. Per the T-272 Implementer brief
("Open call" §Option A), staging readiness is operational and not
self-serviceable from this PR.

The drill executes the procedure documented in
`docs/ops/restore-procedure.md` Path 1 (Full restore). The drill is
**mandatory** before T-272 is considered fully closed; this document
captures the agreed plan and reserves the slot for the actual run.

## Pre-drill checklist (operator owns)

- [ ] Staging Firebase project `stageflip-staging` exists with both
      `(default)` and `eu-west` Firestore databases provisioned (per
      T-271).
- [ ] Backups bucket `gs://stageflip-backups-staging/` exists with the
      30-day lifecycle policy applied.
- [ ] Cloud Functions deployed to staging:
      ```
      pnpm --filter @stageflip/firebase-functions build
      firebase deploy --only functions:backupFirestore,functions:backupStorage,functions:verifyBackup --project=stageflip-staging
      ```
- [ ] Staging seeded with realistic data (T-269 seed script will help when
      that lands; until then, ad-hoc seeding is acceptable for drill
      purposes).
- [ ] Wait for at least one daily backup to land. Cron is 02:00 UTC; the
      verifier runs at 03:00 UTC and emits a Sentry breadcrumb on success.
- [ ] Confirm `verifyBackup` reported PASS for at least the most recent
      day (Sentry: no `backup verification failed` alerts on that date).

## Planned drill steps

1. **Snapshot pre-drill state** — capture the staging Firestore + Storage
   state into `gs://stageflip-emergency-snapshots-staging/<timestamp>/`.
   This is the rollback insurance and a parity baseline.
2. **Sabotage** — delete an org's documents in staging:
   ```
   firebase firestore:delete orgs/<test-org-id> --recursive --project=stageflip-staging
   ```
   Record the org ID + the document count before deletion.
3. **Generate the restore plan** with the CLI:
   ```
   pnpm tsx scripts/backup-restore.ts \
     --dry-run \
     --target=staging \
     --backup-date=<yesterday>
   ```
4. **Execute** the restore:
   ```
   pnpm tsx scripts/backup-restore.ts \
     --execute \
     --target=staging \
     --backup-date=<yesterday> \
     --i-have-read-the-runbook \
     > /tmp/staging-restore.sh
   bash /tmp/staging-restore.sh
   ```
5. **Verify** — confirm the sabotaged org's documents are restored:
   ```
   firebase firestore:get orgs/<test-org-id> --project=stageflip-staging
   ```
   Document count must match the pre-sabotage snapshot.
6. **Time the procedure** — record start-to-end duration of step 4. Target
   RTO is 1 hour; if the drill exceeds 1h, this is a finding (escalate
   per T-272 §"Escalation triggers" item 2).
7. **Post-drill cleanup** — delete the emergency snapshot if the drill
   passed.

## Drill execution (PENDING)

Fill in when the drill runs. Sections to populate:

### Date + operator

- Date (UTC):
- Lead operator:
- Witness:
- Staging project:
- Backup date used:

### Timing

- Pre-flight start:
- Sabotage applied:
- Restore plan generated:
- Restore execution start:
- Restore execution end:
- Verification complete:
- **Total RTO**:

### Findings + lessons learned

- (capture any procedural issues found; runbook revisions filed; etc.)

### Outcome

- [ ] Sabotaged org fully recovered? Y / N
- [ ] Document counts match pre-sabotage snapshot? Y / N
- [ ] Within 1-hour RTO target? Y / N
- [ ] Runbook required revisions? Y / N — link to PR

## Status updates

This file is updated whenever drill state changes. Until the drill runs,
this document is the canonical "drill is pending" notice; T-272 ships the
procedure without the executed drill, which is captured as a known gap.
