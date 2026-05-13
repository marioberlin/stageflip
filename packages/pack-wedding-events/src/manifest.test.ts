// packages/pack-wedding-events/src/manifest.test.ts
// T-530 — Verifies `MANIFEST_SKELETON` is a structurally valid
// `PackManifest` under `parsePackManifest` (once a real integrity hash
// is supplied), the license claim is the expected commercial tier,
// the ten preset contributions are present (three substantive theme
// variants from T-527 — rustic / modern / classic — plus two
// substantive composition templates from T-528 —
// wedding-ceremony-template + wedding-reception-template — plus four
// substantive transition / bumper presets from T-529 —
// petal-cross-fade-transition + lace-wipe-transition +
// wedding-bumper-card + wedding-final-card — plus the T-530
// pre-licensed audio bed library (`audio-bed-library`)), keywords are
// lowercase, the assets array reserves five pre-licensed audio bed
// track references, and version is 0.2.0 (T-530 closes the pack at
// v0.2.0 GA — additive: new assets contribution + final placeholder
// slot filled).

import { parsePackManifest } from '@stageflip/pack-format';
import { describe, expect, it } from 'vitest';

import { MANIFEST_SKELETON, PLACEHOLDER_INTEGRITY_HASH, withIntegrityHash } from './manifest.js';

const VALID_HASH = 'a'.repeat(64);

const EXPECTED_ASSETS = [
  { path: 'audio/processional-strings-instrumental.mp3', mimeType: 'audio/mpeg' },
  { path: 'audio/recessional-uptempo-instrumental.mp3', mimeType: 'audio/mpeg' },
  { path: 'audio/reception-jazz-ambient.mp3', mimeType: 'audio/mpeg' },
  { path: 'audio/first-dance-acoustic-instrumental.mp3', mimeType: 'audio/mpeg' },
  { path: 'audio/closing-piano-instrumental.mp3', mimeType: 'audio/mpeg' },
];

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

  it('contributes exactly ten cluster-wedding-events preset entries — three substantive theme variants from T-527 (rustic / modern / classic) + two substantive composition templates from T-528 (wedding-ceremony-template + wedding-reception-template) + four substantive transition / bumper presets from T-529 (petal-cross-fade-transition + lace-wipe-transition + wedding-bumper-card + wedding-final-card) + the T-530 audio-bed-library — all substantive', () => {
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
      'audio-bed-library',
    ]);
    for (const p of presets) {
      expect(p.cluster).toBe('cluster-wedding-events');
    }
  });

  it('contributes exactly five asset entries — the T-530 pre-licensed audio bed library tracks (processional / recessional / reception / first-dance / closing), all audio/mpeg', () => {
    const assets = MANIFEST_SKELETON.contributes.assets ?? [];
    expect(assets).toHaveLength(5);
    expect(assets).toEqual(EXPECTED_ASSETS);
    for (const a of assets) {
      expect(a.mimeType).toBe('audio/mpeg');
      expect(a.path.startsWith('audio/')).toBe(true);
      expect(a.path.endsWith('.mp3')).toBe(true);
    }
  });

  it('the assets contribution survives the withIntegrityHash clone (deep-clone discipline)', () => {
    const out = withIntegrityHash(VALID_HASH);
    expect(out.contributes.assets).toEqual(EXPECTED_ASSETS);
    // Mutating the clone does not affect the skeleton.
    out.contributes.assets?.push({ path: 'audio/mutated.mp3', mimeType: 'audio/mpeg' });
    expect(MANIFEST_SKELETON.contributes.assets).toEqual(EXPECTED_ASSETS);
  });

  it('keywords are all lowercase', () => {
    const keywords = MANIFEST_SKELETON.keywords ?? [];
    expect(keywords.length).toBeGreaterThan(0);
    for (const k of keywords) {
      expect(k).toBe(k.toLowerCase());
    }
  });

  it('keywords include the wedding-events-vertical-cluster discriminant + the stageflip-first-party tag + the audio / audio-bed markers (T-530)', () => {
    const keywords = MANIFEST_SKELETON.keywords ?? [];
    expect(keywords).toContain('cluster-wedding-events');
    expect(keywords).toContain('stageflip-first-party');
    expect(keywords).toContain('wedding');
    expect(keywords).toContain('events');
    expect(keywords).toContain('lifecycle');
    expect(keywords).toContain('audio');
    expect(keywords).toContain('audio-bed');
  });

  it('publisher is the first-party StageFlip identity', () => {
    expect(MANIFEST_SKELETON.publisher).toEqual({
      id: 'stageflip',
      displayName: 'StageFlip',
    });
  });

  it('id is lowercase kebab-case + version is 0.2.0 (T-530 bumps from 0.1.0 — additive: new assets contribution + final placeholder slot filled; closes the Wedding & Events launch pack at v0.2.0 GA)', () => {
    expect(MANIFEST_SKELETON.id).toBe('wedding-events');
    expect(MANIFEST_SKELETON.version).toBe('0.2.0');
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
