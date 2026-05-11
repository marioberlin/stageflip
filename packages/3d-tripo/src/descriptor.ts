// packages/3d-tripo/src/descriptor.ts
// Static `AdapterDescriptor` for the Tripo3D character adapter (T-428).
// Verbatim from ADR-007 §D1 + ADR-008 §D6.
//
// `id` = `'tripo'` is the registry key (paired with `modality.kind:
// 'three-d'`).
// `license.kind` = `'proprietary-byo'` clears the per-modality whitelist
// (ADR-008 §D13 line 657: `three-d` admits `apache-2.0`, `mit`,
// `proprietary-byo`, `proprietary-vendored`). Tenant supplies the API
// credentials at runtime — StageFlip ships no vendored model checkpoint.
// `sandbox.kind` = `'remote-service'` (`baseUrlEnvVar:
// 'TRIPO_API_BASE_URL'`) — the Tripo HTTPS API is the production
// endpoint; the env var is the credentials anchor T-428a will read.
//
// **Differentiator vs T-426 / T-427 (TTS)**: first `proprietary-byo`
// adapter; first `three-d` adapter; first `remote-service` sandbox; first
// non-zero `costPerCall`; first batch-tier latency.
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
export const TRIPO_MAX_VERTICES = 50_000;

/**
 * Env-var name the production wire-up (T-428a) reads to discover the
 * Tripo HTTPS base URL. Encoded in the descriptor's
 * `sandbox.baseUrlEnvVar`. The stub mode never reads this.
 */
export const TRIPO_BASE_URL_ENV_VAR = 'TRIPO_API_BASE_URL';

/**
 * Strict `ThreeDCapabilityDescriptor` subset — passes
 * `validateThreeDCapability` from T-419. The full
 * `tripoDescriptor.capability` also carries the catalog-summary fields
 * (`formats`, `maxPolyCount`) that T-424's generator reads.
 */
export const tripoThreeDCapability: ThreeDCapabilityDescriptor = {
  outputFormats: ['glb'],
  topology: 'quad-clean',
  supportsAutoRigging: true,
  maxVertices: TRIPO_MAX_VERTICES,
};

/**
 * The static `AdapterDescriptor` the host shell registers into its
 * `AdapterRegistry`. The `descriptor` named export (alias) is what
 * `scripts/check-asset-licenses.ts` discovers via dynamic import.
 *
 * `costPerCall.usd = 0.5` — Tripo charges per asset; tenant pays.
 * `latencyMs.{p50,p95}` reflect the upstream "1–2 minute typical"
 * claim — this places the adapter in the catalog's `batch < 5min` tier
 * (skills-sync's `latencyTier` bucketing).
 */
export const tripoDescriptor: AdapterDescriptor = {
  id: 'tripo',
  modality: { kind: 'three-d' },
  capability: {
    ...tripoThreeDCapability,
    // Catalog-summary fields read by skills-sync's `capabilitySummary`
    // helper (T-424 / packages/skills-sync/src/asset-providers-gen.ts):
    // `three-d` row reads `formats` (string[]) and `maxPolyCount` (number).
    formats: ['glb'],
    maxPolyCount: TRIPO_MAX_VERTICES,
  },
  license: { kind: 'proprietary-byo' },
  sandbox: { kind: 'remote-service', baseUrlEnvVar: TRIPO_BASE_URL_ENV_VAR },
  costPerCall: { usd: 0.5 },
  latencyMs: { p50: 60_000, p95: 120_000 },
};
