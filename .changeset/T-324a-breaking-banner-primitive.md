---
"@stageflip/runtimes-frame-runtime-bridge": patch
---

T-324a — add `breaking-banner` clip primitive (51st bridge clip; Cluster A `breakingBanner` clipKind).

Single primitive serves both CNN-style horizontal slide-in banners (`mode: 'banner'`, default) and Fox-style persistent narrow slivers (`mode: 'sliver'`) via `slideAxis: 'horizontal' | 'vertical'`. Sliver mode skips entrance per Fox's persistent register canon. Required props: `headline` + `label: { text, fill, color }`. Optional: `endCap`, `background` (theme `palette.background`), `headlineColor` (theme `palette.foreground`), `font`, `casing`. LIVE pulse, ticker strip, red-block-wipe text-change, Fox searchlight morph, return-from-commercial sequence all deferred to follow-up carve-outs (T-324b/c, T-327a/b).

Unblocks Cluster A presets T-324 (`cnn-breaking`) and T-327 (`fox-news-alert`).
