// packages/pack-frontier-fx/src/manifest.test.ts
// T-531 / T-532 / T-533 — Verifies `MANIFEST_SKELETON` is a structurally
// valid `PackManifest` under `parsePackManifest` (once a real integrity
// hash is supplied), the license claim is the expected commercial tier,
// the eight preset contributions are present (five substantive shaders
// from T-532 + the substantive 3D asset library from T-533 + two
// remaining placeholders for T-534 ReactionStream physics + T-535
// premium TitleSequence templates), the assets array reserves eight
// pre-licensed 3D asset references (T-533), and keywords are lowercase.
// Version remains 0.1.0 (T-535 carries the GA bump that closes the
// pack at v0.2.0).

import { parsePackManifest } from '@stageflip/pack-format';
import { describe, expect, it } from 'vitest';

import { MANIFEST_SKELETON, PLACEHOLDER_INTEGRITY_HASH, withIntegrityHash } from './manifest.js';

const VALID_HASH = 'a'.repeat(64);

const EXPECTED_ASSETS = [
  { path: '3d/podium-classic.glb', mimeType: 'model/gltf-binary' },
  { path: '3d/stage-spotlight-set.glb', mimeType: 'model/gltf-binary' },
  { path: '3d/data-cube-rotating.glb', mimeType: 'model/gltf-binary' },
  { path: '3d/sphere-particles.glb', mimeType: 'model/gltf-binary' },
  { path: '3d/celebration-confetti-burst.glb', mimeType: 'model/gltf-binary' },
  { path: '3d/handshake-icon-3d.glb', mimeType: 'model/gltf-binary' },
  { path: '3d/award-trophy.glb', mimeType: 'model/gltf-binary' },
  { path: '3d/ribbon-cut-scissors.glb', mimeType: 'model/gltf-binary' },
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

  it('declares the paid-per-tenant commercial license tier with the frontier-fx-1y SKU', () => {
    expect(MANIFEST_SKELETON.license).toEqual({
      kind: 'paid-per-tenant',
      sku: 'frontier-fx-1y',
      entitlementType: 'subscription',
    });
  });

  it('contributes 8 cluster-i preset entries — 5 substantive shaders (T-532) + substantive 3D asset library (T-533) + 2 remaining placeholders (T-534/T-535)', () => {
    const presets = MANIFEST_SKELETON.contributes.presets ?? [];
    expect(presets).toHaveLength(8);
    expect(presets.map((p) => p.id)).toEqual([
      'shader-aurora-borealis',
      'shader-cosmic-nebula',
      'shader-liquid-metal',
      'shader-fire-portal',
      'shader-data-stream',
      '3d-asset-library',
      'reactionstream-physics-placeholder',
      'titlesequence-premium-placeholder',
    ]);
    for (const p of presets) {
      expect(p.cluster).toBe('cluster-i');
    }
  });

  it('contributes exactly eight asset entries — the T-533 pre-licensed commercial-OK 3D asset library (podium / spotlight rig / data cube / sphere particles / confetti burst / handshake icon / trophy / ribbon-cut scissors), all model/gltf-binary under 3d/', () => {
    const assets = MANIFEST_SKELETON.contributes.assets ?? [];
    expect(assets).toHaveLength(8);
    expect(assets).toEqual(EXPECTED_ASSETS);
    for (const a of assets) {
      expect(a.mimeType).toBe('model/gltf-binary');
      expect(a.path.startsWith('3d/')).toBe(true);
      expect(a.path.endsWith('.glb')).toBe(true);
    }
  });

  it('the assets contribution survives the withIntegrityHash clone (deep-clone discipline)', () => {
    const out = withIntegrityHash(VALID_HASH);
    expect(out.contributes.assets).toEqual(EXPECTED_ASSETS);
    // Mutating the clone does not affect the skeleton.
    out.contributes.assets?.push({ path: '3d/mutated.glb', mimeType: 'model/gltf-binary' });
    expect(MANIFEST_SKELETON.contributes.assets).toEqual(EXPECTED_ASSETS);
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

  it('id is lowercase kebab-case + version remains 0.1.0 (T-533 — T-535 carries the GA bump that closes the pack at v0.2.0)', () => {
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
