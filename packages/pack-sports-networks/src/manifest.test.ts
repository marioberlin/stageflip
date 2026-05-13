// packages/pack-sports-networks/src/manifest.test.ts
// T-511 — Verifies `MANIFEST_SKELETON` is a structurally valid
// `PackManifest` under `parsePackManifest` (once a real integrity hash
// is supplied), the license claim is the expected commercial tier, the
// five preset contributions are present (all substantive post-T-515:
// four register variants — NBA Pro T-512 / NFL Pro T-513 / MLB T-514 /
// F1 Pro T-515 — plus the closing F1 AR Grid Lineup arOverlay
// integration T-515), and keywords are lowercase. Version is bumped to
// 0.2.0 by T-515 (minor; additive feature — fills the F1 Pro register
// placeholder + adds the AR grid-lineup integration; closes the pack at
// GA).

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

  it('contributes exactly five cluster-b preset entries — four register variants (NBA Pro T-512 / NFL Pro T-513 / MLB T-514 / F1 Pro T-515) plus the closing F1 AR Grid Lineup arOverlay integration (T-515)', () => {
    const presets = MANIFEST_SKELETON.contributes.presets ?? [];
    expect(presets).toHaveLength(5);
    expect(presets.map((p) => p.id)).toEqual([
      'nba-pro-register',
      'nfl-pro-register',
      'mlb-register',
      'f1-pro-register',
      'f1-ar-grid-lineup',
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

  it('id is lowercase kebab-case + version is 0.2.0 (T-515 minor bump — fills the F1 Pro register placeholder + adds the AR grid-lineup integration; closes the pack at GA)', () => {
    expect(MANIFEST_SKELETON.id).toBe('sports-networks');
    expect(MANIFEST_SKELETON.version).toBe('0.2.0');
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
