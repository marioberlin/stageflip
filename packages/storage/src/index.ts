// packages/storage/src/index.ts
// @stageflip/storage — the storage contract + a minimum-viable in-memory
// adapter. See skills/stageflip/concepts/collab/SKILL.md and
// docs/implementation-plan.md T-025 for the architectural role.
//
// Concrete adapters land in their own packages:
//   - @stageflip/storage-firebase   (T-036, T-037)
//   - @stageflip/storage-postgres   (T-270)

export {
  changeSetSchema,
  documentSnapshotSchema,
  jsonPatchOpSchema,
  StorageVersionMismatchError,
  type ChangeSet,
  type DocumentSnapshot,
  type HistoryOptions,
  type JsonPatchOp,
  type StorageAdapter,
  type SubscribeOptions,
} from './contract.js';

export { InMemoryStorageAdapter } from './in-memory.js';

// T-411a — TenantSettings storage facet (per-tenant frontier-enablement
// settings; the storage layer for the toggle from
// docs/decisions/ADR-005-frontier-clip-catalogue.md §D3).
// T-443 — extended with optional `aiBudget` field; see
// skills/stageflip/concepts/cost-budget/SKILL.md.
// T-453 — extended with optional `features.audience` sub-namespace.
export {
  aiBudgetSchema,
  audienceFeatureSettingsSchema,
  tenantSettingsSchema,
  type AiBudget,
  type AudienceFeatureSettings,
  type TenantSettings,
} from './tenant-settings.js';
export {
  InMemoryTenantSettingsStore,
  type TenantSettingsStore,
} from './tenant-settings-store.js';

// T-443 — TenantCostTrackerStore storage facet (per-tenant accumulator
// of AI-generation cost records; pairs with `aiBudget` on
// `TenantSettings` to surface `costBudget` envelopes on tool results).
export {
  InMemoryTenantCostTrackerStore,
  type CostRecord,
  type TenantCostTrackerStore,
} from './tenant-cost-tracker-store.js';

// T-444 — TenantAdapterCredentialsStore storage facet (per-tenant +
// per-adapter scoped credentials; pairs with the new
// `TenantSettings.adapterCredentials?` field). The host's
// `SandboxFactory` calls `getCredentials(tenantId, adapterId)` and
// forwards ONLY the matched record to the runner.
export {
  adapterCredentialSchema,
  adapterCredentialsMapSchema,
  adapterIdSchema,
  type AdapterCredential,
  type AdapterCredentialsMap,
} from './tenant-adapter-credentials.js';
export {
  InMemoryTenantAdapterCredentialsStore,
  type TenantAdapterCredentialsStore,
} from './tenant-adapter-credentials-store.js';

// T-453 — AudienceResultsStore storage facet (per-session audience-event
// + aggregation persistence per ADR-009 §D5). Ships only the in-memory
// impl + contract here; the Firestore-backed impl lands in T-474
// (`@stageflip/storage-firebase`).
export {
  audienceEventDocSchema,
  audienceSessionAdapterDescriptorSchema,
  audienceSessionDocSchema,
  type AudienceEventDoc,
  type AudienceSessionAdapterDescriptor,
  type AudienceSessionDoc,
} from './audience-results.js';
export {
  InMemoryAudienceResultsStore,
  type AppendEventInput,
  type AudienceResultsStore,
  type CloseSessionInput,
  type OpenSessionInput,
} from './audience-results-store.js';

// T-458 — AbuseTrackingStore storage facet (per-source rate-limit-hit
// accumulator + escalating-cooldown flag store per ADR-009 §D3 + §D8).
// Sibling to TenantSettingsStore / TenantCostTrackerStore /
// AudienceResultsStore. Ships only the in-memory impl + contract here;
// the Firestore-backed impl lands in T-474.
export {
  ABUSE_COOLDOWN_MS,
  ABUSE_ESCALATION_WINDOW_MS,
  DEFAULT_ABUSE_THRESHOLD,
  DEFAULT_ABUSE_WINDOW_MS,
  abuseCounterSchema,
  abuseFlagSchema,
  abuseSourceSchema,
  type AbuseCounter,
  type AbuseFlag,
  type AbuseSource,
} from './abuse-tracking.js';
export {
  InMemoryAbuseTrackingStore,
  type AbuseTrackingStore,
  type InMemoryAbuseTrackingStoreOptions,
} from './abuse-tracking-store.js';
