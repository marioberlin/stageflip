---
'@stageflip/parity-cli': patch
---

T-365 — wire `(caption, ali-abdaal-opacity-karaoke) → aliAbdaalBinding` via
`PRESET_ID_BINDINGS` + export `ALI_ABDAAL_CANONICAL_WORDS` eight-word snapshot.

Fourth Cluster F preset and FIRST Cluster F preset to render `entrance:
'none'` AND opacity-only active-word emphasis (`muteColor === highlightColor
=== foreground` with `muteOpacity: 0.6`). The `'ali-abdaal'` style differs
from T-362's `'hormozi'` clipKind-default along every axis (font Inter vs
Montserrat; casing as-is vs uppercase; foreground `#1F1F1F` on white vs
white on dark; opacity-based mute vs no-mute; strokeWidth 0 vs 6; entrance
none vs rise; staggerMs 0 vs 80) and cannot share `captionBinding` —
hence the per-presetId override path established by T-360. Mirrors the
T-363 / T-364 override pattern.
