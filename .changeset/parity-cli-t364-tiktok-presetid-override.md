---
'@stageflip/parity-cli': patch
---

T-364 — wire `(caption, tiktok-rounded-box) → tiktokBinding` via
`PRESET_ID_BINDINGS` + export `TIKTOK_CANONICAL_WORDS` five-word snapshot.

Third Cluster F preset and FIRST Cluster F preset to render
`backdrop: 'pill'` AND the `'slide-from-bottom'` entrance branch. The
`'tiktok'` style differs from T-362's `'hormozi'` clipKind-default along
multiple axes (`backdrop: 'pill'` vs `'none'`; `casing: 'as-is'` vs
`'uppercase'`; `strokeWidth: 0` vs `6`; `entrance: 'slide-from-bottom'` vs
`'rise'`) and cannot share T-362's `captionBinding`; T-364 mirrors T-363's
`PRESET_ID_BINDINGS` override pattern.

`TIKTOK_CANONICAL_WORDS`: five entries (400 ms each, total 2000 ms) —
`Wait until you see this`. No `emphasis` field on any word — TikTok bundle's
`highlightColor` equals `foreground`, so the per-word pill IS the visual
emphasis (not a per-word color shift). Frame 45 @ 30 fps lands word 4
(`'see'`, 1200..1600) as the active word and word 5 (`'this'`, 1600..2000)
as mid-slide-from-bottom — the parity golden captures the entrance IN MOTION
(the preset's named feature) rather than a fully-settled state.

T-362's clipKind-default `caption → caption` (Hormozi) and T-363's
`mrbeast-komika-axis` override are unchanged; backward-compat tests guard
the resolver fall-through.
