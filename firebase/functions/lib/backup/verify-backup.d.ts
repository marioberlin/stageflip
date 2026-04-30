import { type BackupDeps } from './types.js';
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
/**
 * Run the daily verification pass. Returns a structured result so callers
 * (the scheduled wrapper or ops drills via the CLI) can react. ANY assertion
 * failure escalates: each failure calls `deps.captureError` and is logged at
 * error level. The handler does NOT throw — it always returns a result.
 */
export declare function verifyBackupHandler(deps: BackupDeps, options?: VerifyBackupOptions): Promise<VerifyBackupResult>;
//# sourceMappingURL=verify-backup.d.ts.map