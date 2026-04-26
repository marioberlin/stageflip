// packages/loss-flags/src/types.ts
// Canonical LossFlag shape + severity / category / source vocabulary shared
// across every importer (PPTX, Google Slides, Hyperframes HTML, …) and every
// consumer (editor reporter UI, export-loss-flags manifest). Per
// `skills/stageflip/concepts/loss-flags/SKILL.md`. `code` and `source` are
// `string` (open) so each importer owns its own enum locally — adding a new
// importer never touches this file.

/**
 * Per-importer source identifier. Typed as `string` (not a closed union) for
 * the same reason `code` is a string: each importer owns its source name
 * locally; new importers don't touch the shared package. Convention is to use
 * the importer package's suffix:
 *   - `'pptx'`             from `@stageflip/import-pptx`
 *   - `'gslides'`          from `@stageflip/import-google-slides`
 *   - `'hyperframes-html'` from `@stageflip/import-hyperframes-html`
 * The Reporter UI (T-248) renders any `source` string; type-safe enums are an
 * importer-local concern.
 */
export type LossFlagSource = string;

/** Severity bands per the loss-flags concept skill. */
export type LossFlagSeverity = 'info' | 'warn' | 'error';

/** Categories per the loss-flags concept skill. */
export type LossFlagCategory =
  | 'shape'
  | 'animation'
  | 'font'
  | 'media'
  | 'theme'
  | 'script'
  | 'other';

/**
 * Canonical loss-flag record. `code` is typed as `string` so each importer's
 * `LF-<SRC>-<DESCRIPTOR>` enum can flow through without forcing every new
 * importer to amend a shared union. Importers narrow with their own union
 * type (e.g. `type PptxLossFlag = LossFlag & { code: PptxLossFlagCode }`).
 */
export interface LossFlag {
  /** sha256(source + category + location + originalSnippet).slice(0, 12). */
  id: string;
  source: LossFlagSource;
  code: string;
  severity: LossFlagSeverity;
  category: LossFlagCategory;
  location: {
    slideId?: string;
    elementId?: string;
    /** OPC part / source-document path the flag was raised from. */
    oocxmlPath?: string;
  };
  message: string;
  recovery?: string;
  originalSnippet?: string;
}
