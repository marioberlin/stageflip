---
'@stageflip/parity-cli': patch
---

T-325 — `bbc-reith-dark` preset substantive (Cluster A second; second
`lowerThird` clipKind binding via `PRESET_ID_BINDINGS` override).

Adds `bbcReithDarkBinding` to `PRESET_ID_BINDINGS` keyed on
`'bbc-reith-dark'` (Pattern C — second-preset-for-clipKind via the
per-presetId override map; the `lowerThird` clipKind-default
`cnnClassicBinding` from T-323 stays unchanged). Exports the new
`BBC_REITH_DARK_PROPS` constant: a seven-field snapshot driving the
canonical BBC Reith-dark steady-state lower-third register on the
`LowerThird` primitive (T-183) — dark bar (`background: '#1A1A1A'`),
BBC Red left-edge accent strip (`accent: '#BB1919'`), Mixed-Case
white headline (`name: 'Sarah Smith'`), Mixed-Case subtitle
(`title: 'Chief Political Correspondent'`), anchored bottom-left at
`insetLeftPx: 64` / `insetBottomPx: 48`. Reference frame 60
(steady-state mid-hold) signed at PSNR ≥ 42 dB / SSIM ≥ 0.98.

Mirrors T-363 / T-364 / T-365 / T-366 pattern in the caption family;
this is the first `lowerThird`-keyed entry in `PRESET_ID_BINDINGS`.
