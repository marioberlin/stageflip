// packages/export-html5-zip/src/validate/types.ts
// T-208 — IAB / GDN compliance validator for produced banner ZIPs.
// Runs independently of the T-203b budget check: that check runs against
// the per-document `DisplayBudget.totalZipKb`; these rules run against
// the canonical IAB + GDN caps and structural requirements.

/** One unzipped file inside a banner ZIP. */
export interface ZipEntry {
  readonly path: string;
  readonly bytes: Uint8Array;
}

/** Inputs the validator hands to every rule. */
export interface ValidationContext {
  /** Every file in the ZIP, keyed by path. */
  readonly entries: ReadonlyMap<string, ZipEntry>;
  /** Total ZIP size in bytes (the archive itself, not the sum of entries). */
  readonly zipByteLength: number;
  /** Human-readable label for this banner (typically "300x250" or a `BannerSize.id`). */
  readonly label: string;
}

export type ValidationSeverity = 'error' | 'warn' | 'info';

export interface ValidationFinding {
  readonly rule: string;
  readonly severity: ValidationSeverity;
  readonly message: string;
  /** Relative path of the file the finding applies to, if any. */
  readonly file?: string;
}

/**
 * One validator rule. `id` is stable — used by tests + findings + skip
 * lists. `description` surfaces in the CI output. `run` returns
 * findings or an empty array when the rule passes.
 */
export interface ValidationRule {
  readonly id: string;
  readonly severity: ValidationSeverity;
  readonly description: string;
  run(ctx: ValidationContext): readonly ValidationFinding[];
}

export interface ValidationReport {
  readonly findings: readonly ValidationFinding[];
  readonly errorCount: number;
  readonly warnCount: number;
  readonly infoCount: number;
  /** True when `errorCount === 0`. Warnings and info never fail the report. */
  readonly passed: boolean;
}
