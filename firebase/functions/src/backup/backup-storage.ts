// firebase/functions/src/backup/backup-storage.ts
// `backupStorage` — daily Cloud Scheduler trigger (02:00 UTC). Lists each
// production assets bucket and copies every object to
// gs://<backupsBucket>/storage/<bucket-name>/<YYYY-MM-DD>/<object>.
// Also writes a `_manifest.json` so the verifier has a size>0 + JSON-parseable
// sentinel even if the source bucket is empty.
//
// D-T272-2 alternative is GCS Object Versioning; we ship the explicit copy
// path because (a) it gives us a single canonical "what got backed up today"
// directory the verifier can assert against and (b) Object Versioning has
// per-object retention, not bucket-level "snapshot" semantics — the storage
// runbook documents both options.
//
// T-272 AC #2, #3, #4. Determinism: ops code (D-T272-6).

import { type BackupDeps, isoDate, storageBackupObject } from './types.js';

export interface BackupStorageResult {
  readonly success: boolean;
  readonly objectsCopied: number;
  readonly failures: readonly { srcBucket: string; srcObject: string; message: string }[];
  readonly isoDate: string;
}

interface ManifestEntry {
  readonly object: string;
  readonly size: number;
}

interface Manifest {
  readonly bucket: string;
  readonly isoDate: string;
  readonly count: number;
  readonly entries: readonly ManifestEntry[];
}

export async function backupStorageHandler(deps: BackupDeps): Promise<BackupStorageResult> {
  const date = isoDate(deps.clock());
  const failures: { srcBucket: string; srcObject: string; message: string }[] = [];
  let objectsCopied = 0;

  for (const srcBucket of deps.assetsBuckets) {
    const entries: ManifestEntry[] = [];
    let listed: readonly { name: string; size: number }[] = [];
    try {
      listed = await deps.storageCopier.listObjects({ bucket: srcBucket });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push({ srcBucket, srcObject: '<list>', message });
      deps.captureError(err, {
        operation: 'backupStorage.list',
        srcBucket,
        isoDate: date,
      });
      deps.logger.error(
        err instanceof Error ? err : new Error(message),
        `listObjects failed for ${srcBucket}`,
      );
      continue;
    }

    for (const obj of listed) {
      const dstObject = storageBackupObject({
        srcBucket,
        srcObject: obj.name,
        isoDate: date,
      });
      try {
        await deps.storageCopier.copyObject({
          srcBucket,
          srcObject: obj.name,
          dstBucket: deps.backupsBucket,
          dstObject,
        });
        entries.push({ object: obj.name, size: obj.size });
        objectsCopied++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        failures.push({ srcBucket, srcObject: obj.name, message });
        deps.captureError(err, {
          operation: 'backupStorage.copy',
          srcBucket,
          srcObject: obj.name,
          isoDate: date,
        });
        deps.logger.error(
          err instanceof Error ? err : new Error(message),
          `copyObject failed for gs://${srcBucket}/${obj.name}`,
        );
      }
    }

    // Always emit a manifest, even for empty buckets — the verifier looks
    // for a size>0 JSON-parseable sentinel.
    const manifest: Manifest = {
      bucket: srcBucket,
      isoDate: date,
      count: entries.length,
      entries,
    };
    const manifestObject = `storage/${srcBucket}/${date}/_manifest.json`;
    const manifestText = JSON.stringify(manifest, null, 2);
    try {
      await deps.storageCopier.uploadText({
        bucket: deps.backupsBucket,
        object: manifestObject,
        text: manifestText,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push({ srcBucket, srcObject: '<manifest>', message });
      deps.captureError(err, {
        operation: 'backupStorage.manifest',
        srcBucket,
        isoDate: date,
      });
      deps.logger.error(
        err instanceof Error ? err : new Error(message),
        `manifest write failed for ${srcBucket}`,
      );
    }

    deps.logger.info(
      {
        operation: 'backupStorage',
        srcBucket,
        isoDate: date,
        count: entries.length,
      },
      'storage bucket backup complete',
    );
  }

  return {
    success: failures.length === 0,
    objectsCopied,
    failures,
    isoDate: date,
  };
}
