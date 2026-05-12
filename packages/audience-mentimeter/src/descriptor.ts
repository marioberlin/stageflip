// packages/audience-mentimeter/src/descriptor.ts
// Static `AdapterDescriptor` for the Mentimeter vendor audience-backend
// adapter (T-479). First of five vendor bridges per ADR-009 §D8.
//
// `id` = `'audience-mentimeter'` is the registry key.
// `license.kind` = `'proprietary-byo'` — Mentimeter is SaaS; tenants supply
// API credentials via TenantAdapterCredentialsStore (T-444).
// `sandbox.kind` = `'remote-service'` — calls Mentimeter's hosted REST API.
//
// `supportedClipKinds` covers 8 of 11 discriminants per ADR-009 §D8's
// vendor parity matrix — omits the three motion-native differentiators
// (heatmap / reaction-stream / audience-ai-prompt) since per ADR-010
// §D7 vendor adapters cannot reach them.
//
// `maxConcurrentVoters: 5000` matches Mentimeter's enterprise-plan cap.
// `snapshotCadenceHz: 5` matches Mentimeter's lower push frequency vs. the
// native 30 Hz; the descriptor declares it honestly so the routing
// engine can warn presenters when a vendor adapter falls below SLA.

import type { AdapterDescriptor } from '@stageflip/adapters-core';
import type { AudienceCapabilityDescriptor, AudienceClipKind } from '@stageflip/audience-contract';

/**
 * Env var the production wire-up reads for the Mentimeter API base URL.
 * `sandbox.baseUrlEnvVar` per the `remote-service` schema; stub-mode
 * never reads this.
 */
export const AUDIENCE_MENTIMETER_BASE_URL_ENV_VAR = 'MENTIMETER_API_BASE_URL';

/**
 * Per ADR-009 §D8 vendor parity matrix line: `audience-mentimeter | ✓ | ✓ |
 * ✓ | partial[¹] | ✓ | ✓ | ✗ | ✗ | ✗`. Mentimeter leaderboard is tied to
 * its quiz feature; the partial-support footnote is documented in the
 * ADR but at the descriptor level we declare full support for
 * `leaderboard` and surface the partial-support nuance via the future
 * adapter regression suite (T-485).
 */
export const AUDIENCE_MENTIMETER_SUPPORTED_CLIP_KINDS: readonly AudienceClipKind[] = [
  'live-poll-multiple-choice',
  'live-poll-open-text',
  'live-poll-rating',
  'live-qa',
  'live-quiz',
  'leaderboard',
  'word-cloud',
  'survey',
];

/**
 * Capability shape per ADR-009 §D2 + §D8 vendor parity matrix.
 */
export const audienceMentimeterCapability: AudienceCapabilityDescriptor = {
  persistenceTier: 'durable',
  maxConcurrentVoters: 5000,
  supportedClipKinds: AUDIENCE_MENTIMETER_SUPPORTED_CLIP_KINDS,
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
 * `costPerCall.usd = 0` — Mentimeter billing is tenant-handled out of band
 * via the tenant's own Mentimeter contract. The StageFlip tenant cost
 * tracker (T-443) records adapter invocation counts; dollar
 * attribution to Mentimeter is the tenant's reconciliation.
 *
 * `latencyMs.{p50,p95}` are the vendor's stated latency (Mentimeter
 * typically ~150 / ~400 ms vendor-side; production wire-up T-479a
 * calibrates against real numbers).
 */
export const audienceMentimeterDescriptor: AdapterDescriptor = {
  id: 'audience-mentimeter',
  modality: { kind: 'audience-backend' },
  capability: { ...audienceMentimeterCapability },
  license: { kind: 'proprietary-byo' },
  sandbox: { kind: 'remote-service', baseUrlEnvVar: AUDIENCE_MENTIMETER_BASE_URL_ENV_VAR },
  costPerCall: { usd: 0 },
  latencyMs: { p50: 150, p95: 400 },
};
