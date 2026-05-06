---
'@stageflip/parity-cli': patch
---

T-329 — `netflix-doc-lt` preset substantive (Cluster A fifth; fifth
`lowerThird` clipKind binding via `PRESET_ID_BINDINGS` override).

Adds `netflixDocLtBinding` to `PRESET_ID_BINDINGS` keyed on
`'netflix-doc-lt'` (Pattern C — fifth-preset-for-clipKind via the
per-presetId override map; the `lowerThird` clipKind-default
`cnnClassicBinding` from T-323 stays unchanged; T-325's
`bbcReithDarkBinding`, T-326's `alJazeeraOrangeBinding`, and T-330's
`appleTvLtBinding` overrides stay unchanged). Exports the new
`NETFLIX_DOC_LT_PROPS` constant: a ten-field snapshot driving the
canonical Netflix documentary steady-state lower-third register on the
`LowerThird` primitive (T-183 + T-183z) — text-only minimalist register
with `noFlag: true` (T-183z; suppresses the 6 px accent strip),
`background: '#000000'` (canvas-matching black; card visually
disappears), Mixed-Case white headline (`name: 'Ava DuVernay'`,
`textColor: '#FFFFFF'`), **literal ALL-CAPS** white subtitle
(`title: 'DIRECTOR'`, `subtitleColor: '#FFFFFF'` via T-183z;
talent-line decoupled from `accent`), DM Sans Medium family
(`font: { family: 'DM Sans', weight: 500 }` via T-183z; OFL fallback
for proprietary Netflix Sans), anchored bottom-left at
`insetLeftPx: 120` / `insetBottomPx: 80` (generous whitespace per
Netflix's documentary canon). Reference frame 60 (steady-state
mid-hold) signed at PSNR ≥ 42 dB / SSIM ≥ 0.98 via F-4 generator flags
`--psnr=42 --ssim=0.98` (no manual hand-pin).

T-329 is the **second production consumer of T-183z's `noFlag` /
`subtitleColor` / `font` props** (T-330 was first) and the **second
preset PR to use F-4's `--psnr` / `--ssim` / `--max-failing-frames`
flags** instead of the manual `thresholds.json` hand-pin step.

T-329 also establishes the **canonical "headline Mixed Case + title
ALL CAPS" snapshot-string casing pattern** (D-T329-6) — Netflix's
"ALL CAPS title is the signature" rule (compass canon line 43) is
honored by passing the literal upper-case string `'DIRECTOR'` directly
in the snapshot, without a primitive `casing` prop. Future presets
demanding per-line casing without a `casing` prop reuse this pattern
verbatim.

Fourth `lowerThird`-keyed entry in `PRESET_ID_BINDINGS` after T-325 +
T-326 + T-330.
