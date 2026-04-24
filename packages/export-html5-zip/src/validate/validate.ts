// packages/export-html5-zip/src/validate/validate.ts
// T-208 — IAB / GDN validator entry point. Unzips a banner ZIP, builds
// a `ValidationContext`, runs the rule set, and collates findings.

import { unzipSync } from 'fflate';

import { ALL_VALIDATION_RULES } from './rules.js';
import type {
  ValidationContext,
  ValidationFinding,
  ValidationReport,
  ValidationRule,
  ZipEntry,
} from './types.js';

export interface ValidateBannerZipOptions {
  /** Identifier for this banner in findings (e.g. "300x250"). Defaults to "banner". */
  readonly label?: string;
  /**
   * Rule set to run. Defaults to every rule in `ALL_VALIDATION_RULES`.
   * Passing a subset is useful for unit-testing a single rule.
   */
  readonly rules?: readonly ValidationRule[];
}

/** Validate a banner ZIP against IAB / GDN compliance rules. */
export function validateBannerZip(
  zipBytes: Uint8Array,
  opts: ValidateBannerZipOptions = {},
): ValidationReport {
  const entries = new Map<string, ZipEntry>();
  const unzipped = unzipSync(zipBytes);
  for (const [path, bytes] of Object.entries(unzipped)) {
    entries.set(path, { path, bytes });
  }
  const ctx: ValidationContext = {
    entries,
    zipByteLength: zipBytes.length,
    label: opts.label ?? 'banner',
  };
  return runValidationRules(ctx, opts.rules ?? ALL_VALIDATION_RULES);
}

/**
 * Run a pre-built `ValidationContext` through a rule set. Useful when
 * the caller already has the unzipped entries in memory (the export
 * orchestrator can feed its own output in directly without
 * round-tripping through `unzipSync`).
 */
export function runValidationRules(
  ctx: ValidationContext,
  rules: readonly ValidationRule[] = ALL_VALIDATION_RULES,
): ValidationReport {
  const findings: ValidationFinding[] = [];
  for (const rule of rules) {
    for (const f of rule.run(ctx)) findings.push(f);
  }
  let errorCount = 0;
  let warnCount = 0;
  let infoCount = 0;
  for (const f of findings) {
    if (f.severity === 'error') errorCount += 1;
    else if (f.severity === 'warn') warnCount += 1;
    else infoCount += 1;
  }
  return {
    findings,
    errorCount,
    warnCount,
    infoCount,
    passed: errorCount === 0,
  };
}
