---
"@stageflip/import-hyperframes-html": minor
---

T-247: Bidirectional Hyperframes HTML ↔ canonical Document (video mode).

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
