// packages/validation/src/types.ts
// Core types for the pre-render RIR linter. Every rule is a pure
// function that walks a `RIRDocument` and emits zero or more
// `LintFinding`s. The runner aggregates findings across all
// registered rules and returns a `LintReport` with severity-bucketed
// counts.
//
// `LintContext` carries callbacks the rules need to resolve
// workspace-level state (clip registry lookup, font registry, etc.).
// It defaults to a minimal "nothing registered" stub so rules that
// need registry access degrade gracefully — they emit `info`
// findings instead of `error` when the lookup is unavailable.

import type { RIRDocument } from '@stageflip/rir';
import type { ClipDefinition, ClipRuntime } from '@stageflip/runtimes-contract';

/** Severity classifies how a finding should gate CI / be surfaced. */
export type LintSeverity = 'error' | 'warn' | 'info';

/**
 * A single lint observation. `rule` is the stable id of the rule
 * that emitted it (matches its `LintRule.id`), `message` is
 * human-readable. Optional location fields narrow the finding to a
 * specific element / animation / etc.
 */
export interface LintFinding {
  readonly rule: string;
  readonly severity: LintSeverity;
  readonly message: string;
  /** RIR element id the finding points at, if any. */
  readonly elementId?: string;
  /** Dot-delimited path into the document, e.g. `elements[0].content.fill`. */
  readonly path?: string;
}

/**
 * Optional context passed to every rule. Missing callbacks surface
 * as `undefined` — rules must handle that case gracefully.
 */
export interface LintContext {
  /**
   * Resolve a clip kind against the runtime registry. Returns the
   * runtime + clip pair, or `null` when no runtime claims the kind.
   * Defaults to `null` (treat every clip as unresolvable).
   */
  readonly findClip?: (
    kind: string,
  ) => { runtime: ClipRuntime; clip: ClipDefinition<unknown> } | null;
}

/**
 * A single lint rule. The runner invokes `run` once per document
 * (not per element) — rules that operate per-element iterate
 * internally. `severity` is the default severity for the rule's
 * findings; individual findings MAY override via their own field
 * (e.g. a rule that's usually `warn` but escalates to `error` on a
 * specific sub-condition).
 */
export interface LintRule {
  readonly id: string;
  readonly severity: LintSeverity;
  readonly description: string;
  run(document: RIRDocument, context: LintContext): readonly LintFinding[];
}

/**
 * Aggregate report. `passed` is `true` when `errorCount === 0`;
 * warnings and info findings are advisory and do NOT fail the report.
 */
export interface LintReport {
  readonly findings: readonly LintFinding[];
  readonly errorCount: number;
  readonly warnCount: number;
  readonly infoCount: number;
  readonly passed: boolean;
}
