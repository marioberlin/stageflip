# @stageflip/loss-flags

## 0.1.0

### Minor Changes

- 3280984: Extract `LossFlag` from `@stageflip/import-pptx` into a new
  `@stageflip/loss-flags` package (T-247-loss-flags).

  **New package `@stageflip/loss-flags`**:
  - `LossFlag` interface — canonical record shape per
    `skills/stageflip/concepts/loss-flags/SKILL.md`. `code` and `source`
    typed as `string` so each importer extends with its own
    `LF-<SRC>-*` enum locally; new importers never touch this package.
  - `LossFlagSeverity` (`'info' | 'warn' | 'error'`) and `LossFlagCategory`
    (`'shape' | 'animation' | 'font' | 'media' | 'theme' | 'script' |
'other'`) — closed unions per the concept skill.
  - `LossFlagSource` — `string` alias documenting the per-importer source
    identifier convention.
  - `emitLossFlag(input)` — pure deterministic-id emitter. Hashes
    `source + code + slideId + elementId + oocxmlPath + originalSnippet`
    with sha256 (12-hex slice). Same input → same id across runs.
  - `EmitLossFlagInput` — input shape for the generic emitter.

  **Why**: T-248 (loss-flag reporter UI) and sibling importers (T-244
  Google Slides, T-247 Hyperframes HTML) need to share one shape /
  vocabulary / id-hashing scheme without depending on
  `@stageflip/import-pptx`. Editor-shell depending on importers is the
  wrong direction.

  **`@stageflip/import-pptx` changes** (zero behaviour change):
  - `LossFlag`, `LossFlagSeverity`, `LossFlagCategory`, `LossFlagSource`
    re-exported from `@stageflip/loss-flags` under the same names —
    every existing consumer import continues to compile and link.
  - `LossFlagCode` stays PPTX-local (PPTX-specific union).
  - `emitLossFlag` is now a thin wrapper: looks up the per-code default
    severity / category, auto-fills `source: 'pptx'`, and delegates to
    `@stageflip/loss-flags`'s generic `emitLossFlag`. Byte-identical
    output to the pre-extraction implementation (8 fixtures pinned).
