---
'@stageflip/parity-cli': patch
---

T-323 — `cnn-classic` preset substantive (Cluster A first; first
`lowerThird` clipKind binding).

Adds `cnnClassicBinding` to `DEFAULT_CLIP_KIND_RESOLVER` as the first arm
for `clipKind: 'lowerThird'` (Pattern C — clipKind-default, not
`PRESET_ID_BINDINGS` override). Exports the new `CNN_CLASSIC_PROPS`
constant: a seven-field snapshot driving the canonical CNN-Classic
steady-state lower-third register on the `LowerThird` primitive (T-183) —
white banner (`background: '#FFFFFF'`), red flag end-cap
(`accent: '#CC0000'`, Boston University Red / PMS 2347 C),
UPPERCASE bold headline (`name: 'BREAKING: SUPREME COURT RULES'`),
Mixed-Case talent (`title: 'Anderson Cooper · Chief Anchor'`), anchored
bottom-left at `insetLeftPx: 64` / `insetBottomPx: 64`. Reference frame
60 (steady-state mid-hold) signed at PSNR ≥ 42 dB / SSIM ≥ 0.98.

Note the case mapping per D-T323-12: preset frontmatter
`clipKind: 'lowerThird'` (camelCase) → primitive `kind: 'lower-third'`
(kebab-case).
