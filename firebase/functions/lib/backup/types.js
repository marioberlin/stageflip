// firebase/functions/src/backup/types.ts
// Shared types + DI shapes for the backup callables (T-272).
//
// Each backup/verify handler is a pure-async function over an injected
// `BackupDeps` bundle. The Firebase wrappers in `../index.ts` adapt these
// handlers to scheduled `onSchedule` callables; the handlers themselves are
// unit-testable without `firebase-functions-test`.
/** YYYY-MM-DD utility — UTC, deterministic given a clock. */
export function isoDate(epochMs) {
    const d = new Date(epochMs);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
/** Build the canonical backup path prefix for a Firestore export on a given date. */
export function firestoreBackupPrefix(args) {
    return `gs://${args.bucket}/firestore/${args.regionTag}/${args.isoDate}`;
}
/** Build the canonical backup path for a Storage object on a given date. */
export function storageBackupObject(args) {
    return `storage/${args.srcBucket}/${args.isoDate}/${args.srcObject}`;
}
//# sourceMappingURL=types.js.map