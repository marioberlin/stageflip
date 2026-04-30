/** The Firestore databases T-272 backs up. T-271 introduced `eu-west`. */
export type FirestoreDatabaseId = '(default)' | 'eu-west';
/** Region tag (Cloud Storage subfolder) for each database. */
export type FirestoreRegionTag = 'us' | 'eu';
export interface BackupTarget {
    readonly databaseId: FirestoreDatabaseId;
    readonly regionTag: FirestoreRegionTag;
}
/** Subset of the Firestore Admin REST surface we use. The real client is
 * `google.firestore('v1').projects.databases.exportDocuments`; we DI it as
 * a function so unit tests pass a mock. */
export interface FirestoreExporterLike {
    /** Trigger an export. Returns the operation name + the gs:// path written. */
    exportDocuments(args: {
        readonly project: string;
        readonly databaseId: FirestoreDatabaseId;
        readonly outputUriPrefix: string;
        readonly collectionIds?: readonly string[];
    }): Promise<{
        readonly operationName: string;
        readonly outputUriPrefix: string;
    }>;
}
/** Subset of the GCS surface we use for the Storage backup. */
export interface StorageCopierLike {
    /** List all object names under a bucket prefix. */
    listObjects(args: {
        readonly bucket: string;
        readonly prefix?: string;
    }): Promise<readonly {
        readonly name: string;
        readonly size: number;
    }[]>;
    /** Copy a single object src → dst. */
    copyObject(args: {
        readonly srcBucket: string;
        readonly srcObject: string;
        readonly dstBucket: string;
        readonly dstObject: string;
    }): Promise<void>;
    /** Stat a single object — used by the verifier. Returns null if missing. */
    statObject(args: {
        readonly bucket: string;
        readonly object: string;
    }): Promise<{
        readonly size: number;
    } | null>;
    /** Read a small object as text — used by the verifier for metadata parse. */
    readObjectText(args: {
        readonly bucket: string;
        readonly object: string;
    }): Promise<string | null>;
    /** Upload a UTF-8 text payload — used to write `_manifest.json`. */
    uploadText(args: {
        readonly bucket: string;
        readonly object: string;
        readonly text: string;
    }): Promise<void>;
}
/** Logger surface — matches the subset of `pino` we touch. Off-`@stageflip/observability`
 * mode is a silent no-op (BackupDeps may inject a stub). */
export interface BackupLoggerLike {
    info(obj: Record<string, unknown>, msg?: string): void;
    warn(obj: Record<string, unknown>, msg?: string): void;
    error(obj: Record<string, unknown> | Error, msg?: string): void;
}
/** Sentry surface — matches `captureError` from `@stageflip/observability`. */
export type CaptureErrorLike = (err: unknown, context?: Record<string, unknown>) => void;
export interface BackupDeps {
    readonly firestoreExporter: FirestoreExporterLike;
    readonly storageCopier: StorageCopierLike;
    readonly logger: BackupLoggerLike;
    readonly captureError: CaptureErrorLike;
    readonly clock: () => number;
    /** GCP project id — used for Firestore export REST calls. */
    readonly projectId: string;
    /** Backups bucket where everything lands. Default `gs://stageflip-backups`. */
    readonly backupsBucket: string;
    /** Production Firestore targets — both databases per T-271. */
    readonly firestoreTargets: readonly BackupTarget[];
    /** Production Storage assets buckets to back up. */
    readonly assetsBuckets: readonly string[];
    /** Retention window in days. Verifier reads this to pick the expected date. */
    readonly retentionDays: number;
}
/** YYYY-MM-DD utility — UTC, deterministic given a clock. */
export declare function isoDate(epochMs: number): string;
/** Build the canonical backup path prefix for a Firestore export on a given date. */
export declare function firestoreBackupPrefix(args: {
    readonly bucket: string;
    readonly regionTag: FirestoreRegionTag;
    readonly isoDate: string;
}): string;
/** Build the canonical backup path for a Storage object on a given date. */
export declare function storageBackupObject(args: {
    readonly srcBucket: string;
    readonly srcObject: string;
    readonly isoDate: string;
}): string;
//# sourceMappingURL=types.d.ts.map