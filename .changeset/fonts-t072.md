---
"@stageflip/fonts": minor
"@stageflip/runtimes-contract": minor
---

FontManager runtime (T-072) — editor-side half. CDP pre-embedding
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
