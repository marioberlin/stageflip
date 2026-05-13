// packages/pack-wedding-events/src/manifest.test.ts
// T-529 — Verifies `MANIFEST_SKELETON` is a structurally valid
// `PackManifest` under `parsePackManifest` (once a real integrity hash
// is supplied), the license claim is the expected commercial tier,
// the ten preset contributions are present (three substantive theme
// variants from T-527 — rustic / modern / classic — plus two
// substantive composition templates from T-528 —
// wedding-ceremony-template + wedding-reception-template — plus four
// substantive transition / bumper presets from T-529 —
// petal-cross-fade-transition + lace-wipe-transition +
// wedding-bumper-card + wedding-final-card — plus one placeholder for
// T-530 audio bed library), and keywords are lowercase. Version is
// 0.1.0 (skeleton release; T-530 closes the pack at v0.2.0).

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

  it('declares the paid-per-tenant commercial license tier with the wedding-events-1y SKU', () => {
    expect(MANIFEST_SKELETON.license).toEqual({
      kind: 'paid-per-tenant',
      sku: 'wedding-events-1y',
      entitlementType: 'subscription',
    });
  });

  it('contributes exactly ten cluster-wedding-events preset entries — three substantive theme variants from T-527 (rustic / modern / classic) + two substantive composition templates from T-528 (wedding-ceremony-template + wedding-reception-template) + four substantive transition / bumper presets from T-529 (petal-cross-fade-transition + lace-wipe-transition + wedding-bumper-card + wedding-final-card) + one placeholder for T-530', () => {
    const presets = MANIFEST_SKELETON.contributes.presets ?? [];
    expect(presets).toHaveLength(10);
    expect(presets.map((p) => p.id)).toEqual([
      'rustic-theme',
      'modern-theme',
      'classic-theme',
      'wedding-ceremony-template',
      'wedding-reception-template',
      'petal-cross-fade-transition',
      'lace-wipe-transition',
      'wedding-bumper-card',
      'wedding-final-card',
      'audio-bed-library-placeholder',
    ]);
    for (const p of presets) {
      expect(p.cluster).toBe('cluster-wedding-events');
    }
  });

  it('keywords are all lowercase', () => {
    const keywords = MANIFEST_SKELETON.keywords ?? [];
    expect(keywords.length).toBeGreaterThan(0);
    for (const k of keywords) {
      expect(k).toBe(k.toLowerCase());
    }
  });

  it('keywords include the wedding-events-vertical-cluster discriminant + the stageflip-first-party tag', () => {
    const keywords = MANIFEST_SKELETON.keywords ?? [];
    expect(keywords).toContain('cluster-wedding-events');
    expect(keywords).toContain('stageflip-first-party');
    expect(keywords).toContain('wedding');
    expect(keywords).toContain('events');
    expect(keywords).toContain('lifecycle');
    expect(keywords).toContain('audio');
  });

  it('publisher is the first-party StageFlip identity', () => {
    expect(MANIFEST_SKELETON.publisher).toEqual({
      id: 'stageflip',
      displayName: 'StageFlip',
    });
  });

  it('id is lowercase kebab-case + version is 0.1.0 (T-529 lands transitions + bumpers without a version bump; T-530 closes the pack at v0.2.0)', () => {
    expect(MANIFEST_SKELETON.id).toBe('wedding-events');
    expect(MANIFEST_SKELETON.version).toBe('0.1.0');
  });

  it('name is the human-readable Wedding & Events label (NOT the kebab-case id)', () => {
    expect(MANIFEST_SKELETON.name).toBe('Wedding & Events');
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
    expect(parsed.id).toBe('wedding-events');
    expect(parsed.integrity.hash).toBe(VALID_HASH);
  });
});
