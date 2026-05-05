---
'@stageflip/parity-cli': patch
---

T-366 — wire `(caption, netflix-invisible) → netflixBinding` via
`PRESET_ID_BINDINGS` + export `NETFLIX_CANONICAL_WORDS` five-word snapshot.

Fifth Cluster F preset and FIRST Cluster F preset to render `muteOpacity: 0`
strict-accessibility active-only visibility (past / future visible words
render at zero opacity, completely invisible per T-316a's just-merged routing
fix) AND the FIRST Cluster F preset to use `backdrop: 'rect'` (translucent
black rectangle behind the active word's region; distinct from T-364's
`'pill'` per-word rounded-rect at 0.9 opacity). The `'netflix'` style differs
from T-362's `'hormozi'` clipKind-default along every axis (font Netflix Sans
+ Inter fallback vs Montserrat; weight 500 vs 800; size 56 vs 96; casing
as-is vs uppercase; **`muteOpacity: 0` vs 1**; strokeWidth 1 vs 6;
`backdrop: 'rect'` opacity 0.7 vs `'none'`; entrance none vs rise;
staggerMs 0 vs 80) and cannot share `captionBinding` — hence the
per-presetId override path established by T-360. Mirrors the
T-363 / T-364 / T-365 override pattern. The strictest active-word emphasis
in the cluster F register space.
