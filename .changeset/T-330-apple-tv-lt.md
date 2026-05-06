---
'@stageflip/parity-cli': patch
---

T-330 — `apple-tv-lt` preset substantive (Cluster A fourth; fourth
`lowerThird` clipKind binding via `PRESET_ID_BINDINGS` override).

Adds `appleTvLtBinding` to `PRESET_ID_BINDINGS` keyed on `'apple-tv-lt'`
(Pattern C — fourth-preset-for-clipKind via the per-presetId override
map; the `lowerThird` clipKind-default `cnnClassicBinding` from T-323
stays unchanged; T-325's `bbcReithDarkBinding` and T-326's
`alJazeeraOrangeBinding` overrides stay unchanged). Exports the new
`APPLE_TV_LT_PROPS` constant: a ten-field snapshot driving the canonical
Apple TV+ steady-state lower-third register on the `LowerThird`
primitive (T-183 + T-183z) — text-only minimalist register with
`noFlag: true` (T-183z; suppresses the 6 px accent strip),
`background: '#000000'` (canvas-matching black; card visually
disappears), Mixed-Case white headline (`name: 'Sofia Coppola'`,
`textColor: '#FFFFFF'`), Mixed-Case white subtitle
(`title: 'Director'`, `subtitleColor: '#FFFFFF'` via T-183z;
talent-line decoupled from `accent`), Inter Light family
(`font: { family: 'Inter', weight: 300 }` via T-183z; OFL fallback for
proprietary SF Pro), anchored bottom-left at `insetLeftPx: 140` /
`insetBottomPx: 95` (generous whitespace per Apple's canon). Reference
frame 60 (steady-state mid-hold) signed at PSNR ≥ 42 dB / SSIM ≥ 0.98
via F-4 generator flags `--psnr=42 --ssim=0.98` (no manual hand-pin).

T-330 is the **first production consumer of T-183z's `noFlag` /
`subtitleColor` / `font` props** and the **first preset PR to use F-4's
`--psnr` / `--ssim` / `--max-failing-frames` flags** instead of the
manual `thresholds.json` hand-pin step.

Third `lowerThird`-keyed entry in `PRESET_ID_BINDINGS` after T-325 + T-326.
