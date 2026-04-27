// packages/collab/src/index.ts
// @stageflip/collab — Yjs CRDT sync layer for canonical Documents per
// ADR-006 / T-260. Public surface consumed by editor-shell (later tasks).

export {
  ROOT_KEY,
  buildElementMap,
  buildSlideMap,
  documentToYDoc,
  getSlideIndex,
  getSlideMap,
  getSlidesArray,
  readElementMap,
  readSlideMap,
  yDocToDocument,
} from './binding.js';

export {
  PROVIDER_ORIGIN,
  type ProviderStatus,
  type StatusListener,
  type YjsStorageProviderOptions,
  YjsStorageProvider,
} from './provider.js';

export { CollabClient, type CollabClientOptions } from './client.js';

export {
  COMMAND_REGISTRY,
  type CommandArgs,
  type CommandContext,
  type CommandFn,
  type CommandName,
} from './commands/index.js';

export {
  buildChangeSet,
  diffText,
  emitChangeSet,
  setChangeSetIdProvider,
  setChangeSetNowProvider,
  type TextEdit,
} from './changeset.js';

export { compact, setSnapshotNowProvider } from './snapshot.js';
