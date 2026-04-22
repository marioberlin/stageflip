// packages/import-slidemotion-legacy/src/warnings.ts
// Structured import-warning shape + a small accumulator.

/**
 * A `Warning` marks one place where the legacy-to-canonical mapping was
 * lossy. Importers call `accumulate(warning)` in every mapper and the final
 * `ImportResult` returns the full list. Callers (editor import flow, CLI)
 * present the list however they like; this package stays UI-free.
 *
 * The `reason` code is a narrow enum so UIs can group or filter without
 * regex-matching the human-readable `detail`.
 */

export type WarningReason =
  | 'unsupported-element-type'
  | 'unsupported-shape-kind'
  | 'unsupported-background-kind'
  | 'unsupported-duration-form'
  | 'invalid-asset-reference'
  | 'invalid-color'
  | 'invalid-timestamp'
  | 'sanitized-id'
  | 'dropped-field';

export interface Warning {
  /** JSON-pointer-ish path into the legacy document. */
  path: string;
  reason: WarningReason;
  /** Optional free-form detail for the specific case. Kept short. */
  detail?: string;
}

export class WarningSink {
  readonly warnings: Warning[] = [];

  add(path: string, reason: WarningReason, detail?: string): void {
    const entry: Warning = detail === undefined ? { path, reason } : { path, reason, detail };
    this.warnings.push(entry);
  }
}
