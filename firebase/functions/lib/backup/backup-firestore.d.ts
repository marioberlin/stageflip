import { type BackupDeps } from './types.js';
export interface BackupFirestoreResult {
    /** true iff every configured target succeeded. */
    readonly success: boolean;
    /** One entry per successful export. */
    readonly exports: readonly {
        databaseId: string;
        outputUriPrefix: string;
    }[];
    /** Per-target failure messages — empty when success === true. */
    readonly failures: readonly {
        databaseId: string;
        message: string;
    }[];
    readonly isoDate: string;
}
/**
 * Run a daily Firestore export for every configured target. Per-target
 * failures are isolated: one bad export does NOT prevent the next target
 * from running. Failures surface via `deps.captureError` (Sentry) AND
 * `deps.logger.error` per AC #3/#4.
 */
export declare function backupFirestoreHandler(deps: BackupDeps): Promise<BackupFirestoreResult>;
//# sourceMappingURL=backup-firestore.d.ts.map