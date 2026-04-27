// firebase/functions/src/backup/backup-firestore.test.ts
// T-272 AC #1, #3, #4 — backupFirestore exports BOTH `(default)` and `eu-west`
// databases per T-271, writes under gs://<backupsBucket>/firestore/<region>/<date>,
// logs success/failure, surfaces failures via captureError.

import { describe, expect, it } from 'vitest';
import { backupFirestoreHandler } from './backup-firestore.js';
import {
  MemoryFirestoreExporter,
  RecordingLogger,
  fakeBackupDeps,
  makeCaptureError,
} from './test-helpers.js';

describe('backupFirestore (T-272 AC #1, #3, #4)', () => {
  it('exports both (default) and eu-west databases per T-271', async () => {
    const exporter = new MemoryFirestoreExporter();
    // Tue Apr 28 2026 00:00:00 UTC
    const fixed = Date.UTC(2026, 3, 28, 2, 0, 0);
    const deps = fakeBackupDeps({ firestoreExporter: exporter, clock: () => fixed });

    const result = await backupFirestoreHandler(deps);

    expect(exporter.exports).toHaveLength(2);
    expect(exporter.exports[0]?.databaseId).toBe('(default)');
    expect(exporter.exports[0]?.outputUriPrefix).toBe(
      'gs://stageflip-backups/firestore/us/2026-04-28',
    );
    expect(exporter.exports[1]?.databaseId).toBe('eu-west');
    expect(exporter.exports[1]?.outputUriPrefix).toBe(
      'gs://stageflip-backups/firestore/eu/2026-04-28',
    );
    expect(result.success).toBe(true);
    expect(result.exports).toHaveLength(2);
  });

  it('emits an info log with isoDate + database for each successful export', async () => {
    const logger = new RecordingLogger();
    const deps = fakeBackupDeps({ logger, clock: () => Date.UTC(2026, 0, 1) });
    await backupFirestoreHandler(deps);
    const infos = logger.entries.filter((e) => e.level === 'info');
    expect(infos.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(infos)).toContain('2026-01-01');
    expect(JSON.stringify(infos)).toContain('(default)');
    expect(JSON.stringify(infos)).toContain('eu-west');
  });

  it('forwards exporter errors to captureError + logger.error and continues to next target', async () => {
    const exporter = new MemoryFirestoreExporter();
    exporter.failNextWith = new Error('export quota exceeded');
    const logger = new RecordingLogger();
    const cap = makeCaptureError();
    const deps = fakeBackupDeps({
      firestoreExporter: exporter,
      logger,
      captureError: cap.fn,
      clock: () => Date.UTC(2026, 3, 28),
    });

    const result = await backupFirestoreHandler(deps);

    // First target failed; second target succeeded.
    expect(result.success).toBe(false);
    expect(result.exports).toHaveLength(1);
    expect(result.exports[0]?.databaseId).toBe('eu-west');
    expect(cap.calls).toHaveLength(1);
    expect((cap.calls[0]?.err as Error).message).toBe('export quota exceeded');
    expect(cap.calls[0]?.context).toMatchObject({
      databaseId: '(default)',
      operation: 'backupFirestore',
    });
    expect(logger.errorEntries().length).toBeGreaterThanOrEqual(1);
  });

  it('honours custom firestoreTargets list (test injection)', async () => {
    const exporter = new MemoryFirestoreExporter();
    const deps = fakeBackupDeps({
      firestoreExporter: exporter,
      firestoreTargets: [{ databaseId: 'eu-west', regionTag: 'eu' }],
      clock: () => Date.UTC(2026, 3, 28),
    });
    await backupFirestoreHandler(deps);
    expect(exporter.exports).toHaveLength(1);
    expect(exporter.exports[0]?.databaseId).toBe('eu-west');
  });

  it('uses the configured backupsBucket', async () => {
    const exporter = new MemoryFirestoreExporter();
    const deps = fakeBackupDeps({
      firestoreExporter: exporter,
      backupsBucket: 'custom-bucket',
      clock: () => Date.UTC(2026, 3, 28),
    });
    await backupFirestoreHandler(deps);
    expect(exporter.exports[0]?.outputUriPrefix.startsWith('gs://custom-bucket/')).toBe(true);
  });
});
