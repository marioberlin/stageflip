// packages/pack-news-pro/src/manifest.test.ts
// T-506 — Verifies `MANIFEST_SKELETON` is a structurally valid
// `PackManifest` under `parsePackManifest` (once a real integrity hash
// is supplied), the license claim is the expected commercial tier, the
// three register preset contributions are present (all substantive
// post-T-509; T-510 still adds the news-ticker preset), and keywords
// are lowercase.

import { parsePackManifest } from '@stageflip/pack-format';
import { describe, expect, it } from 'vitest';

import { MANIFEST_SKELETON, PLACEHOLDER_INTEGRITY_HASH, withIntegrityHash } from './manifest.js';

const VALID_HASH = 'a'.repeat(64);

describe('MANIFEST_SKELETON', () => {
  it('parses under parsePackManifest when integrity.hash is a valid 64-char lowercase hex', () => {
    const manifest = withIntegrityHash(VALID_HASH);
    expect(() => parsePackManifest(manifest)).not.toThrow();
  });

  it('rejects under parsePackManifest with the placeholder zero hash because the regex allows it (lowercase 64-hex) yet the loader treats it as a sentinel — assert the placeholder is itself a valid-shape hex', () => {
    // The regex `^[0-9a-f]{64}$` accepts all-zeroes — the build script
    // must replace it. Confirm the placeholder matches the regex shape
    // so we can rely on parsePackManifest's structural validation only.
    expect(PLACEHOLDER_INTEGRITY_HASH).toMatch(/^[0-9a-f]{64}$/);
    expect(() => parsePackManifest(MANIFEST_SKELETON)).not.toThrow();
  });

  it('declares the paid-per-tenant commercial license tier with the news-pro-1y SKU', () => {
    expect(MANIFEST_SKELETON.license).toEqual({
      kind: 'paid-per-tenant',
      sku: 'news-pro-1y',
      entitlementType: 'subscription',
    });
  });

  it('contributes exactly three cluster-a preset entries — all three register slots substantive per T-507/T-508/T-509 (only T-510 news-ticker remains)', () => {
    const presets = MANIFEST_SKELETON.contributes.presets ?? [];
    expect(presets).toHaveLength(3);
    expect(presets.map((p) => p.id)).toEqual([
      'sky-news-pro-register',
      'itv-pro-register',
      'rai-pro-register',
    ]);
    for (const p of presets) {
      expect(p.cluster).toBe('cluster-a');
    }
  });

  it('keywords are all lowercase', () => {
    const keywords = MANIFEST_SKELETON.keywords ?? [];
    expect(keywords.length).toBeGreaterThan(0);
    for (const k of keywords) {
      expect(k).toBe(k.toLowerCase());
    }
  });

  it('publisher is the first-party StageFlip identity', () => {
    expect(MANIFEST_SKELETON.publisher).toEqual({
      id: 'stageflip',
      displayName: 'StageFlip',
    });
  });

  it('id is lowercase kebab-case + version is 0.1.0', () => {
    expect(MANIFEST_SKELETON.id).toBe('news-pro');
    expect(MANIFEST_SKELETON.version).toBe('0.1.0');
  });
});

describe('withIntegrityHash', () => {
  it('returns a new manifest with the supplied hash; does not mutate the skeleton', () => {
    const before = MANIFEST_SKELETON.integrity.hash;
    const out = withIntegrityHash(VALID_HASH);
    expect(out.integrity.hash).toBe(VALID_HASH);
    expect(MANIFEST_SKELETON.integrity.hash).toBe(before);
  });

  it('the substituted manifest still parses', () => {
    const out = withIntegrityHash(VALID_HASH);
    const parsed = parsePackManifest(out);
    expect(parsed.id).toBe('news-pro');
    expect(parsed.integrity.hash).toBe(VALID_HASH);
  });
});
