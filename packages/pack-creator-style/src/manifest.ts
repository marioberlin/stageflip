// packages/pack-creator-style/src/manifest.ts
// T-516 — `Creator Style` pack manifest skeleton. Single source of
// truth for the `@stageflip/pack-creator-style` content package per
// ADR-012 §D2 (manifest schema) + ADR-013 §D3 (paid-per-tenant
// commercial-subscription tier).
//
// The skeleton ships with `integrity.hash` as 64 zeroes; the
// orchestrator-run `scripts/build-pack.ts` rewrites the `integrity.hash`
// to match SHA-256 over the synthesized archive bytes before signing.
// Four cluster-F preset contributions: the MKBHD-pro register (T-517,
// substantive) plus three placeholders reserved for Vox-deluxe (T-518),
// Linus-Tech-Tips-pro (T-519), and the prestige-creator composition
// preset (T-520). The skeleton is buildable + signable end-to-end so
// the pack-integrity gate exercises the real pipeline from day one.
//
// Determinism perimeter: `@stageflip/pack-creator-style` lives
// OUTSIDE per CLAUDE.md §3 — content packages are NOT in the
// perimeter, and this module is consumed by host-side tooling only.

import type { PackManifest } from '@stageflip/pack-format';

/** Placeholder hash used until `scripts/build-pack.ts` computes the real one. */
export const PLACEHOLDER_INTEGRITY_HASH = '0'.repeat(64);

/**
 * The Creator Style pack manifest, expressed as a TypeScript object
 * so the editor surface can typecheck against it and so
 * `scripts/build-pack.ts` has a single source of truth to render into
 * `manifest.json`.
 *
 * NOTE: `integrity.hash` is the placeholder zeroes until the build
 * script substitutes the real SHA-256 of the synthesized archive.
 */
export const MANIFEST_SKELETON: PackManifest = {
  manifestVersion: '1',
  id: 'creator-style',
  name: 'Creator Style',
  version: '0.1.0',
  publisher: {
    id: 'stageflip',
    displayName: 'StageFlip',
  },
  platformCompatibility: '^2.0.0',
  license: {
    kind: 'paid-per-tenant',
    sku: 'creator-style-1y',
    entitlementType: 'subscription',
  },
  integrity: {
    algorithm: 'sha256',
    hash: PLACEHOLDER_INTEGRITY_HASH,
  },
  contributes: {
    presets: [
      { id: 'mkbhd-pro-register', cluster: 'cluster-f' },
      { id: 'vox-deluxe-register-placeholder', cluster: 'cluster-f' },
      { id: 'linus-tech-tips-pro-register-placeholder', cluster: 'cluster-f' },
      { id: 'prestige-creator-placeholder', cluster: 'cluster-f' },
    ],
  },
  description:
    'Premium creator-economy templates extending Cluster F — substantive MKBHD-pro register (T-517) plus register variants for Vox-deluxe, Linus-Tech-Tips-pro and the prestige-creator composition preset (filled in T-518..T-520).',
  homepage: 'https://stageflip.dev/packs/creator-style',
  repository: 'https://github.com/marioberlin/stageflip/tree/main/packages/pack-creator-style',
  keywords: ['creator', 'youtube', 'creator-economy', 'cluster-f', 'stageflip-first-party'],
};

/**
 * Return a deep clone of `MANIFEST_SKELETON` with `integrity.hash`
 * replaced by `hashHex`. Pure: does not mutate the skeleton.
 *
 * @param hashHex 64-character lowercase hex SHA-256 digest.
 */
export function withIntegrityHash(hashHex: string): PackManifest {
  const out: PackManifest = {
    ...MANIFEST_SKELETON,
    publisher: { ...MANIFEST_SKELETON.publisher },
    license: { ...MANIFEST_SKELETON.license },
    integrity: { algorithm: 'sha256', hash: hashHex },
    contributes: {
      ...MANIFEST_SKELETON.contributes,
    },
  };
  if (MANIFEST_SKELETON.contributes.presets !== undefined) {
    out.contributes = {
      ...out.contributes,
      presets: MANIFEST_SKELETON.contributes.presets.map((p) => ({ ...p })),
    };
  }
  if (MANIFEST_SKELETON.keywords !== undefined) {
    out.keywords = [...MANIFEST_SKELETON.keywords];
  }
  return out;
}
