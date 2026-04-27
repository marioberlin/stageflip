// firebase/functions/src/backup/backup-storage.test.ts
// T-272 AC #2, #3, #4 — backupStorage lists each production assets bucket and
// copies every object to gs://<backupsBucket>/storage/<bucket>/<date>/<obj>.

import { describe, expect, it } from 'vitest';
import { backupStorageHandler } from './backup-storage.js';
import {
  MemoryStorageCopier,
  RecordingLogger,
  fakeBackupDeps,
  makeCaptureError,
} from './test-helpers.js';

describe('backupStorage (T-272 AC #2, #3, #4)', () => {
  it('copies every object from each assets bucket into the backups bucket under <bucket>/<date>/', async () => {
    const copier = new MemoryStorageCopier();
    copier.seed({ bucket: 'stageflip-assets', object: 'logos/a.png', size: 100 });
    copier.seed({ bucket: 'stageflip-assets', object: 'logos/b.png', size: 200 });
    copier.seed({ bucket: 'stageflip-eu-assets', object: 'fonts/x.woff2', size: 50 });

    const deps = fakeBackupDeps({
      storageCopier: copier,
      clock: () => Date.UTC(2026, 3, 28),
    });

    const result = await backupStorageHandler(deps);

    expect(result.success).toBe(true);
    expect(result.objectsCopied).toBe(3);
    // All three copies landed under storage/<srcBucket>/2026-04-28/<obj>
    const dstObjects = copier.copies.map((c) => c.dst).sort();
    expect(dstObjects).toEqual([
      'gs://stageflip-backups/storage/stageflip-assets/2026-04-28/logos/a.png',
      'gs://stageflip-backups/storage/stageflip-assets/2026-04-28/logos/b.png',
      'gs://stageflip-backups/storage/stageflip-eu-assets/2026-04-28/fonts/x.woff2',
    ]);
  });

  it('skips empty buckets without error', async () => {
    const copier = new MemoryStorageCopier();
    const deps = fakeBackupDeps({ storageCopier: copier });
    const result = await backupStorageHandler(deps);
    expect(result.success).toBe(true);
    expect(result.objectsCopied).toBe(0);
  });

  it('writes a manifest.json next to each per-bucket date prefix', async () => {
    const copier = new MemoryStorageCopier();
    copier.seed({ bucket: 'stageflip-assets', object: 'a', size: 10 });
    const deps = fakeBackupDeps({
      storageCopier: copier,
      clock: () => Date.UTC(2026, 3, 28),
    });
    await backupStorageHandler(deps);
    // Manifest is the size>0 sentinel the verifier looks for.
    const manifest = await copier.statObject({
      bucket: 'stageflip-backups',
      object: 'storage/stageflip-assets/2026-04-28/_manifest.json',
    });
    expect(manifest).not.toBeNull();
    expect(manifest?.size ?? 0).toBeGreaterThan(0);
    const text = await copier.readObjectText({
      bucket: 'stageflip-backups',
      object: 'storage/stageflip-assets/2026-04-28/_manifest.json',
    });
    expect(text).not.toBeNull();
    expect(() => JSON.parse(text ?? '')).not.toThrow();
  });

  it('reports listObjects failure via captureError + continues to next bucket', async () => {
    const sabotaged = new (class extends MemoryStorageCopier {
      override async listObjects(args: { bucket: string; prefix?: string }) {
        if (args.bucket === 'stageflip-assets') throw new Error('list 503');
        return super.listObjects(args);
      }
    })();
    sabotaged.seed({ bucket: 'stageflip-eu-assets', object: 'b', size: 5 });
    const cap = makeCaptureError();
    const deps = fakeBackupDeps({
      storageCopier: sabotaged,
      captureError: cap.fn,
      clock: () => Date.UTC(2026, 3, 28),
    });
    const result = await backupStorageHandler(deps);
    expect(result.success).toBe(false);
    expect(
      cap.calls.some(
        (c) => (c.context as { operation: string }).operation === 'backupStorage.list',
      ),
    ).toBe(true);
    // EU bucket still got copied.
    expect(sabotaged.copies.length).toBe(1);
  });

  it('reports manifest write failures via captureError', async () => {
    const sabotaged = new (class extends MemoryStorageCopier {
      override async uploadText(): Promise<void> {
        throw new Error('upload denied');
      }
    })();
    sabotaged.seed({ bucket: 'stageflip-assets', object: 'a', size: 1 });
    const cap = makeCaptureError();
    const deps = fakeBackupDeps({
      storageCopier: sabotaged,
      captureError: cap.fn,
      clock: () => Date.UTC(2026, 3, 28),
    });
    const result = await backupStorageHandler(deps);
    expect(result.success).toBe(false);
    expect(
      cap.calls.some(
        (c) => (c.context as { operation: string }).operation === 'backupStorage.manifest',
      ),
    ).toBe(true);
  });

  it('forwards errors to captureError and continues to next bucket', async () => {
    const copier = new MemoryStorageCopier();
    copier.seed({ bucket: 'stageflip-assets', object: 'a', size: 10 });
    copier.seed({ bucket: 'stageflip-eu-assets', object: 'b', size: 20 });
    // Sabotage the first copy by removing the object between list + copy.
    const sabotaged = new (class extends MemoryStorageCopier {
      override async copyObject(args: {
        srcBucket: string;
        srcObject: string;
        dstBucket: string;
        dstObject: string;
      }): Promise<void> {
        if (args.srcBucket === 'stageflip-assets') {
          throw new Error('copy 500');
        }
        return super.copyObject(args);
      }
    })();
    sabotaged.seed({ bucket: 'stageflip-assets', object: 'a', size: 10 });
    sabotaged.seed({ bucket: 'stageflip-eu-assets', object: 'b', size: 20 });
    const cap = makeCaptureError();
    const logger = new RecordingLogger();
    const deps = fakeBackupDeps({
      storageCopier: sabotaged,
      captureError: cap.fn,
      logger,
      clock: () => Date.UTC(2026, 3, 28),
    });

    const result = await backupStorageHandler(deps);

    expect(result.success).toBe(false);
    // Failures captured, but the EU bucket still gets one copy.
    expect(cap.calls.length).toBeGreaterThanOrEqual(1);
    const dst = sabotaged.copies.map((c) => c.dst);
    expect(dst).toContain('gs://stageflip-backups/storage/stageflip-eu-assets/2026-04-28/b');
  });
});
