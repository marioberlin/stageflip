// firebase/functions/src/backup/test-helpers.ts
// In-memory implementations of the Firestore exporter + GCS copier the
// backup/verify handlers consume. Keeps the unit tests free of any
// firebase-admin / @google-cloud/storage runtime.
export class MemoryFirestoreExporter {
    exports = [];
    /** When set, the next exportDocuments() call rejects with this error. */
    failNextWith = null;
    async exportDocuments(args) {
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
export class MemoryStorageCopier {
    objects = new Map();
    copies = [];
    static keyOf(bucket, object) {
        return `${bucket}::${object}`;
    }
    /** Test helper: seed an object the copier or verifier may discover. */
    seed(args) {
        this.objects.set(MemoryStorageCopier.keyOf(args.bucket, args.object), {
            bucket: args.bucket,
            object: args.object,
            size: args.size,
            text: args.text ?? null,
        });
    }
    async listObjects(args) {
        const out = [];
        for (const obj of this.objects.values()) {
            if (obj.bucket !== args.bucket)
                continue;
            if (args.prefix && !obj.object.startsWith(args.prefix))
                continue;
            out.push({ name: obj.object, size: obj.size });
        }
        return out;
    }
    async copyObject(args) {
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
    async statObject(args) {
        const obj = this.objects.get(MemoryStorageCopier.keyOf(args.bucket, args.object));
        return obj ? { size: obj.size } : null;
    }
    async readObjectText(args) {
        const obj = this.objects.get(MemoryStorageCopier.keyOf(args.bucket, args.object));
        return obj ? obj.text : null;
    }
    async uploadText(args) {
        this.objects.set(MemoryStorageCopier.keyOf(args.bucket, args.object), {
            bucket: args.bucket,
            object: args.object,
            size: Buffer.byteLength(args.text, 'utf8'),
            text: args.text,
        });
    }
}
export class RecordingLogger {
    entries = [];
    info(obj, msg) {
        this.entries.push({ level: 'info', obj, msg });
    }
    warn(obj, msg) {
        this.entries.push({ level: 'warn', obj, msg });
    }
    error(obj, msg) {
        this.entries.push({ level: 'error', obj, msg });
    }
    errorEntries() {
        return this.entries.filter((e) => e.level === 'error');
    }
}
export function makeCaptureError() {
    const calls = [];
    const fn = (err, context) => {
        calls.push({ err, context });
    };
    return { fn, calls };
}
export function fakeBackupDeps(overrides = {}) {
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
//# sourceMappingURL=test-helpers.js.map