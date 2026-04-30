// firebase/functions/src/backup/index.ts
// Backup handler barrel. Wired into the top-level Cloud Functions
// `index.ts` via Cloud Scheduler `onSchedule` adapters.
// T-272.
export { backupFirestoreHandler } from './backup-firestore.js';
export { backupStorageHandler } from './backup-storage.js';
export { firestoreBackupPrefix, isoDate, storageBackupObject } from './types.js';
export { verifyBackupHandler } from './verify-backup.js';
//# sourceMappingURL=index.js.map