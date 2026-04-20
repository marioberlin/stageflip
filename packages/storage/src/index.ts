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
