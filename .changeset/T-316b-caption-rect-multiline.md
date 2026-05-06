---
"@stageflip/runtimes-frame-runtime-bridge": patch
---

T-316b — `caption.tsx` rect-backdrop is now multi-line aware.

Bug: when caption content's approximate `totalWidth` exceeded the container `position.width`, content flex-wrapped to 2+ lines but the SVG rect backdrop was sized for 1 line — active words on wrapped lines rendered below the rect. Discovered during product-owner ratification of `netflix-invisible` 2026-05-06 (5 words at 56px in a 1024px container wrap to 2 lines; active word `for` on line 2 rendered outside the rect band).

Fix: rect height now scales with `lineCount = ceil(totalWidth / containerWidth)`; rect width caps at `containerWidth` when wrapping. Two regression tests cover wrapped vs single-line content. Backdrop modes `'pill'` and `'none'` unchanged.

Unblocks netflix-invisible re-signing → Cluster F closes to 6/6 ELIGIBLE.
