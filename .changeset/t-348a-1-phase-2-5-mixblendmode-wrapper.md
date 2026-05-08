---
'@stageflip/runtimes-contract': minor
'@stageflip/runtimes-frame-runtime-bridge': patch
'@stageflip/cdp-host-bundle': patch
---

T-348a.1 — Phase 2.5 of Cluster D regression remediation: hoist `mix-blend-mode` from primitive SVG to host wrapper.

Phase 2 (T-348a / PR #445) shipped `mix-blend-mode: multiply` inline on
photographic-overlay's SVG and passed all unit tests + CI gates. Phase 3
re-regeneration revealed it didn't actually solve the regression: each
`RIRElement` per-element wrapper has `position: absolute` + `z-index`,
forming its own stacking context, which isolates an inline mix-blend-mode
from sibling elements. The blend's backdrop becomes the (empty) per-element
wrapper, NOT the Composition root's prior z-order siblings — so the
photographic-overlay's tinted-white rect still fully covers the title
sequence below.

Fix: add `ClipDefinition.mixBlendMode?: string` (with strict-CSS-typed
`Property.MixBlendMode` cast at the boundary) and have the host renderer
(`composition.tsx` ElementNode) read it at element-mount time, applying
the value on the OUTER wrapper. The wrapper participates in the Composition
root's stacking context, so `mix-blend-mode` declared there correctly
composites against prior z-order siblings (the multi-clip-composition
contract). photographic-overlay declares `mixBlendMode: 'multiply'` on its
clip definition and removes the redundant inline style from its SVG.

Pixel-level verified end-to-end against all 5 affected Cluster D presets
(stranger-things-benguiat / true-detective-double-exposure /
succession-home-video / severance-surreal-3d / got-trajan-clockwork) —
each now renders the canonical title content with appropriate
photographic-overlay tonal blending. Cluster D restored to 6/6 ELIGIBLE.

This is also the F-30 process lesson made concrete: Phase 2's unit tests
verified the wiring; Phase 3's pixel-level verification revealed the wiring
didn't compose at the renderer level. CLAUDE.md §13 (introduced in PR #447)
codifies the rule for future structural extensions.

`@stageflip/runtimes-contract` is a `minor` bump because it adds a new
optional field to the public `ClipDefinition` interface; existing clip
definitions without `mixBlendMode` continue to work unchanged.
