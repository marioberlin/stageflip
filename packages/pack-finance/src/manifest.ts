// packages/pack-finance/src/manifest.ts
// T-521 — `Earnings & Investor` pack manifest skeleton. Single source
// of truth for the `@stageflip/pack-finance` content package per
// ADR-012 §D2 (manifest schema) + ADR-013 §D3 (paid-per-tenant
// commercial-subscription tier).
//
// The skeleton ships with `integrity.hash` as 64 zeroes; the
// orchestrator-run `scripts/build-pack.ts` rewrites the `integrity.hash`
// to match SHA-256 over the synthesized archive bytes before signing.
// Four placeholder preset contributions reserve slots for the
// finance-vertical composition templates (T-522 earnings-call
// template + T-523 investor-deck template), the Bloomberg-pro adapter
// premium tier (T-524), and the finance-domain semantic-tool
// extensions (T-525). All four placeholders declare the NEW
// `cluster-finance` vertical-use-case cluster — `cluster` is a
// free-form string in the manifest schema (`z.string().min(1)`), so
// declaring a new vertical-use-case cluster is purely a content-side
// metadata operation: it does NOT introduce a new clipKind in clip
// code and does NOT require allowlist updates to `check-skill-drift`
// (which walks `skills/stageflip/presets/<cluster>/` directories, not
// pack manifests). The skeleton is buildable + signable end-to-end so
// the pack-integrity gate exercises the real pipeline from day one.
//
// Unlike News Pro (cluster-a — broadcaster-brand registers) and
// Sports Networks (cluster-b — league-brand registers) and Creator
// Style (cluster-f — creator-brand registers), the Earnings &
// Investor Pack contributes vertical-use-case composition templates
// rather than per-brand registers.
//
// Determinism perimeter: `@stageflip/pack-finance` lives OUTSIDE per
// CLAUDE.md §3 — content packages are NOT in the perimeter, and this
// module is consumed by host-side tooling only.

import type { PackManifest } from '@stageflip/pack-format';

/** Placeholder hash used until `scripts/build-pack.ts` computes the real one. */
export const PLACEHOLDER_INTEGRITY_HASH = '0'.repeat(64);

/**
 * The Earnings & Investor pack manifest, expressed as a TypeScript
 * object so the editor surface can typecheck against it and so
 * `scripts/build-pack.ts` has a single source of truth to render into
 * `manifest.json`.
 *
 * NOTE: `integrity.hash` is the placeholder zeroes until the build
 * script substitutes the real SHA-256 of the synthesized archive.
 */
export const MANIFEST_SKELETON: PackManifest = {
  manifestVersion: '1',
  id: 'finance',
  name: 'Earnings & Investor',
  version: '0.1.0',
  publisher: {
    id: 'stageflip',
    displayName: 'StageFlip',
  },
  platformCompatibility: '^2.0.0',
  license: {
    kind: 'paid-per-tenant',
    sku: 'finance-1y',
    entitlementType: 'subscription',
  },
  integrity: {
    algorithm: 'sha256',
    hash: PLACEHOLDER_INTEGRITY_HASH,
  },
  contributes: {
    presets: [
      { id: 'earnings-call-template', cluster: 'cluster-finance' },
      { id: 'investor-deck-template', cluster: 'cluster-finance' },
      { id: 'bloomberg-pro-adapter-placeholder', cluster: 'cluster-finance' },
      { id: 'finance-semantic-tools-placeholder', cluster: 'cluster-finance' },
    ],
  },
  description:
    'Premium financial-communication templates extending a new finance-vertical cluster — earnings-call + investor-deck composition templates, Bloomberg-pro adapter premium tier, finance-domain semantic-tool extensions (filled in T-522..T-525).',
  homepage: 'https://stageflip.dev/packs/finance',
  repository: 'https://github.com/marioberlin/stageflip/tree/main/packages/pack-finance',
  keywords: [
    'finance',
    'earnings',
    'investor',
    'bloomberg',
    'cluster-finance',
    'stageflip-first-party',
  ],
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
