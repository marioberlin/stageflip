---
'@stageflip/runtimes-frame-runtime-bridge': patch
---

T-321 — `titleSequence` runtime-clip primitive.

Multi-shot prestige-TV title compositor with four sealed style bundles
(`'letterform-assemble'` / `'plate-and-credits'` / `'palette-jump-cut'` /
`'photographic-overlay'`), five shot kinds (`titlePlate` /
`letterAnimation` / `creditsBlock` / `colorPanel` / `holdFrame`), three
transition kinds (`'cut'` / `'fade'` / `'dissolve'`) with single-active
+ 1-shot overlap during fade / dissolve. Frame-deterministic shot
dispatch; per-letter staggered entry; viewport-fill ALL-CAPS
letterforms via `letterformScale`. Stable shot-id-derived
clipPath / filter / per-letter IDs. Optional `glow?` halo on the
active shot. Casing transforms at render time. Theme-slot fallback.
Bridge clip count 49 → 50. Unblocks Cluster D presets T-348..T-353.
