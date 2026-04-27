// firebase/functions/src/backup/verify-backup.ts
// `verifyBackup` — daily Cloud Scheduler trigger (03:00 UTC, 1h after backup).
// Asserts that yesterday's expected backup files exist, are non-empty, and
// (best-effort) contain parseable JSON metadata.
//
// On any assertion failure, emits a Sentry alert via captureError AND logs at
// error level. The T-264 logger semantics also auto-promote `.error(err)`,
// but ops code uses captureError directly with structured context.
//
// T-272 AC #5, #6, #7. Determinism: ops code (D-T272-6).

import { type BackupDeps, isoDate } from './types.js';

export type VerifyFailureReason = 'missing' | 'empty' | 'malformed';

export interface VerifyFailure {
  readonly target: string;
  readonly bucket: string;
  readonly object: string;
  readonly reason: VerifyFailureReason;
  readonly detail?: string;
}

export interface VerifyBackupResult {
  readonly ok: boolean;
  readonly isoDate: string;
  readonly failures: readonly VerifyFailure[];
  readonly checked: number;
}

export interface VerifyBackupOptions {
  /** Override the iso-date the verifier looks for. Default: today (UTC). */
  readonly isoDate?: string;
}

interface ExpectedFile {
  readonly target: string;
  readonly object: string;
}

function expectedFiles(args: {
  deps: BackupDeps;
  isoDate: string;
}): ExpectedFile[] {
  const out: ExpectedFile[] = [];
  for (const t of args.deps.firestoreTargets) {
    // Firestore export writes a directory; the canonical sentinel file is
    // <isoDate>.overall_export_metadata at the root of that prefix.
    out.push({
      target: `firestore:${t.databaseId}`,
      object: `firestore/${t.regionTag}/${args.isoDate}/${args.isoDate}.overall_export_metadata`,
    });
  }
  for (const bucket of args.deps.assetsBuckets) {
    out.push({
      target: `storage:${bucket}`,
      object: `storage/${bucket}/${args.isoDate}/_manifest.json`,
    });
  }
  return out;
}

/**
 * Run the daily verification pass. Returns a structured result so callers
 * (the scheduled wrapper or ops drills via the CLI) can react. ANY assertion
 * failure escalates: each failure calls `deps.captureError` and is logged at
 * error level. The handler does NOT throw — it always returns a result.
 */
export async function verifyBackupHandler(
  deps: BackupDeps,
  options: VerifyBackupOptions = {},
): Promise<VerifyBackupResult> {
  const date = options.isoDate ?? isoDate(deps.clock());
  const expected = expectedFiles({ deps, isoDate: date });
  const failures: VerifyFailure[] = [];

  for (const file of expected) {
    const stat = await deps.storageCopier.statObject({
      bucket: deps.backupsBucket,
      object: file.object,
    });
    if (stat === null) {
      const failure: VerifyFailure = {
        target: file.target,
        bucket: deps.backupsBucket,
        object: file.object,
        reason: 'missing',
      };
      failures.push(failure);
      reportFailure(deps, failure, date);
      continue;
    }
    if (stat.size <= 0) {
      const failure: VerifyFailure = {
        target: file.target,
        bucket: deps.backupsBucket,
        object: file.object,
        reason: 'empty',
      };
      failures.push(failure);
      reportFailure(deps, failure, date);
      continue;
    }
    // Best-effort JSON parse for the metadata sentinels — both Firestore
    // export metadata and storage manifests are JSON.
    const text = await deps.storageCopier.readObjectText({
      bucket: deps.backupsBucket,
      object: file.object,
    });
    if (text !== null) {
      try {
        JSON.parse(text);
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        const failure: VerifyFailure = {
          target: file.target,
          bucket: deps.backupsBucket,
          object: file.object,
          reason: 'malformed',
          detail,
        };
        failures.push(failure);
        reportFailure(deps, failure, date);
      }
    }
  }

  if (failures.length === 0) {
    deps.logger.info(
      { operation: 'verifyBackup', isoDate: date, checked: expected.length },
      'backup verification passed',
    );
  }

  return {
    ok: failures.length === 0,
    isoDate: date,
    failures,
    checked: expected.length,
  };
}

function reportFailure(deps: BackupDeps, failure: VerifyFailure, date: string): void {
  const message = `backup verification failed: ${failure.target} ${failure.reason} at gs://${failure.bucket}/${failure.object}`;
  const err = new Error(message);
  deps.captureError(err, {
    operation: 'verifyBackup',
    target: failure.target,
    reason: failure.reason,
    bucket: failure.bucket,
    object: failure.object,
    isoDate: date,
    ...(failure.detail !== undefined ? { detail: failure.detail } : {}),
  });
  deps.logger.error(err, message);
}
