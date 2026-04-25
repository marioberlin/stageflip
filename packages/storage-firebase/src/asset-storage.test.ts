// packages/storage-firebase/src/asset-storage.test.ts
// Adapter unit tests against a recording mock bucket. No Firebase runtime
// involvement — the adapter speaks to the structural `BucketLike`/`FileLike`
// interfaces, so tests pass a tiny in-memory shim.

import { describe, expect, it } from 'vitest';
import type { BucketLike, FileLike } from './asset-storage.js';
import { createFirebaseAssetStorage } from './asset-storage.js';

interface SaveCall {
  path: string;
  data: Uint8Array;
  contentType: string | undefined;
  resumable: boolean | undefined;
  contentHash: string | undefined;
}

function recordingBucket(): { bucket: BucketLike; calls: SaveCall[] } {
  const calls: SaveCall[] = [];
  const bucket: BucketLike = {
    file(name) {
      const file: FileLike = {
        async save(data, options) {
          // Pull the contentHash out of the metadata.metadata bag.
          const meta = options?.metadata as { metadata?: { contentHash?: string } } | undefined;
          calls.push({
            path: name,
            data: data instanceof Uint8Array ? data : new Uint8Array(data),
            contentType: options?.contentType,
            resumable: options?.resumable,
            contentHash: meta?.metadata?.contentHash,
          });
        },
      };
      return file;
    },
  };
  return { bucket, calls };
}

const HASH = 'a'.repeat(64); // sha256-shaped fixture
const BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

describe('createFirebaseAssetStorage', () => {
  it('uploads to `pptx-imports/<id>` by default', async () => {
    const { bucket, calls } = recordingBucket();
    const storage = createFirebaseAssetStorage({ bucket });
    const result = await storage.put(BYTES, { contentType: 'image/png', contentHash: HASH });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.path).toBe(`pptx-imports/${HASH.slice(0, 21)}`);
    expect(result.id).toBe(HASH.slice(0, 21));
  });

  it('uploads the bytes verbatim with the given content type', async () => {
    const { bucket, calls } = recordingBucket();
    const storage = createFirebaseAssetStorage({ bucket });
    await storage.put(BYTES, { contentType: 'image/png', contentHash: HASH });

    expect(calls[0]?.data).toEqual(BYTES);
    expect(calls[0]?.contentType).toBe('image/png');
  });

  it('disables resumable uploads (asset bytes are small)', async () => {
    const { bucket, calls } = recordingBucket();
    const storage = createFirebaseAssetStorage({ bucket });
    await storage.put(BYTES, { contentType: 'image/png', contentHash: HASH });

    expect(calls[0]?.resumable).toBe(false);
  });

  it('preserves the full content hash in object metadata', async () => {
    const { bucket, calls } = recordingBucket();
    const storage = createFirebaseAssetStorage({ bucket });
    await storage.put(BYTES, { contentType: 'image/png', contentHash: HASH });

    expect(calls[0]?.contentHash).toBe(HASH);
  });

  it('honors a custom pathPrefix', async () => {
    const { bucket, calls } = recordingBucket();
    const storage = createFirebaseAssetStorage({ bucket, pathPrefix: 'imports/abc' });
    await storage.put(BYTES, { contentType: 'image/png', contentHash: HASH });

    expect(calls[0]?.path).toBe(`imports/abc/${HASH.slice(0, 21)}`);
  });

  it('honors a custom idLength', async () => {
    const { bucket, calls } = recordingBucket();
    const storage = createFirebaseAssetStorage({ bucket, idLength: 8 });
    const result = await storage.put(BYTES, { contentType: 'image/png', contentHash: HASH });

    expect(result.id).toBe(HASH.slice(0, 8));
    expect(calls[0]?.path).toBe(`pptx-imports/${HASH.slice(0, 8)}`);
  });

  it('content-addresses: identical hashes write to the same path', async () => {
    const { bucket, calls } = recordingBucket();
    const storage = createFirebaseAssetStorage({ bucket });
    const a = await storage.put(BYTES, { contentType: 'image/png', contentHash: HASH });
    const b = await storage.put(BYTES, { contentType: 'image/png', contentHash: HASH });

    expect(a.id).toBe(b.id);
    expect(calls[0]?.path).toBe(calls[1]?.path);
  });

  it('propagates underlying save() errors', async () => {
    const failingBucket: BucketLike = {
      file() {
        return {
          async save() {
            throw new Error('boom');
          },
        };
      },
    };
    const storage = createFirebaseAssetStorage({ bucket: failingBucket });
    await expect(
      storage.put(BYTES, { contentType: 'image/png', contentHash: HASH }),
    ).rejects.toThrow('boom');
  });
});
