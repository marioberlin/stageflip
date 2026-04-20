// packages/skills-sync/src/index.ts
// @stageflip/skills-sync — generators that emit auto-generated SKILL.md
// files from the canonical source of truth (schemas, tool registries, CLI
// command graph, clips catalog, etc.).
//
// T-034 ships the first generator: schema reference. Subsequent tasks wire
// the tools / cli / clips / validation-rules generators (T-169, T-220).

export { describeInner, describeSchema, type SchemaDescriptor } from './introspect.js';
export { buildSchemaEntries, generateSchemaSkill } from './schema-gen.js';
