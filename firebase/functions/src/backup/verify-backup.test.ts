// firebase/functions/src/backup/verify-backup.test.ts
// T-272 AC #5, #6, #7 — verifyBackup asserts existence + size>0 + JSON
// metadata parse for each expected backup; failures emit Sentry alerts.

import { describe, expect, it } from 'vitest';
import {
  MemoryStorageCopier,
  RecordingLogger,
  fakeBackupDeps,
  makeCaptureError,
} from './test-helpers.js';
import { verifyBackupHandler } from './verify-backup.js';

const DATE = Date.UTC(2026, 3, 28);
const ISO = '2026-04-28';

function seedHappyPath(copier: MemoryStorageCopier): void {
  // Firestore exports — metadata file with valid JSON.
  copier.seed({
    bucket: 'stageflip-backups',
    object: `firestore/us/${ISO}/${ISO}.overall_export_metadata`,
    size: 256,
    text: JSON.stringify({ outputUriPrefix: `gs://stageflip-backups/firestore/us/${ISO}` }),
  });
  copier.seed({
    bucket: 'stageflip-backups',
    object: `firestore/eu/${ISO}/${ISO}.overall_export_metadata`,
    size: 256,
    text: JSON.stringify({ outputUriPrefix: `gs://stageflip-backups/firestore/eu/${ISO}` }),
  });
  // Storage manifests.
  copier.seed({
    bucket: 'stageflip-backups',
    object: `storage/stageflip-assets/${ISO}/_manifest.json`,
    size: 64,
    text: JSON.stringify({ count: 1, isoDate: ISO }),
  });
  copier.seed({
    bucket: 'stageflip-backups',
    object: `storage/stageflip-eu-assets/${ISO}/_manifest.json`,
    size: 64,
    text: JSON.stringify({ count: 1, isoDate: ISO }),
  });
}

describe('verifyBackup (T-272 AC #5, #6, #7)', () => {
  it('passes when every expected backup file exists, has size>0, and metadata is parseable JSON', async () => {
    const copier = new MemoryStorageCopier();
    seedHappyPath(copier);
    const cap = makeCaptureError();
    const deps = fakeBackupDeps({
      storageCopier: copier,
      captureError: cap.fn,
      clock: () => DATE,
    });

    const result = await verifyBackupHandler(deps);

    expect(result.ok).toBe(true);
    expect(result.failures).toHaveLength(0);
    expect(cap.calls).toHaveLength(0);
  });

  it('fails when an expected Firestore export file is MISSING', async () => {
    const copier = new MemoryStorageCopier();
    seedHappyPath(copier);
    // Drop the EU export metadata.
    copier.objects.delete(
      MemoryStorageCopier.keyOf(
        'stageflip-backups',
        `firestore/eu/${ISO}/${ISO}.overall_export_metadata`,
      ),
    );
    const cap = makeCaptureError();
    const logger = new RecordingLogger();
    const deps = fakeBackupDeps({
      storageCopier: copier,
      captureError: cap.fn,
      logger,
      clock: () => DATE,
    });

    const result = await verifyBackupHandler(deps);

    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.reason === 'missing')).toBe(true);
    expect(result.failures.some((f) => f.target.includes('eu'))).toBe(true);
    expect(cap.calls.length).toBeGreaterThanOrEqual(1);
    // Logged at error level too (T-264 logger semantics auto-promote, but we
    // call captureError explicitly and also log).
    expect(logger.errorEntries().length).toBeGreaterThanOrEqual(1);
  });

  it('fails when an expected backup file is EMPTY (size === 0)', async () => {
    const copier = new MemoryStorageCopier();
    seedHappyPath(copier);
    // Replace the US export metadata with a size-0 file.
    copier.seed({
      bucket: 'stageflip-backups',
      object: `firestore/us/${ISO}/${ISO}.overall_export_metadata`,
      size: 0,
      text: '',
    });
    const cap = makeCaptureError();
    const deps = fakeBackupDeps({
      storageCopier: copier,
      captureError: cap.fn,
      clock: () => DATE,
    });

    const result = await verifyBackupHandler(deps);

    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.reason === 'empty')).toBe(true);
    expect(cap.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('fails when the metadata JSON is malformed (best-effort parse)', async () => {
    const copier = new MemoryStorageCopier();
    seedHappyPath(copier);
    copier.seed({
      bucket: 'stageflip-backups',
      object: `firestore/us/${ISO}/${ISO}.overall_export_metadata`,
      size: 32,
      text: '{ not json',
    });
    const cap = makeCaptureError();
    const deps = fakeBackupDeps({
      storageCopier: copier,
      captureError: cap.fn,
      clock: () => DATE,
    });

    const result = await verifyBackupHandler(deps);

    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.reason === 'malformed')).toBe(true);
    expect(cap.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('verifies "yesterday" — uses (clock - retentionFloor) for the expected date', async () => {
    // Verifier runs at 03:00 UTC on day N+1 looking for the day-N backup.
    // We model that by accepting an explicit `dateOverride` (D-T272-3 detail);
    // when not given, defaults to the current UTC day. This test pins explicit override.
    const copier = new MemoryStorageCopier();
    // Seed for an "older" day.
    const olderIso = '2026-04-27';
    copier.seed({
      bucket: 'stageflip-backups',
      object: `firestore/us/${olderIso}/${olderIso}.overall_export_metadata`,
      size: 1,
      text: '{}',
    });
    copier.seed({
      bucket: 'stageflip-backups',
      object: `firestore/eu/${olderIso}/${olderIso}.overall_export_metadata`,
      size: 1,
      text: '{}',
    });
    copier.seed({
      bucket: 'stageflip-backups',
      object: `storage/stageflip-assets/${olderIso}/_manifest.json`,
      size: 1,
      text: '{}',
    });
    copier.seed({
      bucket: 'stageflip-backups',
      object: `storage/stageflip-eu-assets/${olderIso}/_manifest.json`,
      size: 1,
      text: '{}',
    });
    const deps = fakeBackupDeps({ storageCopier: copier, clock: () => DATE });
    const result = await verifyBackupHandler(deps, { isoDate: olderIso });
    expect(result.ok).toBe(true);
  });
});
