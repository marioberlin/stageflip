// packages/validation/src/runner.ts
// Aggregator: runs every registered rule against an RIRDocument and
// buckets the findings by severity. The runner itself is thin —
// almost all behaviour lives in the rules. Callers tune the rule set
// via `opts.rules` (defaults to `ALL_RULES`) or filter findings
// via `opts.include` / `opts.exclude` rule-id lists.

import type { RIRDocument } from '@stageflip/rir';

import { ALL_RULES } from './rules/index.js';
import type { LintContext, LintFinding, LintReport, LintRule } from './types.js';

export interface LintOptions {
  /** Rule set to run. Defaults to every rule in `ALL_RULES`. */
  readonly rules?: readonly LintRule[];
  /** Runtime registry + other callbacks. See `LintContext`. */
  readonly context?: LintContext;
  /** Only run rules whose id matches one of these. Applied after `rules`. */
  readonly include?: readonly string[];
  /** Skip rules whose id matches one of these. Applied after `include`. */
  readonly exclude?: readonly string[];
}

/**
 * Run every applicable rule against `document` and return an
 * aggregated `LintReport`. Rules never throw — a misbehaving rule
 * that throws is caught, and a synthetic `error` finding is emitted
 * so the batch keeps moving.
 */
export function lintDocument(document: RIRDocument, opts?: LintOptions): LintReport {
  const ruleSet = opts?.rules ?? ALL_RULES;
  const include = opts?.include ? new Set(opts.include) : null;
  const exclude = opts?.exclude ? new Set(opts.exclude) : null;
  const context: LintContext = opts?.context ?? {};

  const findings: LintFinding[] = [];
  for (const rule of ruleSet) {
    if (include && !include.has(rule.id)) continue;
    if (exclude?.has(rule.id)) continue;
    try {
      const out = rule.run(document, context);
      for (const finding of out) findings.push(finding);
    } catch (err) {
      findings.push({
        rule: rule.id,
        severity: 'error',
        message: `rule threw: ${(err as Error).message}`,
      });
    }
  }

  let errorCount = 0;
  let warnCount = 0;
  let infoCount = 0;
  for (const f of findings) {
    if (f.severity === 'error') errorCount++;
    else if (f.severity === 'warn') warnCount++;
    else infoCount++;
  }
  return {
    findings,
    errorCount,
    warnCount,
    infoCount,
    passed: errorCount === 0,
  };
}
