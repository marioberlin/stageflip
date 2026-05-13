// packages/pack-finance/src/manifest.test.ts
// T-521 — Verifies `MANIFEST_SKELETON` is a structurally valid
// `PackManifest` under `parsePackManifest` (once a real integrity hash
// is supplied), the license claim is the expected commercial tier,
// the four preset contributions are present (T-522 earnings-call
// template + T-523 investor-deck template + T-524 Bloomberg-pro
// adapter + T-525 finance-domain semantic tools), and keywords are
// lowercase.
//
// T-524 — Flipped the third preset id from
// `bloomberg-pro-adapter-placeholder` to `bloomberg-pro-adapter`
// (substantive) AND seeded `contributes.adapters` with the reserved
// `{ id: 'bloomberg-pro', modality: 'data-source' }` entry per
// ADR-012 §D5.
//
// T-525 — Flipped the fourth preset id from
// `finance-semantic-tools-placeholder` to `finance-semantic-tools`
// (substantive) AND seeded `contributes.tools` with the reserved
// `finance-domain` semantic-tool bundle entry per ADR-012 §D5.
// Bumped version 0.1.0 → 0.2.0 (additive — new tools contribution +
// final placeholder slot filled). Closes the Earnings & Investor
// launch pack at v0.2.0 GA.

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

  it('contributes exactly four cluster-finance preset entries — earnings-call template (T-522) + investor-deck template (T-523) + Bloomberg-pro adapter (T-524) + finance-domain semantic tools (T-525), all substantive', () => {
    const presets = MANIFEST_SKELETON.contributes.presets ?? [];
    expect(presets).toHaveLength(4);
    expect(presets.map((p) => p.id)).toEqual([
      'earnings-call-template',
      'investor-deck-template',
      'bloomberg-pro-adapter',
      'finance-semantic-tools',
    ]);
    for (const p of presets) {
      expect(p.cluster).toBe('cluster-finance');
    }
  });

  it('contributes exactly one adapter entry — the reserved bloomberg-pro premium-tier data-source adapter (T-524)', () => {
    const adapters = MANIFEST_SKELETON.contributes.adapters ?? [];
    expect(adapters).toHaveLength(1);
    expect(adapters[0]).toEqual({ id: 'bloomberg-pro', modality: 'data-source' });
  });

  it('the adapter contribution survives the withIntegrityHash clone (deep-clone discipline)', () => {
    const out = withIntegrityHash(VALID_HASH);
    expect(out.contributes.adapters).toEqual([{ id: 'bloomberg-pro', modality: 'data-source' }]);
    // Mutating the clone does not affect the skeleton.
    out.contributes.adapters?.push({ id: 'mutated', modality: 'mutated' });
    expect(MANIFEST_SKELETON.contributes.adapters).toEqual([
      { id: 'bloomberg-pro', modality: 'data-source' },
    ]);
  });

  it('contributes exactly one tools entry — the reserved finance-domain semantic-tool bundle with five tool names (T-525)', () => {
    const tools = MANIFEST_SKELETON.contributes.tools ?? [];
    expect(tools).toHaveLength(1);
    expect(tools[0]).toEqual({
      bundleName: 'finance-domain',
      tools: [
        'finance.format_currency',
        'finance.compute_growth_rate',
        'finance.bullet_safe_harbor',
        'finance.lookup_ticker',
        'finance.normalize_eps',
      ],
    });
  });

  it('the tools contribution survives the withIntegrityHash clone (deep-clone discipline)', () => {
    const out = withIntegrityHash(VALID_HASH);
    expect(out.contributes.tools).toEqual([
      {
        bundleName: 'finance-domain',
        tools: [
          'finance.format_currency',
          'finance.compute_growth_rate',
          'finance.bullet_safe_harbor',
          'finance.lookup_ticker',
          'finance.normalize_eps',
        ],
      },
    ]);
    // Mutating the cloned tools array does not affect the skeleton.
    out.contributes.tools?.[0]?.tools.push('finance.mutated');
    expect(MANIFEST_SKELETON.contributes.tools?.[0]?.tools).toEqual([
      'finance.format_currency',
      'finance.compute_growth_rate',
      'finance.bullet_safe_harbor',
      'finance.lookup_ticker',
      'finance.normalize_eps',
    ]);
    // Mutating the cloned tools list (the outer array) does not affect the skeleton.
    out.contributes.tools?.push({ bundleName: 'mutated', tools: ['x'] });
    expect(MANIFEST_SKELETON.contributes.tools).toHaveLength(1);
  });

  it('keywords are all lowercase', () => {
    const keywords = MANIFEST_SKELETON.keywords ?? [];
    expect(keywords.length).toBeGreaterThan(0);
    for (const k of keywords) {
      expect(k).toBe(k.toLowerCase());
    }
  });

  it('keywords include the finance-vertical-cluster discriminant + the stageflip-first-party tag + the tools / semantic-tools markers (T-525)', () => {
    const keywords = MANIFEST_SKELETON.keywords ?? [];
    expect(keywords).toContain('cluster-finance');
    expect(keywords).toContain('stageflip-first-party');
    expect(keywords).toContain('finance');
    expect(keywords).toContain('tools');
    expect(keywords).toContain('semantic-tools');
  });

  it('publisher is the first-party StageFlip identity', () => {
    expect(MANIFEST_SKELETON.publisher).toEqual({
      id: 'stageflip',
      displayName: 'StageFlip',
    });
  });

  it('id is lowercase kebab-case + version is 0.2.0 (T-525 bumps from 0.1.0 — additive: new tools contribution + final placeholder slot filled)', () => {
    expect(MANIFEST_SKELETON.id).toBe('finance');
    expect(MANIFEST_SKELETON.version).toBe('0.2.0');
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
