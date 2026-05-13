// packages/engine/src/license/index.ts
// T-496 — Public barrel for the license-runtime namespace. The engine's
// top-level `index.ts` re-exports everything here.

export {
  type ClipLicenseRecord,
  LicenseRuntime,
  type LicenseMountResult,
  type LicenseRuntimeDependencies,
} from './license-runtime.js';
