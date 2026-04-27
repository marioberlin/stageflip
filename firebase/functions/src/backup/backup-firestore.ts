// firebase/functions/src/backup/backup-firestore.ts
// `backupFirestore` — daily Cloud Scheduler trigger (02:00 UTC). Calls
// `firestore.exportDocuments()` for each Firestore database (T-271 ships
// `(default)` US + `eu-west` EU) and writes to
// gs://<backupsBucket>/firestore/<region>/<YYYY-MM-DD>/.
//
// T-272 AC #1, #3, #4. Determinism: ops code (D-T272-6).

import { type BackupDeps, firestoreBackupPrefix, isoDate } from './types.js';

export interface BackupFirestoreResult {
  /** true iff every configured target succeeded. */
  readonly success: boolean;
  /** One entry per successful export. */
  readonly exports: readonly { databaseId: string; outputUriPrefix: string }[];
  /** Per-target failure messages — empty when success === true. */
  readonly failures: readonly { databaseId: string; message: string }[];
  readonly isoDate: string;
}

/**
 * Run a daily Firestore export for every configured target. Per-target
 * failures are isolated: one bad export does NOT prevent the next target
 * from running. Failures surface via `deps.captureError` (Sentry) AND
 * `deps.logger.error` per AC #3/#4.
 */
export async function backupFirestoreHandler(deps: BackupDeps): Promise<BackupFirestoreResult> {
  const date = isoDate(deps.clock());
  const exports: { databaseId: string; outputUriPrefix: string }[] = [];
  const failures: { databaseId: string; message: string }[] = [];

  for (const target of deps.firestoreTargets) {
    const outputUriPrefix = firestoreBackupPrefix({
      bucket: deps.backupsBucket,
      regionTag: target.regionTag,
      isoDate: date,
    });
    try {
      const op = await deps.firestoreExporter.exportDocuments({
        project: deps.projectId,
        databaseId: target.databaseId,
        outputUriPrefix,
      });
      exports.push({ databaseId: target.databaseId, outputUriPrefix: op.outputUriPrefix });
      deps.logger.info(
        {
          operation: 'backupFirestore',
          databaseId: target.databaseId,
          regionTag: target.regionTag,
          isoDate: date,
          operationName: op.operationName,
          outputUriPrefix: op.outputUriPrefix,
        },
        'firestore export started',
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push({ databaseId: target.databaseId, message });
      deps.captureError(err, {
        operation: 'backupFirestore',
        databaseId: target.databaseId,
        regionTag: target.regionTag,
        isoDate: date,
      });
      deps.logger.error(
        err instanceof Error ? err : new Error(message),
        `firestore export failed for ${target.databaseId}`,
      );
    }
  }

  return {
    success: failures.length === 0,
    exports,
    failures,
    isoDate: date,
  };
}
