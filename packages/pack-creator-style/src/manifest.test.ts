// packages/pack-creator-style/src/manifest.test.ts
// T-516 / T-517 — Verifies `MANIFEST_SKELETON` is a structurally valid
// `PackManifest` under `parsePackManifest` (once a real integrity hash
// is supplied), the license claim is the expected commercial tier, the
// four cluster-F preset contributions are present (T-517 MKBHD-pro
// substantive + T-518 Vox-deluxe / T-519 Linus-Tech-Tips-pro placeholder
// register fills + T-520 prestige-creator placeholder composition
// preset), and keywords are lowercase. Version is 0.1.0 (skeleton
// release; T-520 closes the pack to GA).

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

  it('declares the paid-per-tenant commercial license tier with the creator-style-1y SKU', () => {
    expect(MANIFEST_SKELETON.license).toEqual({
      kind: 'paid-per-tenant',
      sku: 'creator-style-1y',
      entitlementType: 'subscription',
    });
  });

  it('contributes exactly four cluster-f preset entries — T-517 MKBHD-pro substantive register + three placeholders (T-518 Vox-deluxe / T-519 Linus-Tech-Tips-pro register fills + T-520 prestige-creator composition preset)', () => {
    const presets = MANIFEST_SKELETON.contributes.presets ?? [];
    expect(presets).toHaveLength(4);
    expect(presets.map((p) => p.id)).toEqual([
      'mkbhd-pro-register',
      'vox-deluxe-register-placeholder',
      'linus-tech-tips-pro-register-placeholder',
      'prestige-creator-placeholder',
    ]);
    for (const p of presets) {
      expect(p.cluster).toBe('cluster-f');
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

  it('id is lowercase kebab-case + version is 0.1.0 (skeleton release; T-517..T-520 bump on preset fills)', () => {
    expect(MANIFEST_SKELETON.id).toBe('creator-style');
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
    expect(parsed.id).toBe('creator-style');
    expect(parsed.integrity.hash).toBe(VALID_HASH);
  });
});
