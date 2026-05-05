---
'@stageflip/parity-cli': patch
---

T-363 — wire `(caption, mrbeast-komika-axis) → mrbeastBinding` via
`PRESET_ID_BINDINGS` + export `MRBEAST_CANONICAL_WORDS` six-word snapshot.

Second Cluster F preset and FIRST Cluster F preset to use the per-presetId
override mechanism (T-360 D-T360-2). The `'mrbeast'` style + cycling-color
`WordTiming[]` snapshot can't share T-362's `'hormozi'` clipKind-default
binding's `buildProps`; T-363 adds a `PRESET_ID_BINDINGS['mrbeast-komika-axis']`
entry instead of touching the default. Sister Cluster F presets (T-364
tiktok / T-365 ali-abdaal / T-366 netflix / T-367 karaoke-progressive-wipe)
follow the same per-presetId override pattern T-363 establishes.

`MRBEAST_CANONICAL_WORDS`: six entries (350 ms each, total 2100 ms) —
`I gave away one million dollars`. Words 2 / 4 / 6 carry
`emphasis: 'highlight'`; the primitive's rolling `highlightedIndex % 3`
routes them through the `'mrbeast'` bundle's 3-color cycle (`#FF3B30` red →
`#FFD60A` yellow → `#34C759` green). Frame 60 @ 30 fps lands word 6
(`dollars`) as the active highlight per the primitive's strict
`currentTimeMs >= startMs && currentTimeMs < endMs` rule. The `'mrbeast'`
STYLE_BUNDLES bundle on the primitive (T-316 D-T316-2) supplies the
Komika Axis 108 caps + black stroke (5 px) + `bounce` entrance with 80 ms
stagger defaults; `buildProps` declares only `words`, `style`, `position`,
and a documentation-only `background`.

T-362's clipKind-default `caption → caption` is unchanged: `('caption',
'hormozi-montserrat-black')` and `('caption')` (no presetId) continue to
fall through to T-362's `captionBinding`.
