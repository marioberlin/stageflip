# Backup architecture (T-272)

What StageFlip backs up, where backups land, how long they're kept, and how
the verification loop closes.

## What's backed up

| Source | Tool | Destination | Frequency | Retention |
|---|---|---|---|---|
| Firestore `(default)` (US, `nam5`) | `firestore.exportDocuments` | `gs://stageflip-backups/firestore/us/<date>/` | daily 02:00 UTC | 30 days |
| Firestore `eu-west` (`europe-west3`, T-271) | `firestore.exportDocuments` | `gs://stageflip-backups/firestore/eu/<date>/` | daily 02:00 UTC | 30 days |
| Firestore PITR (both DBs) | Firebase config | in-place | continuous | 7 days |
| Storage `<project>.appspot.com` (US assets) | object copy | `gs://stageflip-backups/storage/<bucket>/<date>/` | daily 02:00 UTC | 30 days |
| Storage `<project>-eu-assets` (EU assets) | object copy | `gs://stageflip-backups/storage/<bucket>/<date>/` | daily 02:00 UTC | 30 days |

## What's NOT backed up

- **Realtime Database (presence)**: ephemeral by design (ADR-006 §D5).
  Never persisted; no backup.
- **Upstash Redis (BullMQ queue)**: ephemeral; jobs replay on retry. No
  backup.
- **CDN cache**: regenerates from Storage on cache miss. No separate
  backup.
- **Whole-region failover**: out of scope for T-272. PITR + 30-day exports
  cover within-region data loss.

## Retention + lifecycle

The backups bucket `gs://stageflip-backups` carries a Cloud Storage
lifecycle policy that auto-deletes objects older than 30 days. The policy
is operationally provisioned (NOT in this codebase); verify it exists:

```bash
gsutil lifecycle get gs://stageflip-backups
```

Expected (truncated):

```json
{
  "rule": [
    { "action": { "type": "Delete" }, "condition": { "age": 30 } }
  ]
}
```

If the policy is missing, the 30-day retention claim does NOT hold —
escalate immediately (per T-272 §"Notes for the Orchestrator" item 5).

## Verification loop (D-T272-3)

`verifyBackup` runs daily at 03:00 UTC (1 hour after backup). For each
expected backup file, it asserts:

1. The file exists at the predicted path.
2. The file's size > 0 (an empty backup file is a failure mode the verifier
   exists to catch).
3. (Best-effort) The file's contents parse as JSON.

On any assertion failure, `captureError` emits a Sentry alert AND the
logger emits at error level. Ops responds via the Sentry on-call rotation.

The verifier expects two kinds of sentinel files:

- **Firestore exports**: `<date>.overall_export_metadata` at the root of
  each export prefix. Firestore writes this automatically.
- **Storage backups**: `_manifest.json` written explicitly by
  `backupStorage` next to each per-bucket date prefix.

## Cloud Functions deployment surface

```
backupFirestore  (onSchedule, "0 2 * * *", Etc/UTC)
backupStorage    (onSchedule, "0 2 * * *", Etc/UTC)
verifyBackup     (onSchedule, "0 3 * * *", Etc/UTC)
```

Source: `firebase/functions/src/backup/`. Production wiring:
`firebase/functions/src/backup/admin-deps.ts`.

Environment variables (set via `firebase functions:config:set` or runtime
config; defaults documented in `admin-deps.ts`):

| Var | Default | Purpose |
|---|---|---|
| `STAGEFLIP_BACKUPS_BUCKET` | `stageflip-backups` | Where backups land |
| `STAGEFLIP_ASSETS_BUCKET_US` | `<project>.appspot.com` | US assets bucket |
| `STAGEFLIP_ASSETS_BUCKET_EU` | `<project>-eu-assets` | EU assets bucket |
| `STAGEFLIP_BACKUP_RETENTION_DAYS` | `30` | Verifier age window |

## Determinism posture (D-T272-6)

`firebase/functions/src/backup/**` is NOT in the determinism scan
(`scripts/check-determinism.ts` `DETERMINISTIC_GLOBS`). Backup ops are
wall-clock + network-driven by nature; the gate exempts them.

## Cross-references

- `docs/ops/restore-procedure.md` — how to restore from these backups.
- `docs/ops/restore-drill-2026-04.md` — drill log.
- `skills/stageflip/concepts/observability/SKILL.md` — observability cross-link.
