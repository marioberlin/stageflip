// packages/schema/src/presets/errors.ts
// Error types for the preset loader. Three classes cover the distinct failure
// modes the loader surfaces:
//   - PresetParseError    — gray-matter / YAML parse failure on a single file.
//   - PresetValidationError — Zod validation failure on a single file (shape).
//   - PresetRegistryLoadError — aggregated multi-file failure from
//     loadAllPresets, so a developer sees every malformed preset in one shot
//     rather than fixing them one ENOENT-style cycle at a time.
//
// File-not-found is intentionally NOT wrapped: the standard Node ENOENT error
// flows through unchanged so consumers can branch on `err.code === 'ENOENT'`.
// See docs/tasks/T-304.md §D-T304-6.

import type { ZodIssue } from 'zod';

/**
 * Thrown when a preset file's frontmatter fails Zod validation. Carries the
 * file path (so logs disambiguate amongst 50+ files) and the raw zodIssues
 * array so callers can render rich error UIs.
 */
export class PresetValidationError extends Error {
  readonly filePath: string;
  readonly field: string | undefined;
  readonly zodIssues: readonly ZodIssue[];

  constructor(filePath: string, zodIssues: readonly ZodIssue[], field?: string) {
    const issueSummary = zodIssues
      .map((i) => `${i.path.length > 0 ? i.path.join('.') : '<root>'}: ${i.message}`)
      .join('; ');
    super(`Preset validation failed for ${filePath}: ${issueSummary}`);
    this.name = 'PresetValidationError';
    this.filePath = filePath;
    this.field = field;
    this.zodIssues = zodIssues;
  }
}

/**
 * Thrown when the underlying YAML / gray-matter parser cannot read the file.
 * The original error is preserved on `cause` for stack tracing.
 */
export class PresetParseError extends Error {
  readonly filePath: string;
  override readonly cause: unknown;

  constructor(filePath: string, cause: unknown) {
    const causeMsg = cause instanceof Error ? cause.message : String(cause);
    super(`Preset parse failed for ${filePath}: ${causeMsg}`);
    this.name = 'PresetParseError';
    this.filePath = filePath;
    this.cause = cause;
  }
}

/** Per-file issue surfaced by the aggregating registry loader. */
export interface PresetRegistryLoadIssue {
  filePath: string;
  error: PresetValidationError | PresetParseError | Error;
}

/**
 * Thrown by `loadAllPresets` when one or more presets fail to parse or
 * validate. Aggregating issues (rather than fail-on-first) is a
 * developer-experience primitive — see T-304 AC #21.
 */
export class PresetRegistryLoadError extends Error {
  readonly issues: readonly PresetRegistryLoadIssue[];

  constructor(issues: readonly PresetRegistryLoadIssue[]) {
    const summary = issues.map((i) => `  - ${i.filePath}: ${i.error.message}`).join('\n');
    super(`PresetRegistry load failed with ${issues.length} issue(s):\n${summary}`);
    this.name = 'PresetRegistryLoadError';
    this.issues = issues;
  }
}
