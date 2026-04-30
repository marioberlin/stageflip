import { type BackupDeps } from './types.js';
export interface BackupStorageResult {
    readonly success: boolean;
    readonly objectsCopied: number;
    readonly failures: readonly {
        srcBucket: string;
        srcObject: string;
        message: string;
    }[];
    readonly isoDate: string;
}
export declare function backupStorageHandler(deps: BackupDeps): Promise<BackupStorageResult>;
//# sourceMappingURL=backup-storage.d.ts.map