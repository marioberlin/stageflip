---
'@stageflip/parity-cli': patch
---

T-362 — wire `caption → caption` clipKind binding + export
`HORMOZI_CANONICAL_WORDS` six-word snapshot.

First Cluster F preset (`hormozi-montserrat-black`) and first preset to
exercise T-316's `CaptionClip` primitive end-to-end. The resolver entry is a
clipKind-default (matches T-358 / T-356 / T-357 posture) — sister Cluster F
presets (T-363+ mrbeast / tiktok / ali-abdaal / netflix /
karaoke-progressive-wipe) layer per-preset overrides via `PRESET_ID_BINDINGS`
to swap the `style` enum + word snapshot.

`HORMOZI_CANONICAL_WORDS`: six entries (300 ms each, total 1800 ms) —
`This will change your life forever`. Frame 45 @ 30 fps lands word 6
(`forever`) as the active highlight per the primitive's strict
`currentTimeMs >= startMs && currentTimeMs < endMs` rule. The `'hormozi'`
STYLE_BUNDLES bundle on the primitive (T-316 D-T316-2) supplies the
Montserrat 800 caps + black stroke (6 px) + yellow `#FFD60A` highlight +
`rise` entrance with 80 ms stagger defaults; `buildProps` declares only
`words`, `style`, `position`, and a documentation-only `background`.
