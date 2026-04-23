// packages/skills-sync/src/validation-rules-gen.ts
// Generator for skills/stageflip/reference/validation-rules/SKILL.md.
// Reads every rule exported from `@stageflip/validation`'s
// category-grouped arrays and emits a deterministic markdown
// catalogue. The `check-skill-drift` + `skills-sync:check` gate
// fails if the committed SKILL.md diverges from what this generator
// produces — keeps the doc honest without a human having to
// remember to update it.
//
// Design: every category heading + prose block is stored alongside
// the rule-id lookup so adding a new category is one edit. Prose
// that isn't pulled from rule metadata (quick-start, lifecycle,
// customisation) is carried as constants here, keeping the skill
// pure-auto-gen rather than mixing hand-curated and generated
// sections.

import type { LintRule } from '@stageflip/validation';

/**
 * Shape of the generator input. Callers pass the live
 * `@stageflip/validation` module surface; `buildValidationRuleGroups`
 * below turns it into the ordered groups the skill renders.
 */
export interface ValidationRulesPkg {
  readonly TIMING_RULES: readonly LintRule[];
  readonly TRANSFORM_RULES: readonly LintRule[];
  readonly CONTENT_RULES: readonly LintRule[];
  readonly COMPOSITION_RULES: readonly LintRule[];
  readonly FONT_RULES: readonly LintRule[];
  readonly STACKING_RULES: readonly LintRule[];
  readonly CLIP_RULES: readonly LintRule[];
  readonly ALL_RULES: readonly LintRule[];
}

interface RuleGroup {
  readonly heading: string;
  readonly rules: readonly LintRule[];
}

export function buildValidationRuleGroups(pkg: ValidationRulesPkg): readonly RuleGroup[] {
  return [
    { heading: 'Timing & identifiers', rules: pkg.TIMING_RULES },
    { heading: 'Transform & layout', rules: pkg.TRANSFORM_RULES },
    { heading: 'Content-specific', rules: pkg.CONTENT_RULES },
    { heading: 'Composition', rules: pkg.COMPOSITION_RULES },
    { heading: 'Fonts', rules: pkg.FONT_RULES },
    { heading: 'Stacking', rules: pkg.STACKING_RULES },
    { heading: 'Clip resolution (context-dependent)', rules: pkg.CLIP_RULES },
  ];
}

/**
 * Frozen date stamp used in the generated skill's `last_updated`
 * frontmatter. Deliberately NOT derived from wall-clock so the
 * generator is deterministic — the drift gate catches missed
 * regenerations, so humans bump this by hand when the rule surface
 * actually changes.
 */
const LAST_UPDATED = '2026-04-23';

/** Escape a description for safe inclusion in a markdown table cell. */
function escapeCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

/**
 * Render the full auto-generated SKILL.md. Output is stable under
 * repeated runs: rules render in the order they appear in the
 * source arrays, which is the order the validation package declares
 * them. Any churn in the catalogue reflects a real surface change.
 */
