// packages/schema/src/presets/node.ts
// Node-only surface of the preset schema primitive (T-304). Loader + registry
// re-exports. These modules import `node:fs` / `node:path` and must NOT be
// pulled into browser bundles. Published as the `@stageflip/schema/presets/node`
// subpath export — see packages/schema/package.json.

export {
  loadAllPresets,
  loadCluster,
  loadClusterSkill,
  loadPreset,
  resetLoaderCache,
  type ClusterSkill,
  type LoadClusterResult,
  type Preset,
} from './loader.js';
export { PresetRegistry, type RegistryClusterEntry } from './registry.js';
export {
  canonicalizeFontFamily,
  FontLicenseRegistry,
  type FontEntry,
  type ValidationResult,
} from './font-registry.js';
