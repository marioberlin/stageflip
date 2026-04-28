// packages/schema/src/presets/index.ts
// Public surface of the preset schema primitive (T-304). Loader + validator +
// frontmatter parser for the SKILL.md tree at skills/stageflip/presets/.
// Consumed by T-307 (font-license registry), T-308 (check-preset-integrity
// CI gate), and downstream semantic-router / preset-builder tasks.

export {
  PresetParseError,
  PresetRegistryLoadError,
  PresetValidationError,
  type PresetRegistryLoadIssue,
} from './errors.js';
export {
  clusterSkillFrontmatterSchema,
  PRESET_CLUSTERS,
  PRESET_PERMISSIONS,
  presetFrontmatterSchema,
  type ClusterSkillFrontmatter,
  type PresetCluster,
  type PresetFrontmatter,
  type PresetPermission,
} from './frontmatter.js';
export { extractPresetBody, type PresetBody } from './body.js';
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
