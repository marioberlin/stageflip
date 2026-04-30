import type { BackupDeps, BackupLoggerLike, CaptureErrorLike, FirestoreDatabaseId, FirestoreExporterLike, StorageCopierLike } from './types.js';
interface ExportRecord {
    readonly databaseId: FirestoreDatabaseId;
    readonly outputUriPrefix: string;
}
export declare class MemoryFirestoreExporter implements FirestoreExporterLike {
    readonly exports: ExportRecord[];
    /** When set, the next exportDocuments() call rejects with this error. */
    failNextWith: Error | null;
    exportDocuments(args: {
        project: string;
        databaseId: FirestoreDatabaseId;
        outputUriPrefix: string;
        collectionIds?: readonly string[];
    }): Promise<{
        operationName: string;
        outputUriPrefix: string;
    }>;
}
interface StoredObject {
    readonly bucket: string;
    readonly object: string;
    readonly size: number;
    readonly text: string | null;
}
export declare class MemoryStorageCopier implements StorageCopierLike {
    readonly objects: Map<string, StoredObject>;
    readonly copies: {
        src: string;
        dst: string;
    }[];
    static keyOf(bucket: string, object: string): string;
    /** Test helper: seed an object the copier or verifier may discover. */
    seed(args: {
        bucket: string;
        object: string;
        size: number;
        text?: string;
    }): void;
    listObjects(args: {
        bucket: string;
        prefix?: string;
    }): Promise<readonly {
        name: string;
        size: number;
    }[]>;
    copyObject(args: {
        srcBucket: string;
        srcObject: string;
        dstBucket: string;
        dstObject: string;
    }): Promise<void>;
    statObject(args: {
        bucket: string;
        object: string;
    }): Promise<{
        size: number;
    } | null>;
    readObjectText(args: {
        bucket: string;
        object: string;
    }): Promise<string | null>;
    uploadText(args: {
        bucket: string;
        object: string;
        text: string;
    }): Promise<void>;
}
interface RecordedLog {
    readonly level: 'info' | 'warn' | 'error';
    readonly obj: Record<string, unknown> | Error;
    readonly msg: string | undefined;
}
export declare class RecordingLogger implements BackupLoggerLike {
    readonly entries: RecordedLog[];
    info(obj: Record<string, unknown>, msg?: string): void;
    warn(obj: Record<string, unknown>, msg?: string): void;
    error(obj: Record<string, unknown> | Error, msg?: string): void;
    errorEntries(): RecordedLog[];
}
interface CapturedError {
    readonly err: unknown;
    readonly context: Record<string, unknown> | undefined;
}
export declare function makeCaptureError(): {
    fn: CaptureErrorLike;
    calls: CapturedError[];
};
export declare function fakeBackupDeps(overrides?: Partial<BackupDeps>): BackupDeps;
export {};
//# sourceMappingURL=test-helpers.d.ts.map