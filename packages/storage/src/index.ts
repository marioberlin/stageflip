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
export {
  aiBudgetSchema,
  tenantSettingsSchema,
  type AiBudget,
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
