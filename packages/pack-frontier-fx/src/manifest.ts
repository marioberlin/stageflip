// packages/pack-frontier-fx/src/manifest.ts
// T-531 / T-532 / T-533 — `Frontier Effects` pack manifest. Single
// source of truth for the `@stageflip/pack-frontier-fx` content package
// per ADR-012 §D2 (manifest schema) + ADR-013 §D3 (paid-per-tenant
// commercial-subscription tier).
//
// The manifest ships with `integrity.hash` as 64 zeroes; the
// orchestrator-run `scripts/build-pack.ts` rewrites the `integrity.hash`
// to match SHA-256 over the synthesized archive bytes before signing.
// Six of eight preset contributions are now substantive — five premium
// shader presets from T-532 (shader-aurora-borealis / shader-cosmic-
// nebula / shader-liquid-metal / shader-fire-portal / shader-data-
// stream binding the existing T-383 `ShaderClip` primitive) and the
// pre-licensed commercial-OK 3D asset library from T-533
// (`3d-asset-library`). T-533 additionally seeds the manifest's
// `contributes.assets` array with the eight pre-licensed 3D asset
// references per ADR-012 §D5 — the actual .glb bytes are NOT shipped in
// the pack archive (per-tenant external delivery due to commercial-3D-
// asset licensing terms), documented as a Trade-off in the preset
// markdown. Two placeholder slots remain (T-534 ReactionStream particle
// physics presets + T-535 premium TitleSequence templates). All eight
// entries declare the existing `cluster-i` Live Audience cluster —
// frontier-effects builds on top of cluster-i's frontier-runtime work
// from P15 + the Track A frontier-runtime work. `cluster-i` is already
// in use by frontier-runtime preset contributions; declaring presets
// against it is purely a content-side metadata operation that does NOT
// introduce a new clipKind in clip code and does NOT require allowlist
// updates to `check-skill-drift` (which walks
// `skills/stageflip/presets/<cluster>/` directories, not pack
// manifests). T-533 does NOT bump the pack version — T-535 carries the
// v0.2.0 GA bump that closes the Frontier Effects launch pack.
//
// Unlike News Pro (cluster-a — broadcaster-brand registers), Sports
// Networks (cluster-b — league-brand registers), Creator Style
// (cluster-f — creator-brand registers), Earnings & Investor
// (cluster-finance — vertical-use-case templates), and Wedding &
// Events (cluster-wedding-events — vertical-use-case theme variants
// + composition templates + transitions + audio bed library), the
// Frontier Effects Pack is **runtime-feature-extension** oriented:
// premium shaders, a pre-licensed 3D asset library, premium
// ReactionStream particle physics presets, and premium
// TitleSequence templates — all leveraging the frontier-runtime
// surface area extended in Cluster I (P15 + Track A).
//
// Determinism perimeter: `@stageflip/pack-frontier-fx` lives
// OUTSIDE per CLAUDE.md §3 — content packages are NOT in the
// perimeter, and this module is consumed by host-side tooling only.

import type { PackManifest } from '@stageflip/pack-format';

/** Placeholder hash used until `scripts/build-pack.ts` computes the real one. */
export const PLACEHOLDER_INTEGRITY_HASH = '0'.repeat(64);

/**
 * The Frontier Effects pack manifest, expressed as a TypeScript
 * object so the editor surface can typecheck against it and so
 * `scripts/build-pack.ts` has a single source of truth to render into
 * `manifest.json`.
 *
 * NOTE: `integrity.hash` is the placeholder zeroes until the build
 * script substitutes the real SHA-256 of the synthesized archive.
 */
export const MANIFEST_SKELETON: PackManifest = {
  manifestVersion: '1',
  id: 'frontier-fx',
  name: 'Frontier Effects',
  version: '0.1.0',
  publisher: {
    id: 'stageflip',
    displayName: 'StageFlip',
  },
  platformCompatibility: '^2.0.0',
  license: {
    kind: 'paid-per-tenant',
    sku: 'frontier-fx-1y',
    entitlementType: 'subscription',
  },
  integrity: {
    algorithm: 'sha256',
    hash: PLACEHOLDER_INTEGRITY_HASH,
  },
  contributes: {
    presets: [
      { id: 'shader-aurora-borealis', cluster: 'cluster-i' },
      { id: 'shader-cosmic-nebula', cluster: 'cluster-i' },
      { id: 'shader-liquid-metal', cluster: 'cluster-i' },
      { id: 'shader-fire-portal', cluster: 'cluster-i' },
      { id: 'shader-data-stream', cluster: 'cluster-i' },
      { id: '3d-asset-library', cluster: 'cluster-i' },
      { id: 'reactionstream-physics-placeholder', cluster: 'cluster-i' },
      { id: 'titlesequence-premium-placeholder', cluster: 'cluster-i' },
    ],
    assets: [
      {
        path: '3d/podium-classic.glb',
        mimeType: 'model/gltf-binary',
      },
      {
        path: '3d/stage-spotlight-set.glb',
        mimeType: 'model/gltf-binary',
      },
      {
        path: '3d/data-cube-rotating.glb',
        mimeType: 'model/gltf-binary',
      },
      {
        path: '3d/sphere-particles.glb',
        mimeType: 'model/gltf-binary',
      },
      {
        path: '3d/celebration-confetti-burst.glb',
        mimeType: 'model/gltf-binary',
      },
      {
        path: '3d/handshake-icon-3d.glb',
        mimeType: 'model/gltf-binary',
      },
      {
        path: '3d/award-trophy.glb',
        mimeType: 'model/gltf-binary',
      },
      {
        path: '3d/ribbon-cut-scissors.glb',
        mimeType: 'model/gltf-binary',
      },
    ],
  },
  description:
    'Premium frontier-effects pack extending Cluster I with five substantive premium shader presets from T-532 (shader-aurora-borealis / shader-cosmic-nebula / shader-liquid-metal / shader-fire-portal / shader-data-stream binding the T-383 ShaderClip primitive) + a pre-licensed commercial-OK 3D asset library from T-533 (eight pre-licensed .glb assets declared in contributes.assets — classical podium, stage spotlight rig, rotating glass data cube, particle sphere with bloom, celebration confetti burst, corporate handshake icon, award trophy, opening-ceremony ribbon-cut scissors — with actual .glb bytes delivered per-tenant externally under commercial-3D licensing terms, NOT shipped in the pack archive) + premium ReactionStream particle physics presets (T-534) + premium TitleSequence templates (T-535).',
  homepage: 'https://stageflip.dev/packs/frontier-fx',
  repository: 'https://github.com/marioberlin/stageflip/tree/main/packages/pack-frontier-fx',
  keywords: [
    'frontier',
    'shaders',
    '3d',
    'particles',
    'effects',
    'cluster-i',
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
  if (MANIFEST_SKELETON.contributes.assets !== undefined) {
    out.contributes = {
      ...out.contributes,
      assets: MANIFEST_SKELETON.contributes.assets.map((a) => ({ ...a })),
    };
  }
  if (MANIFEST_SKELETON.keywords !== undefined) {
    out.keywords = [...MANIFEST_SKELETON.keywords];
  }
  return out;
}
