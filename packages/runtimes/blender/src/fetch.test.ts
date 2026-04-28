// packages/runtimes/blender/src/fetch.test.ts
// T-265 AC #14, #15, #16 — frame-fetch state machine.

import { describe, expect, it } from 'vitest';

import {
  type BakeBucketReader,
  bakeKeyPrefix,
  failureMarkerKey,
  frameKey,
  getBakedFrames,
  manifestKey,
} from './fetch.js';

const HASH = 'a'.repeat(64);

function reader(map: Record<string, string>, bucketName = 'stageflip-assets'): BakeBucketReader {
  return {
    bucketName,
    async getText(path) {
      const v = map[path];
      return v === undefined ? null : v;
    },
    publicUrl(path) {
      return `https://${bucketName}/${path}`;
    },
  };
}

describe('getBakedFrames (T-265 AC #14)', () => {
  it('returns "ready" + frame URLs when manifest exists', async () => {
    const manifest = {
      inputsHash: HASH,
      frameCount: 3,
      fps: 30,
      durationMs: 100,
      outputBucket: 'stageflip-assets',
      region: 'us',
      completedAt: '2026-04-27T00:00:00.000Z',
    };
    const r = reader({ [manifestKey(HASH)]: JSON.stringify(manifest) });
    const out = await getBakedFrames(HASH, { region: 'us', reader: r });
    expect(out.status).toBe('ready');
    if (out.status === 'ready') {
      expect(out.frames).toHaveLength(3);
      expect(out.frames[0]).toBe(`https://stageflip-assets/${frameKey(HASH, 0)}`);
      expect(out.manifestUrl).toBe(`https://stageflip-assets/${manifestKey(HASH)}`);
      expect(out.bakeId).toBe(HASH);
    }
  });
});

describe('getBakedFrames (T-265 AC #15)', () => {
  it('returns "pending" when neither manifest nor failure marker exists', async () => {
    const r = reader({});
    const out = await getBakedFrames(HASH, { region: 'us', reader: r });
    expect(out.status).toBe('pending');
  });
});

describe('getBakedFrames (T-265 AC #16)', () => {
  it('returns "failed" when bake_failed marker exists', async () => {
    const marker = {
      inputsHash: HASH,
      error: 'cycles cuda init failed',
      failedAt: '2026-04-27T00:00:00.000Z',
    };
    const r = reader({ [failureMarkerKey(HASH)]: JSON.stringify(marker) });
    const out = await getBakedFrames(HASH, { region: 'us', reader: r });
    expect(out.status).toBe('failed');
    if (out.status === 'failed') {
      expect(out.error).toContain('cuda');
    }
  });
  it('manifest takes precedence over failure marker', async () => {
    const r = reader({
      [manifestKey(HASH)]: JSON.stringify({
        inputsHash: HASH,
        frameCount: 1,
        fps: 30,
        durationMs: 33,
        outputBucket: 'stageflip-assets',
        region: 'us',
        completedAt: '2026-04-27T00:00:00.000Z',
      }),
      [failureMarkerKey(HASH)]: JSON.stringify({
        inputsHash: HASH,
        error: 'transient',
        failedAt: '2026-04-26T00:00:00.000Z',
      }),
    });
    const out = await getBakedFrames(HASH, { region: 'us', reader: r });
    expect(out.status).toBe('ready');
  });
});

describe('path helpers', () => {
  it('builds the architecture-locked path layout', () => {
    expect(bakeKeyPrefix(HASH)).toBe(`bakes/${HASH}`);
    expect(frameKey(HASH, 5)).toBe(`bakes/${HASH}/frame-5.png`);
    expect(manifestKey(HASH)).toBe(`bakes/${HASH}/manifest.json`);
    expect(failureMarkerKey(HASH)).toBe(`bakes/${HASH}/bake_failed.json`);
  });
});

describe('manifest validation', () => {
  it('rejects a corrupt manifest', async () => {
    const r = reader({ [manifestKey(HASH)]: 'not-json' });
    await expect(getBakedFrames(HASH, { region: 'us', reader: r })).rejects.toThrow(/corrupt/);
  });
  it('rejects a manifest with bad frameCount', async () => {
    const r = reader({
      [manifestKey(HASH)]: JSON.stringify({
        inputsHash: HASH,
        frameCount: -1,
        fps: 30,
        durationMs: 100,
        outputBucket: 'stageflip-assets',
        region: 'us',
        completedAt: '2026-04-27T00:00:00.000Z',
      }),
    });
    await expect(getBakedFrames(HASH, { region: 'us', reader: r })).rejects.toThrow(/frameCount/);
  });
  it('rejects a manifest with unknown region', async () => {
    const r = reader({
      [manifestKey(HASH)]: JSON.stringify({
        inputsHash: HASH,
        frameCount: 1,
        fps: 30,
        durationMs: 100,
        outputBucket: 'stageflip-assets',
        region: 'apac',
        completedAt: '2026-04-27T00:00:00.000Z',
      }),
    });
    await expect(getBakedFrames(HASH, { region: 'us', reader: r })).rejects.toThrow(/region/);
  });
});
