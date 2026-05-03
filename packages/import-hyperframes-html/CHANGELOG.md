# @stageflip/import-hyperframes-html

## 0.1.0

### Minor Changes

- 28c8d35: T-247: Bidirectional Hyperframes HTML ↔ canonical Document (video mode).

  `parseHyperframes(masterHtml, { fetchCompositionSrc })` walks a Hyperframes
  producer-style master HTML + sibling composition files into a canonical
  `Document` with `content.mode === 'video'`. `exportHyperframes(doc)` walks
  the inverse, producing master HTML + per-composition files in either
  `'multi-file'` (default) or `'inlined'` mode.

  Track-kind heuristics (caption-name first, main+index0 → visual,
  audio-only → audio, otherwise overlay) are documented in the workflow
  skill so future producers can target the contract deterministically.

  Six loss-flag codes (`LF-HYPERFRAMES-HTML-*`) cover the v1 OOS surfaces:
  class-style typography, GSAP animations, unrecognized transcripts,
  unsupported tags, missing dimensions, and unresolved asset bytes. The
  package's `emitLossFlag` wrapper auto-fills `source: 'hyperframes-html'`
  matching PPTX/GSLIDES precedent.

  Round-trip suite (six fixtures: simple-deck, multi-track, class-styled,
  animation-script, transcript-recognized, transcript-unrecognized) pins the
  parse → export → re-parse equality predicate, with class-style losses
  recurring as a multiset.

  Fresh-write per CLAUDE.md §7 — does NOT import or share code with the
  vendored Hyperframes engine at `packages/renderer-cdp/vendor/`.

### Patch Changes

- Updated dependencies [3280984]
- Updated dependencies [2f0ae52]
- Updated dependencies [6cfbb4c]
- Updated dependencies [6474d98]
- Updated dependencies [a36fcbe]
- Updated dependencies [8ddef40]
- Updated dependencies [e054d6d]
- Updated dependencies [4fe6fda]
- Updated dependencies [12a98d3]
- Updated dependencies [ca945df]
- Updated dependencies [5af6789]
- Updated dependencies [22d44d6]
- Updated dependencies [b6d2229]
- Updated dependencies [a4bb803]
- Updated dependencies [bbcbd38]
- Updated dependencies [d393eff]
- Updated dependencies [3112c98]
- Updated dependencies [e422e50]
- Updated dependencies [7c0165c]
- Updated dependencies [732f6c7]
- Updated dependencies [36d0c5d]
- Updated dependencies [38e4017]
  - @stageflip/loss-flags@0.1.0
  - @stageflip/schema@0.1.0
