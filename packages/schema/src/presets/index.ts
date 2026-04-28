// packages/schema/src/presets/index.ts
// Public surface of the preset schema primitive (T-304) — BROWSER-SAFE.
// Schemas + types + body parser + error classes only. No I/O. Loader and
// registry live in `./node.ts` (Node-only subpath: `@stageflip/schema/presets/node`)
// because they import `node:fs` / `node:path`, which webpack cannot resolve in
// browser bundles for apps/stageflip-slide and apps/stageflip-display.
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
  FONT_LICENSE_ATOMS,
  fontLicenseAtomSchema,
  fontLicenseExpressionSchema,
  parseFontLicenseExpression,
  type FontLicenseAtom,
  type ParsedLicenseExpression,
} from './font-license.js';
