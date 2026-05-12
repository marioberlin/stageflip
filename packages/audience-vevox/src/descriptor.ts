// packages/audience-vevox/src/descriptor.ts
// Static `AdapterDescriptor` for the Vevox vendor audience-backend
// adapter (T-479). First of five vendor bridges per ADR-009 §D8.
//
// `id` = `'audience-vevox'` is the registry key.
// `license.kind` = `'proprietary-byo'` — Vevox is SaaS; tenants supply
// API credentials via TenantAdapterCredentialsStore (T-444).
// `sandbox.kind` = `'remote-service'` — calls Vevox's hosted REST API.
//
// `supportedClipKinds` covers 8 of 11 discriminants per ADR-009 §D8's
// vendor parity matrix — omits the three motion-native differentiators
// (heatmap / reaction-stream / audience-ai-prompt) since per ADR-010
// §D7 vendor adapters cannot reach them.
//
// `maxConcurrentVoters: 5000` matches Vevox's enterprise-plan cap.
// `snapshotCadenceHz: 5` matches Vevox's lower push frequency vs. the
// native 30 Hz; the descriptor declares it honestly so the routing
// engine can warn presenters when a vendor adapter falls below SLA.

import type { AdapterDescriptor } from '@stageflip/adapters-core';
import type { AudienceCapabilityDescriptor, AudienceClipKind } from '@stageflip/audience-contract';

/**
 * Env var the production wire-up reads for the Vevox API base URL.
 * `sandbox.baseUrlEnvVar` per the `remote-service` schema; stub-mode
 * never reads this.
 */
export const AUDIENCE_VEVOX_BASE_URL_ENV_VAR = 'VEVOX_API_BASE_URL';

/**
 * Per ADR-009 §D8 vendor parity matrix line: `audience-vevox | ✓ | ✓ |
 * ✓ | partial[²] | ✗ | ✓ | ✓ | ✗ | ✗ | ✗`. Vevox does NOT support
 * standalone leaderboard; `live-quiz` has tighter timing constraints
 * documented in T-485's regression suite. Motion-native discriminants
 * (heatmap / reaction-stream / audience-ai-prompt) are out per
 * ADR-010 §D7.
 */
export const AUDIENCE_VEVOX_SUPPORTED_CLIP_KINDS: readonly AudienceClipKind[] = [
  'live-poll-multiple-choice',
  'live-poll-open-text',
  'live-poll-rating',
  'live-qa',
  'live-quiz',
  'word-cloud',
  'survey',
];

/**
 * Capability shape per ADR-009 §D2 + §D8 vendor parity matrix.
 */
export const audienceVevoxCapability: AudienceCapabilityDescriptor = {
  persistenceTier: 'durable',
  maxConcurrentVoters: 5000,
  supportedClipKinds: AUDIENCE_VEVOX_SUPPORTED_CLIP_KINDS,
  supportsMotionNative: false,
  voterIdentity: 'anonymous',
  supportsStaticFallback: true,
  maxIngestRateHz: 200,
  snapshotCadenceHz: 5,
};

/**
 * Static `AdapterDescriptor`. The `descriptor` named export (alias in
 * `index.ts`) is what `scripts/check-asset-licenses.ts` (T-422)
 * discovers via dynamic import.
 *
 * `costPerCall.usd = 0` — Vevox billing is tenant-handled out of band
 * via the tenant's own Vevox contract. The StageFlip tenant cost
 * tracker (T-443) records adapter invocation counts; dollar
 * attribution to Vevox is the tenant's reconciliation.
 *
 * `latencyMs.{p50,p95}` are the vendor's stated latency (Vevox
 * typically ~150 / ~400 ms vendor-side; production wire-up T-482a
 * calibrates against real numbers).
 */
export const audienceVevoxDescriptor: AdapterDescriptor = {
  id: 'audience-vevox',
  modality: { kind: 'audience-backend' },
  capability: { ...audienceVevoxCapability },
  license: { kind: 'proprietary-byo' },
  sandbox: { kind: 'remote-service', baseUrlEnvVar: AUDIENCE_VEVOX_BASE_URL_ENV_VAR },
  costPerCall: { usd: 0 },
  latencyMs: { p50: 150, p95: 400 },
};
