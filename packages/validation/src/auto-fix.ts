// packages/validation/src/auto-fix.ts
// T-138 — iterative auto-fix orchestrator. Builds on T-104's
// `LintRule` + `LintFinding` surface: each rule MAY declare an
// optional `fix(document, findings)` method that returns a new
// document (fix applied) or `null` (nothing to fix this pass).
//
// One "pass" is: lint → fix-all-applicable-rules → re-lint.
// The loop stops when either:
//   - no rule produced a change this pass (converged), OR
//   - `maxPasses` iterations have run (hitMaxPasses).
//
// maxPasses defaults to 10 per the plan row. Beyond 10, a rule that
// keeps producing findings without stabilising is almost certainly
// misbehaving, and the orchestrator surfaces that via
// `hitMaxPasses: true` rather than spinning forever.

import type { RIRDocument } from '@stageflip/rir';

import { ALL_RULES } from './rules/index.js';
import { lintDocument } from './runner.js';
import type { LintFinding, LintReport, LintRule } from './types.js';

/** Options for the auto-fix orchestrator. Extends the basic lint options. */
export interface AutoFixOptions {
  /** Rule set to consider. Defaults to every rule in `ALL_RULES`. */
  readonly rules?: readonly LintRule[];
  /** Only apply fixes from rules whose id matches one of these. */
  readonly include?: readonly string[];
  /** Skip fixes from rules whose id matches one of these. */
  readonly exclude?: readonly string[];
  /** Maximum number of iterative passes. Defaults to 10. */
  readonly maxPasses?: number;
}

/** Summary of one pass through the fix loop. */
export interface AutoFixPassOutcome {
  /** 1-indexed pass number. */
  readonly passNumber: number;
  /** Rule ids whose `fix` produced a non-null document this pass. */
  readonly rulesApplied: readonly string[];
  /** Lint findings count at the start of this pass (before any fix ran). */
  readonly findingsBefore: number;
  /** Lint findings count at the end of this pass (after fixes re-linted). */
  readonly findingsAfter: number;
}

/** Result of `autoFixDocument`. */
export interface AutoFixResult {
  /** Final document after all passes. Equals input if no fix ever applied. */
  readonly document: RIRDocument;
  readonly passes: readonly AutoFixPassOutcome[];
  /** Lint report on the input document (before any fix). */
  readonly initialReport: LintReport;
  /** Lint report on the final document (after the last pass). */
  readonly finalReport: LintReport;
  /** True when the loop terminated with no rule applying a change. */
  readonly converged: boolean;
  /** True when the loop terminated because it hit `maxPasses`. */
  readonly hitMaxPasses: boolean;
}

const DEFAULT_MAX_PASSES = 10;

/**
 * Iteratively apply rule-provided fixes to `document` until no more fixes
 * are produced or `maxPasses` is reached.
 *
 * Rules without a `fix` method never participate — their findings simply
 * carry through to the final report untouched.
 *
 * Rules' `fix` methods MUST return a non-null document only when they've
 * actually changed something; returning a fresh-but-equivalent clone every
 * call would cause the loop to spin to `maxPasses`. In practice, the rules
 * that ship check the condition inside `fix` and return `null` when
 * there's nothing actionable.
 */
export function autoFixDocument(document: RIRDocument, opts?: AutoFixOptions): AutoFixResult {
  const ruleSet = opts?.rules ?? ALL_RULES;
  const include = opts?.include ? new Set(opts.include) : null;
  const exclude = opts?.exclude ? new Set(opts.exclude) : null;
  const maxPasses = opts?.maxPasses ?? DEFAULT_MAX_PASSES;

  const initialReport = lintDocument(document, { rules: ruleSet });
  const passes: AutoFixPassOutcome[] = [];
  let currentDoc = document;
  let currentReport = initialReport;
  let converged = false;
  let hitMaxPasses = false;

  for (let passNumber = 1; passNumber <= maxPasses; passNumber++) {
    const findingsBefore = currentReport.findings.length;
    const findingsByRule = groupFindingsByRule(currentReport.findings);
    const rulesApplied: string[] = [];
    let docThisPass = currentDoc;

    for (const rule of ruleSet) {
      if (rule.fix === undefined) continue;
      if (include && !include.has(rule.id)) continue;
      if (exclude?.has(rule.id)) continue;
      const findings = findingsByRule.get(rule.id);
      if (!findings || findings.length === 0) continue;
      const next = rule.fix(docThisPass, findings);
      if (next !== null && next !== docThisPass) {
        docThisPass = next;
        rulesApplied.push(rule.id);
      }
    }

    if (rulesApplied.length === 0) {
      // No rule wanted to change anything this pass. Stable.
      // By convention `passes` only contains passes that did work, so
      // we break without recording anything.
      converged = true;
      break;
    }

    currentDoc = docThisPass;
    currentReport = lintDocument(currentDoc, { rules: ruleSet });
    passes.push({
      passNumber,
      rulesApplied,
      findingsBefore,
      findingsAfter: currentReport.findings.length,
    });

    if (passNumber === maxPasses) {
      hitMaxPasses = true;
    }
  }

  return {
    document: currentDoc,
    passes,
    initialReport,
    finalReport: currentReport,
    converged,
    hitMaxPasses,
  };
}

function groupFindingsByRule(findings: readonly LintFinding[]): Map<string, LintFinding[]> {
  const by = new Map<string, LintFinding[]>();
  for (const f of findings) {
    const existing = by.get(f.rule);
    if (existing) existing.push(f);
    else by.set(f.rule, [f]);
  }
  return by;
}
