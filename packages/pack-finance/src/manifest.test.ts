// packages/pack-finance/src/manifest.test.ts
// T-521 — Verifies `MANIFEST_SKELETON` is a structurally valid
// `PackManifest` under `parsePackManifest` (once a real integrity hash
// is supplied), the license claim is the expected commercial tier,
// the four placeholder preset contributions are present (T-522
// earnings-call template + T-523 investor-deck template + T-524
// Bloomberg-pro adapter + T-525 finance-domain semantic tools), and
// keywords are lowercase. Version is 0.1.0 (skeleton release).

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

  it('declares the paid-per-tenant commercial license tier with the finance-1y SKU', () => {
    expect(MANIFEST_SKELETON.license).toEqual({
      kind: 'paid-per-tenant',
      sku: 'finance-1y',
      entitlementType: 'subscription',
    });
  });

  it('contributes exactly four cluster-finance placeholder preset entries — earnings-call template (T-522) + investor-deck template (T-523) + Bloomberg-pro adapter (T-524) + finance-domain semantic tools (T-525)', () => {
    const presets = MANIFEST_SKELETON.contributes.presets ?? [];
    expect(presets).toHaveLength(4);
    expect(presets.map((p) => p.id)).toEqual([
      'earnings-call-template-placeholder',
      'investor-deck-template-placeholder',
      'bloomberg-pro-adapter-placeholder',
      'finance-semantic-tools-placeholder',
    ]);
    for (const p of presets) {
      expect(p.cluster).toBe('cluster-finance');
    }
  });

  it('keywords are all lowercase', () => {
    const keywords = MANIFEST_SKELETON.keywords ?? [];
    expect(keywords.length).toBeGreaterThan(0);
    for (const k of keywords) {
      expect(k).toBe(k.toLowerCase());
    }
  });

  it('keywords include the finance-vertical-cluster discriminant + the stageflip-first-party tag', () => {
    const keywords = MANIFEST_SKELETON.keywords ?? [];
    expect(keywords).toContain('cluster-finance');
    expect(keywords).toContain('stageflip-first-party');
    expect(keywords).toContain('finance');
  });

  it('publisher is the first-party StageFlip identity', () => {
    expect(MANIFEST_SKELETON.publisher).toEqual({
      id: 'stageflip',
      displayName: 'StageFlip',
    });
  });

  it('id is lowercase kebab-case + version is 0.1.0 (skeleton release; T-522..T-525 bump on substantive fills)', () => {
    expect(MANIFEST_SKELETON.id).toBe('finance');
    expect(MANIFEST_SKELETON.version).toBe('0.1.0');
  });

  it('name is the human-readable Earnings & Investor label (NOT the kebab-case id)', () => {
    expect(MANIFEST_SKELETON.name).toBe('Earnings & Investor');
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
    expect(parsed.id).toBe('finance');
    expect(parsed.integrity.hash).toBe(VALID_HASH);
  });
});
