---
'@stageflip/parity-cli': patch
---

T-326 — `al-jazeera-orange` preset substantive (Cluster A third; third
`lowerThird` clipKind binding via `PRESET_ID_BINDINGS` override).

Adds `alJazeeraOrangeBinding` to `PRESET_ID_BINDINGS` keyed on
`'al-jazeera-orange'` (Pattern C — third-preset-for-clipKind via the
per-presetId override map; the `lowerThird` clipKind-default
`cnnClassicBinding` from T-323 stays unchanged; T-325's
`bbcReithDarkBinding` override stays unchanged). Exports the new
`AL_JAZEERA_ORANGE_PROPS` constant: a seven-field snapshot driving the
canonical Al Jazeera English steady-state lower-third register on the
`LowerThird` primitive (T-183) — light bar (`background: '#F7F7F5'`),
Al Jazeera Orange left-edge accent strip (`accent: '#F7941D'`),
Mixed-Case dark headline (`name: 'Marwan Bishara'`,
`textColor: '#222222'`), Mixed-Case subtitle (`title:
'Senior Political Analyst'`), anchored bottom-left at
`insetLeftPx: 64` / `insetBottomPx: 48`. Reference frame 60
(steady-state mid-hold) signed at PSNR ≥ 42 dB / SSIM ≥ 0.98.

v1 ships Latin only — Arabic companion (`الجزيرة` second-language slot)
deferred to T-326a IF Reviewer demands; mirrors T-350's D-T350-12
Hangul-deferred posture. v1 single-color accent `#F7941D`; orange→amber
gradient deferred to `T-183z`-family primitive follow-up.

Second `lowerThird`-keyed entry in `PRESET_ID_BINDINGS` after T-325.
