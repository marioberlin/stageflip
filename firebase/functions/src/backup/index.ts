// firebase/functions/src/backup/index.ts
// Backup handler barrel. Wired into the top-level Cloud Functions
// `index.ts` via Cloud Scheduler `onSchedule` adapters.
// T-272.

export type { BackupFirestoreResult } from './backup-firestore.js';
export { backupFirestoreHandler } from './backup-firestore.js';
export type { BackupStorageResult } from './backup-storage.js';
export { backupStorageHandler } from './backup-storage.js';
export type {
  BackupDeps,
  BackupLoggerLike,
  BackupTarget,
  CaptureErrorLike,
  FirestoreDatabaseId,
  FirestoreExporterLike,
  FirestoreRegionTag,
  StorageCopierLike,
} from './types.js';
export { firestoreBackupPrefix, isoDate, storageBackupObject } from './types.js';
export type {
  VerifyBackupOptions,
  VerifyBackupResult,
  VerifyFailure,
  VerifyFailureReason,
} from './verify-backup.js';
export { verifyBackupHandler } from './verify-backup.js';
