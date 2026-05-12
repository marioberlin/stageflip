// packages/audience-native/src/descriptor.ts
// Static `AdapterDescriptor` for the native audience backend (T-478).
// First concrete `AudienceBackendProvider` implementation; the
// audience-modality analog of the 9 P14 reference adapters.
//
// `id` = `'audience-native'` is the registry key (paired with
// `modality.kind: 'audience-backend'`).
// `license.kind` = `'mit'` clears the per-modality whitelist
// (`PER_MODALITY_LICENSE_WHITELIST['audience-backend']` admits
// `apache-2.0`, `mit`, `proprietary-byo`, `proprietary-vendored`).
// `sandbox.kind` = `'in-process'` — the provider delegates to the
// in-process `AudienceResultsStore` (in-memory for tests, Firestore
// in production); no separate process boundary.
//
// `supportedClipKinds` enumerates ALL 11 `AudienceClipKind` discriminants
// — native covers everything including the three motion-native
// differentiators (Heatmap / ReactionStream / AudienceAiPrompt) that
// vendor adapters cannot reach per ADR-010 §D7.

import type { AdapterDescriptor } from '@stageflip/adapters-core';
import {
  AUDIENCE_CLIP_KINDS,
  type AudienceCapabilityDescriptor,
} from '@stageflip/audience-contract';

/**
 * Capability shape per ADR-009 §D2. Native backend supports the full
 * eleven-kind inventory + the SLA's 1000-concurrent-voter target with
 * a 30 Hz snapshot cadence and a 100 Hz default ingest rate (matches
 * `apps/api`'s `TenantSettings.features.audience.maxIngestRateHz`
 * default per T-453).
 */
export const audienceNativeCapability: AudienceCapabilityDescriptor = {
  persistenceTier: 'durable',
  maxConcurrentVoters: 1000,
  supportedClipKinds: [...AUDIENCE_CLIP_KINDS],
  supportsMotionNative: true,
  voterIdentity: 'anonymous',
  supportsStaticFallback: true,
  maxIngestRateHz: 100,
  snapshotCadenceHz: 30,
};

/**
 * The static `AdapterDescriptor` host shells register into their
 * `AdapterRegistry`. The `descriptor` named export (alias in `index.ts`)
 * is what `scripts/check-asset-licenses.ts` discovers via dynamic import.
 *
 * `costPerCall.usd = 0` — native backend is free at the model level
 * (compute is the host's). `latencyMs` reflects T-475's in-process
 * measurement headroom against the ADR-009 §D4 SLA budget.
 */
export const audienceNativeDescriptor: AdapterDescriptor = {
  id: 'audience-native',
  modality: { kind: 'audience-backend' },
  capability: { ...audienceNativeCapability },
  license: { kind: 'mit' },
  sandbox: { kind: 'in-process' },
  costPerCall: { usd: 0 },
  latencyMs: { p50: 50, p95: 200 },
};
