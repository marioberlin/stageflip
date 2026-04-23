// packages/editor-shell/src/cloud-save/index.ts
// Barrel for the cloud-save framework surface (T-139c).

export { createStubCloudSaveAdapter, type StubCloudSaveOptions } from './stub-adapter';
export {
  CloudSaveConflictError,
  type CloudSaveAdapter,
  type CloudSaveResult,
  type CloudSaveStatus,
} from './types';
