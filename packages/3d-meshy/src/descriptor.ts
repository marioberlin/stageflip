// packages/3d-meshy/src/descriptor.ts
// Static `AdapterDescriptor` for the Meshy 3D adapter (T-429).
// Verbatim from ADR-007 §D1 + ADR-008 §D6.
//
// `id` = `'meshy'` is the registry key (paired with `modality.kind:
// 'three-d'`).
// `license.kind` = `'proprietary-byo'` clears the per-modality whitelist
// (ADR-008 §D13 line 657: `three-d` admits `apache-2.0`, `mit`,
// `proprietary-byo`, `proprietary-vendored`). Tenant supplies the API
// credentials at runtime — StageFlip ships no vendored model checkpoint.
// `sandbox.kind` = `'remote-service'` (`baseUrlEnvVar:
// 'MESHY_API_BASE_URL'`) — the Meshy HTTPS API is the production
// endpoint; the env var is the credentials anchor T-429a will read.
//
// **Differentiators vs T-428 (Tripo characters)**: same modality + same
// `proprietary-byo` posture + same `remote-service` sandbox shape, but:
//   - subject scope is props + environment + vehicles + hard-surface
//     (NOT characters);
//   - `topology = 'triangle-soup'` (NOT `'quad-clean'`) — props /
//     environment do not need animator-grade quads;
//   - `supportsAutoRigging = false` (NOT `true`) — props / environment
//     do not need bones; T-437 also refuses rigging on `triangle-soup`
//     per ADR-008 §D6 regardless;
//   - `maxVertices = 30_000` (NOT `50_000`) — Meshy's lower per-asset cap;
//   - `latencyMs = 60_000 / 90_000` (~1 min typical; still **batch tier**);
//   - `costPerCall.usd = 0.2` (NOT `0.5`) — Meshy's lower per-asset price.
//
// The capability shape carries two **extra fields** beyond the strict
// `ThreeDCapabilityDescriptor` (`formats`, `maxPolyCount`) that the
// T-424 catalog generator reads via `readStringArray` / `readNumber` —
// these are tolerated by the T-418 envelope (`z.record(z.unknown())`)
// but would be rejected by the strict
// `threeDCapabilityDescriptorSchema` from T-419. Tests pass the
// `validateThreeDCapability` validator a SUBSET of the capability with
// the catalog-summary fields stripped.

import type { AdapterDescriptor } from '@stageflip/adapters-core';
import type { ThreeDCapabilityDescriptor } from '@stageflip/asset-gen-contract';

/** Maximum mesh complexity the adapter declares (vertex count). */
export const MESHY_MAX_VERTICES = 30_000;

/**
 * Env-var name the production wire-up (T-429a) reads to discover the
 * Meshy HTTPS base URL. Encoded in the descriptor's
 * `sandbox.baseUrlEnvVar`. The stub mode never reads this.
 */
export const MESHY_BASE_URL_ENV_VAR = 'MESHY_API_BASE_URL';

/**
 * Strict `ThreeDCapabilityDescriptor` subset — passes
 * `validateThreeDCapability` from T-419. The full
 * `meshyDescriptor.capability` also carries the catalog-summary fields
 * (`formats`, `maxPolyCount`) that T-424's generator reads.
 */
export const meshyThreeDCapability: ThreeDCapabilityDescriptor = {
  outputFormats: ['glb'],
  topology: 'triangle-soup',
  supportsAutoRigging: false,
  maxVertices: MESHY_MAX_VERTICES,
};

/**
 * The static `AdapterDescriptor` the host shell registers into its
 * `AdapterRegistry`. The `descriptor` named export (alias) is what
 * `scripts/check-asset-licenses.ts` discovers via dynamic import.
 *
 * `costPerCall.usd = 0.2` — Meshy charges per asset; tenant pays.
 * `latencyMs.{p50,p95}` reflect the upstream "~1 minute typical"
 * claim — this places the adapter in the catalog's `batch < 5min` tier
 * (skills-sync's `latencyTier` bucketing).
 */
export const meshyDescriptor: AdapterDescriptor = {
  id: 'meshy',
  modality: { kind: 'three-d' },
  capability: {
    ...meshyThreeDCapability,
    // Catalog-summary fields read by skills-sync's `capabilitySummary`
    // helper (T-424 / packages/skills-sync/src/asset-providers-gen.ts):
    // `three-d` row reads `formats` (string[]) and `maxPolyCount` (number).
    formats: ['glb'],
    maxPolyCount: MESHY_MAX_VERTICES,
  },
  license: { kind: 'proprietary-byo' },
  sandbox: { kind: 'remote-service', baseUrlEnvVar: MESHY_BASE_URL_ENV_VAR },
  costPerCall: { usd: 0.2 },
  latencyMs: { p50: 60_000, p95: 90_000 },
};
