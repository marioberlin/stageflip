// packages/pack-sports-networks/src/manifest.test.ts
// T-511 — Verifies `MANIFEST_SKELETON` is a structurally valid
// `PackManifest` under `parsePackManifest` (once a real integrity hash
// is supplied), the license claim is the expected commercial tier, the
// four preset contributions are present (T-512 + T-513 + T-514 fill
// NBA Pro + NFL Pro + MLB slots substantively; T-515 F1 Pro still
// placeholder awaiting its fill), and keywords are lowercase. Version
// stays 0.1.0 until T-515 closes the pack at v0.2.0.

import { parsePackManifest } from '@stageflip/pack-format';
import { describe, expect, it } from 'vitest';

import { MANIFEST_SKELETON, PLACEHOLDER_INTEGRITY_HASH, withIntegrityHash } from './manifest.js';

const VALID_HASH = 'a'.repeat(64);

describe('MANIFEST_SKELETON', () => {
  it('parses under parsePackManifest when integrity.hash is a valid 64-char lowercase hex', () => {
    const manifest = withIntegrityHash(VALID_HASH);
    expect(() => parsePackManifest(manifest)).not.toThrow();
  });

  it('the placeholder hash matches the regex shape so parsePackManifest accepts the unpatched skeleton; the build script replaces it with the real digest', () => {
    expect(PLACEHOLDER_INTEGRITY_HASH).toMatch(/^[0-9a-f]{64}$/);
    expect(() => parsePackManifest(MANIFEST_SKELETON)).not.toThrow();
  });

  it('declares the paid-per-tenant commercial license tier with the sports-networks-1y SKU', () => {
    expect(MANIFEST_SKELETON.license).toEqual({
      kind: 'paid-per-tenant',
      sku: 'sports-networks-1y',
      entitlementType: 'subscription',
    });
  });

  it('contributes exactly four cluster-b preset entries — NBA Pro + NFL Pro + MLB filled in T-512 + T-513 + T-514; F1 Pro still placeholder for T-515', () => {
    const presets = MANIFEST_SKELETON.contributes.presets ?? [];
    expect(presets).toHaveLength(4);
    expect(presets.map((p) => p.id)).toEqual([
      'nba-pro-register',
      'nfl-pro-register',
      'mlb-register',
      'f1-pro-register-placeholder',
    ]);
    for (const p of presets) {
      expect(p.cluster).toBe('cluster-b');
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

  it('id is lowercase kebab-case + version is 0.1.0 (skeleton release; T-515 bumps to v0.2.0 GA on F1 Pro fill)', () => {
    expect(MANIFEST_SKELETON.id).toBe('sports-networks');
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
    expect(parsed.id).toBe('sports-networks');
    expect(parsed.integrity.hash).toBe(VALID_HASH);
  });
});
