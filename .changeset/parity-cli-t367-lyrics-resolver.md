---
'@stageflip/parity-cli': patch
---

T-367 — wire `lyrics → lyrics` clipKind-default for
`karaoke-progressive-wipe` (first and only `lyrics`-clipKind preset).

Adds the exported `KARAOKE_PROGRESSIVE_WIPE_CANONICAL_LINES` snapshot
(three anthemic lines × 2500 ms each = 7500 ms total; line 2 active at
40% wipe progress at frame 105) and the new `lyricsBinding`
`ClipKindBinding` (style `'karaoke-wipe'`, `maxLinesVisible: 3`,
`casing: 'uppercase'`, `glow: { color: '#FFFFFF', blur: 6 }`,
center-screen position, dark-canvas documentation backdrop).
`DEFAULT_CLIP_KIND_RESOLVER` gains a `lyrics → lyricsBinding` arm;
mirrors T-362 hormozi's first-preset-for-clipKind precedent (first
preset for a clipKind takes the clipKind-default slot — NOT a
`PRESET_ID_BINDINGS` override). No change to existing T-358 / T-359 /
T-356 / T-357 / T-355 / T-360 / T-362–T-366 bindings.

Closes Cluster F to 6/6 — eligible for T-381 batch merge.
