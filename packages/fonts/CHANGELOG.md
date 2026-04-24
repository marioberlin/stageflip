# @stageflip/fonts

## 0.1.0

### Minor Changes

- 019f79c: FontManager runtime (T-072) — editor-side half. CDP pre-embedding
  stays with Phase 4 (T-084a).

  `@stageflip/runtimes-contract` — `FontRequirement` extended with two
  optional fields matching the workspace fonts concept:

  - `subsets?: readonly string[]` — Unicode subsets (`'latin'`,
    `'cyrillic'`, etc.).
  - `features?: readonly string[]` — OpenType features (`'ss01'`,
    `'tnum'`, etc.).

  Non-breaking — both optional.

  `@stageflip/fonts` — new package:

  - `aggregateFontRequirements(iterable)` — canonical dedup + sort.
    Dedup key is (family (case-insensitive), weight, style); merged
    requirements union their `subsets` / `features`.
  - `formatFontShorthand(req, px?)` — CSS shorthand suitable for
    `document.fonts.check` and `document.fonts.load`.
  - `useFontLoad(requirements, options?)` — React hook returning
    `{ status: 'idle' | 'loading' | 'ready' | 'error', error, loaded }`.
    Blocks consumer render on font readiness; the CDP export path
    handles its own base64 embedding + `document.fonts.check` gate in
    Phase 4.
  - `fontFaceSet` option is the test seam; every test injects a fake.
  - Structural dep key on the `requirements` array so callers passing
    inline literals don't trigger re-render loops.

### Patch Changes

- Updated dependencies [019f79c]
- Updated dependencies [785b44c]
- Updated dependencies [753b22a]
- Updated dependencies [49d4533]
- Updated dependencies [36d0c5d]
  - @stageflip/runtimes-contract@0.1.0
