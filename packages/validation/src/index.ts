// packages/validation/src/index.ts
// @stageflip/validation — the pre-render linter for RIR documents.
//
// Use `lintDocument(doc, opts?)` to produce a `LintReport`
// (findings + severity-bucketed counts + pass flag). Callers
// choosing the default rule set opt into every rule in
// `ALL_RULES`; pass a custom `rules` array to run a subset.
//
// Rule categories:
//   - timing (elements + animations + ids)
//   - transform (bounds, opacity, rotation)
//   - content (text / shape / video / embed / chart / table)
//   - composition (fps, duration, codec hygiene)
//   - fonts (requirements ↔ usage)
//   - stacking (stackingMap ↔ elements)
//   - clips (runtime registry resolution; context-dependent)
//
// Every rule has a stable `id` so consumers can allowlist or
// denylist specific rules without redefining the whole set.

export { lintDocument, type LintOptions } from './runner.js';
export {
  ALL_RULES,
  CLIP_RULES,
  COMPOSITION_RULES,
  CONTENT_RULES,
  FONT_RULES,
  STACKING_RULES,
  TIMING_RULES,
  TRANSFORM_RULES,
} from './rules/index.js';
export type {
  LintContext,
  LintFinding,
  LintReport,
  LintRule,
  LintSeverity,
} from './types.js';