export function generateValidationRulesSkill(pkg: ValidationRulesPkg): string {
  const groups = buildValidationRuleGroups(pkg);
  const totalRules = pkg.ALL_RULES.length;
  const categoryCount = groups.length;

  const frontmatter = [
    '---',
    'title: Reference — Validation Rules',
    'id: skills/stageflip/reference/validation-rules',
    'tier: reference',
    'status: auto-generated',
    `last_updated: ${LAST_UPDATED}`,
    'owner_task: T-107',
    'related:',
    '  - skills/stageflip/concepts/rir',
    '  - skills/stageflip/workflows/parity-testing',
    '---',
    '',
  ].join('\n');

  const intro = [
    '# Reference — Validation Rules',
    '',
    '**Auto-generated from `@stageflip/validation` rule metadata.** Do NOT',
    "edit by hand — run `pnpm skills-sync` after changing any rule's `id`,",
    '`severity`, or `description` in `packages/validation/src/rules/**`, and',
    '`pnpm skills-sync:check` will fail in CI if the committed file drifts.',
    '',
    `Currently ${totalRules} rules across ${categoryCount} categories.`,
    '',
    'The `@stageflip/validation` package ships the pre-render linter for',
    "`RIRDocument`. Rules catch problems that Zod can't express (timing",
    'windows vs composition duration, registry-dependent clip resolution)',
    "and quality issues that'd silently produce ugly output (empty text,",
    'off-canvas elements, missing font requirements).',
    '',
  ].join('\n');

  const quickStart = [
    '## Quick start',
    '',
    '```ts',
    "import { lintDocument } from '@stageflip/validation';",
    "import { findClip } from '@stageflip/runtimes-contract';",
    '',
    'const report = lintDocument(document, { context: { findClip } });',
    'if (!report.passed) {',
    "  for (const f of report.findings.filter((f) => f.severity === 'error')) {",
    '    console.error(`[${f.rule}] ${f.message}`);',
    '  }',
    '  process.exit(1);',
    '}',
    '```',
    '',
    '`LintReport.passed` is `true` iff `errorCount === 0`. Warnings and',
    'info findings are advisory and do NOT fail the report — operators',
    'can gate CI on error-only via `report.errorCount` or `report.passed`.',
    '',
  ].join('\n');

  const catalogue = renderCatalogue(groups);

  const customising = [
    '## Customising the rule set',
    '',
    'Consumers can run a subset via `opts.include` / `opts.exclude` (rule',
    'id allowlist / denylist) or substitute a custom `opts.rules` array:',
    '',
    '```ts',
    '// Run only errors and ignore the informational rules.',
    'lintDocument(doc, {',
    "  rules: ALL_RULES.filter((r) => r.severity === 'error'),",
    '});',
    '```',
    '',
    'Rule groups are exported separately (`TIMING_RULES`,',
    '`CONTENT_RULES`, etc.) so callers can compose without depending on',
    'the full catalogue.',
    '',
  ].join('\n');

  const autoFix = [
    '## Auto-fix (T-138)',
    '',
    'Rules marked ✓ in the **Auto-fix** column expose a `fix(document,',
    'findings)` method that returns a repaired document (or `null` when',
    "there's nothing to do). The `autoFixDocument` orchestrator runs up",
    'to 10 iterative passes (lint → fix-all-applicable-rules → re-lint),',
    'stopping when either no rule produces a change (`converged: true`)',
    'or the pass limit is reached (`hitMaxPasses: true`).',
    '',
    '```ts',
    "import { autoFixDocument } from '@stageflip/validation';",
    '',
    'const result = autoFixDocument(doc);',
    'console.log(`${result.passes.length} passes applied;`,',
    '            `${result.initialReport.findings.length} findings →',
    '            `${result.finalReport.findings.length}`);',
    'const repairedDoc = result.document;',
    '```',
    '',
    '`include` / `exclude` rule-id lists are honoured the same way',
    '`lintDocument` honours them; `maxPasses` defaults to 10 but can be',
    'overridden for pathological-rule drills.',
    '',
    '**When a fix is _not_ offered** — for rules like',
    '`text-color-is-valid-css` or `shape-custom-path-has-path`, there is',
    'no deterministic replacement that would preserve authorial intent.',
    'Those findings persist into `finalReport` for the operator to',
    'resolve manually. Auto-fix is opt-in — regular `lintDocument`',
    'never mutates.',
    '',
  ].join('\n');

  const lifecycle = [
    '## Lifecycle',
    '',
    '1. **Pre-render** — run `lintDocument` on every compiled RIR',
    '   document before it enters the export pipeline. Hard-fail on',
    '   error findings. Surface warnings and info to the operator.',
    '2. **Pre-parity** — the parity harness (T-100+) is more forgiving of',
    '   warnings; it only cares that the document renders at all. Run',
    '   the linter as a filter before investing in scoring.',
    '3. **Post-compiler** — the RIR compiler (T-030) emits valid',
    '   documents by construction, but regression risk remains. Treat',
    '   the linter as defense-in-depth on top of Zod.',
    '4. **Auto-fix pre-pass (optional)** — call `autoFixDocument` before',
    '   `lintDocument` when you want to normalise obvious issues',
    '   (rotation wrap-around, stacking-map gaps, missing font',
    '   requirements, http→https embeds) in one shot. The fixed',
    '   document is still linted and still subject to hard-fail on',
    '   error findings — auto-fix is not a gate bypass.',
    '',
  ].join('\n');

  const severityLegend = [
    '## Severity legend',
    '',
    '- **error** — fails the report; likely renders broken output.',
    '- **warn** — renders successfully but looks wrong or violates style.',
    '- **info** — valid but unusual; advisory.',
    '',
  ].join('\n');

  return [
    frontmatter,
    intro,
    severityLegend,
    quickStart,
    '## Rule catalogue',
    '',
    catalogue,
    customising,
    autoFix,
    lifecycle,
  ].join('\n');
}

function renderCatalogue(groups: readonly RuleGroup[]): string {
  const out: string[] = [];
  for (const group of groups) {
    out.push(`### ${group.heading}`);
    out.push('');
    if (group.rules.length === 0) {
      out.push('_No rules registered in this category._');
      out.push('');
      continue;
    }
    out.push('| Rule id | Severity | Auto-fix | What |');
    out.push('|---|---|---|---|');
    for (const rule of group.rules) {
      const autoFix = rule.fix !== undefined ? '✓' : '—';
      out.push(
        `| \`${escapeCell(rule.id)}\` | ${rule.severity} | ${autoFix} | ${escapeCell(rule.description)} |`,
      );
    }
    out.push('');
  }
  return out.join('\n');
}
