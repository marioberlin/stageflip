// packages/pack-frontier-fx/src/manifest.test.ts
// T-531 — Verifies `MANIFEST_SKELETON` is a structurally valid
// `PackManifest` under `parsePackManifest` (once a real integrity hash
// is supplied), the license claim is the expected commercial tier,
// the four placeholder preset contributions are present (T-532 premium
// shaders + T-533 3D asset library + T-534 ReactionStream physics +
// T-535 premium TitleSequence templates), and keywords are lowercase.
// Version is 0.1.0 (skeleton release).

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

  it('declares the paid-per-tenant commercial license tier with the frontier-fx-1y SKU', () => {
    expect(MANIFEST_SKELETON.license).toEqual({
      kind: 'paid-per-tenant',
      sku: 'frontier-fx-1y',
      entitlementType: 'subscription',
    });
  });

  it('contributes exactly four cluster-i placeholder preset entries — premium shaders (T-532) + 3D asset library (T-533) + ReactionStream physics (T-534) + premium TitleSequence templates (T-535)', () => {
    const presets = MANIFEST_SKELETON.contributes.presets ?? [];
    expect(presets).toHaveLength(4);
    expect(presets.map((p) => p.id)).toEqual([
      'premium-shaders-placeholder',
      '3d-asset-library-placeholder',
      'reactionstream-physics-placeholder',
      'titlesequence-premium-placeholder',
    ]);
    for (const p of presets) {
      expect(p.cluster).toBe('cluster-i');
    }
  });

  it('keywords are all lowercase', () => {
    const keywords = MANIFEST_SKELETON.keywords ?? [];
    expect(keywords.length).toBeGreaterThan(0);
    for (const k of keywords) {
      expect(k).toBe(k.toLowerCase());
    }
  });

  it('keywords include the cluster-i discriminant + the stageflip-first-party tag', () => {
    const keywords = MANIFEST_SKELETON.keywords ?? [];
    expect(keywords).toContain('cluster-i');
    expect(keywords).toContain('stageflip-first-party');
    expect(keywords).toContain('frontier');
    expect(keywords).toContain('shaders');
    expect(keywords).toContain('3d');
    expect(keywords).toContain('particles');
    expect(keywords).toContain('effects');
  });

  it('publisher is the first-party StageFlip identity', () => {
    expect(MANIFEST_SKELETON.publisher).toEqual({
      id: 'stageflip',
      displayName: 'StageFlip',
    });
  });

  it('id is lowercase kebab-case + version is 0.1.0 (skeleton release; T-532..T-535 bump on substantive fills)', () => {
    expect(MANIFEST_SKELETON.id).toBe('frontier-fx');
    expect(MANIFEST_SKELETON.version).toBe('0.1.0');
  });

  it('name is the human-readable Frontier Effects label (NOT the kebab-case id)', () => {
    expect(MANIFEST_SKELETON.name).toBe('Frontier Effects');
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
    expect(parsed.id).toBe('frontier-fx');
    expect(parsed.integrity.hash).toBe(VALID_HASH);
  });
});
