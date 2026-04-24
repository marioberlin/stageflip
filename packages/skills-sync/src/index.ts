// packages/skills-sync/src/index.ts
// @stageflip/skills-sync — generators that emit auto-generated SKILL.md
// files from the canonical source of truth (schemas, tool registries, CLI
// command graph, clips catalog, runtime registry, validation rules).
//
// Generators land incrementally:
//   T-034 — reference/schema
//   T-107 — reference/validation-rules
//   T-169 — per-bundle tools skills (shipped as a script, not a generator here)
//   T-220 — clips catalog, tools index, runtimes index, CLI reference

export { describeInner, describeSchema, type SchemaDescriptor } from './introspect.js';
export { buildSchemaEntries, generateSchemaSkill } from './schema-gen.js';
export {
  buildValidationRuleGroups,
  generateValidationRulesSkill,
  type ValidationRulesPkg,
} from './validation-rules-gen.js';
export {
  buildClipsCatalogGroups,
  generateClipsCatalogSkill,
  type ClipsCatalogGroup,
  type ClipsCatalogPkg,
  type ClipsCatalogRuntime,
} from './clips-catalog-gen.js';
export {
  generateToolsIndexSkill,
  type ToolsIndexBundle,
  type ToolsIndexPkg,
} from './tools-index-gen.js';
export {
  generateRuntimesIndexSkill,
  type RuntimesIndexPkg,
  type RuntimesIndexRuntime,
} from './runtimes-index-gen.js';
export {
  generateCliReferenceSkill,
  type CliCommand,
  type CliCommandArg,
  type CliCommandFlag,
  type CliReferencePkg,
} from './cli-reference-gen.js';
export { LIVE_RUNTIME_MANIFEST } from './live-runtime-manifest.js';
