// firebase/functions/src/backup/test-helpers.ts
// In-memory implementations of the Firestore exporter + GCS copier the
// backup/verify handlers consume. Keeps the unit tests free of any
// firebase-admin / @google-cloud/storage runtime.

import type {
  BackupDeps,
  BackupLoggerLike,
  CaptureErrorLike,
  FirestoreDatabaseId,
  FirestoreExporterLike,
  StorageCopierLike,
} from './types.js';

interface ExportRecord {
  readonly databaseId: FirestoreDatabaseId;
  readonly outputUriPrefix: string;
}

export class MemoryFirestoreExporter implements FirestoreExporterLike {
  readonly exports: ExportRecord[] = [];
  /** When set, the next exportDocuments() call rejects with this error. */
  failNextWith: Error | null = null;

  async exportDocuments(args: {
    project: string;
    databaseId: FirestoreDatabaseId;
    outputUriPrefix: string;
    collectionIds?: readonly string[];
  }): Promise<{ operationName: string; outputUriPrefix: string }> {
    if (this.failNextWith !== null) {
      const err = this.failNextWith;
      this.failNextWith = null;
      throw err;
    }
    this.exports.push({ databaseId: args.databaseId, outputUriPrefix: args.outputUriPrefix });
    return {
      operationName: `projects/${args.project}/databases/${args.databaseId}/operations/op-${this.exports.length}`,
      outputUriPrefix: args.outputUriPrefix,
    };
  }
}

interface StoredObject {
  readonly bucket: string;
  readonly object: string;
  readonly size: number;
  readonly text: string | null;
}

export class MemoryStorageCopier implements StorageCopierLike {
  readonly objects = new Map<string, StoredObject>();
  readonly copies: { src: string; dst: string }[] = [];

  static keyOf(bucket: string, object: string): string {
    return `${bucket}::${object}`;
  }

  /** Test helper: seed an object the copier or verifier may discover. */
  seed(args: { bucket: string; object: string; size: number; text?: string }): void {
    this.objects.set(MemoryStorageCopier.keyOf(args.bucket, args.object), {
      bucket: args.bucket,
      object: args.object,
      size: args.size,
      text: args.text ?? null,
    });
  }

  async listObjects(args: {
    bucket: string;
    prefix?: string;
  }): Promise<readonly { name: string; size: number }[]> {
    const out: { name: string; size: number }[] = [];
    for (const obj of this.objects.values()) {
      if (obj.bucket !== args.bucket) continue;
      if (args.prefix && !obj.object.startsWith(args.prefix)) continue;
      out.push({ name: obj.object, size: obj.size });
    }
    return out;
  }

  async copyObject(args: {
    srcBucket: string;
    srcObject: string;
    dstBucket: string;
    dstObject: string;
  }): Promise<void> {
    const src = this.objects.get(MemoryStorageCopier.keyOf(args.srcBucket, args.srcObject));
    if (!src) {
      throw new Error(`source object missing: gs://${args.srcBucket}/${args.srcObject}`);
    }
    this.objects.set(MemoryStorageCopier.keyOf(args.dstBucket, args.dstObject), {
      bucket: args.dstBucket,
      object: args.dstObject,
      size: src.size,
      text: src.text,
    });
    this.copies.push({
      src: `gs://${args.srcBucket}/${args.srcObject}`,
      dst: `gs://${args.dstBucket}/${args.dstObject}`,
    });
  }

  async statObject(args: { bucket: string; object: string }): Promise<{ size: number } | null> {
    const obj = this.objects.get(MemoryStorageCopier.keyOf(args.bucket, args.object));
    return obj ? { size: obj.size } : null;
  }

  async readObjectText(args: { bucket: string; object: string }): Promise<string | null> {
    const obj = this.objects.get(MemoryStorageCopier.keyOf(args.bucket, args.object));
    return obj ? obj.text : null;
  }

  async uploadText(args: { bucket: string; object: string; text: string }): Promise<void> {
    this.objects.set(MemoryStorageCopier.keyOf(args.bucket, args.object), {
      bucket: args.bucket,
      object: args.object,
      size: Buffer.byteLength(args.text, 'utf8'),
      text: args.text,
    });
  }
}

interface RecordedLog {
  readonly level: 'info' | 'warn' | 'error';
  readonly obj: Record<string, unknown> | Error;
  readonly msg: string | undefined;
}

export class RecordingLogger implements BackupLoggerLike {
  readonly entries: RecordedLog[] = [];
  info(obj: Record<string, unknown>, msg?: string): void {
    this.entries.push({ level: 'info', obj, msg });
  }
  warn(obj: Record<string, unknown>, msg?: string): void {
    this.entries.push({ level: 'warn', obj, msg });
  }
  error(obj: Record<string, unknown> | Error, msg?: string): void {
    this.entries.push({ level: 'error', obj, msg });
  }
  errorEntries(): RecordedLog[] {
    return this.entries.filter((e) => e.level === 'error');
  }
}

interface CapturedError {
  readonly err: unknown;
  readonly context: Record<string, unknown> | undefined;
}

export function makeCaptureError(): { fn: CaptureErrorLike; calls: CapturedError[] } {
  const calls: CapturedError[] = [];
  const fn: CaptureErrorLike = (err, context) => {
    calls.push({ err, context });
  };
  return { fn, calls };
}

export function fakeBackupDeps(overrides: Partial<BackupDeps> = {}): BackupDeps {
  let now = 1_700_000_000_000;
  const firestoreExporter = overrides.firestoreExporter ?? new MemoryFirestoreExporter();
  const storageCopier = overrides.storageCopier ?? new MemoryStorageCopier();
  const logger = overrides.logger ?? new RecordingLogger();
  const captureError = overrides.captureError ?? (() => undefined);
  return {
    firestoreExporter,
    storageCopier,
    logger,
    captureError,
    clock: overrides.clock ?? (() => now++),
    projectId: overrides.projectId ?? 'stageflip-test',
    backupsBucket: overrides.backupsBucket ?? 'stageflip-backups',
    firestoreTargets: overrides.firestoreTargets ?? [
      { databaseId: '(default)', regionTag: 'us' },
      { databaseId: 'eu-west', regionTag: 'eu' },
    ],
    assetsBuckets: overrides.assetsBuckets ?? ['stageflip-assets', 'stageflip-eu-assets'],
    retentionDays: overrides.retentionDays ?? 30,
  };
}
