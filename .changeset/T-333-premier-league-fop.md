---
'@stageflip/parity-cli': patch
---

T-333 — `premier-league-field-of-play` preset substantive (Cluster B
first; second `scoreBug` clipKind consumer via `PRESET_ID_BINDINGS`
override — Pattern C; first production consumer of T-332a's `score-bug`
primitive AND its `'football'` style branch).

Adds `premierLeagueFopBinding` as a new entry in `PRESET_ID_BINDINGS`
keyed by `'premier-league-field-of-play'` (Pattern C — second-preset-
for-clipKind via the override path, NOT clipKind-default). The
`'scoreBug'` arm in `DEFAULT_CLIP_KIND_RESOLVER` stays UNCHANGED at
`scoreBugDotsBinding` (T-358's cricket-ball-by-ball-dots binding via
the `outcome-row` primitive — a different primitive entirely). Exports
one new constant: `PREMIER_LEAGUE_FOP_PROPS` (the canonical Premier
League 2017+ broadcast snapshot — PL purple `#34003A` chrome + Arsenal
red `#EF0107` home box + Chelsea blue `#034694` away box + 3-letter
team codes `'ARS'` / `'CHE'` + tabular `'2'` / `'1'` scores + `'67:42'`
mid-second-half clock + `'2H'` period token + `Space Grotesk` 600
tabularNums OFL fallback for proprietary-byo `Premier Sans`). Reference
frame 60 (steady-state mid-hold) signed at PSNR ≥ 42 dB / SSIM ≥ 0.98
via F-4 generator flags `--psnr=42 --ssim=0.98` (no manual hand-pin).

T-333 brings Cluster B to **1/9 substantive + signed** (NOT YET
ELIGIBLE for batch merge). The remaining 8 Cluster B presets land in
their own preset PRs over the rest of Phase 13. The existing 11
`PRESET_ID_BINDINGS` overrides and every clipKind-default arm remain
unchanged.

Goal-celebration animations (Arsenal cannon, Brighton seagulls, United
devils-and-pitchforks per stub line 39 — explicit v2 territory),
"Field of Play" companion motion language (passes / long balls /
corners / dribbles per stub line 40 — separate composition concern),
2 s `cubic-bezier(.55, 0, .1, 1)` entrance with 1 s delay (`T-332b`-
family carve-out IF demanded), 6 px outer-edge kit-color stripes (vs
the primitive's full-tile fill — `T-332b`-family carve-out), and PL
green `#00FC8A` accent rendered slot on the football branch (`T-332b`-
family carve-out) are all deferred. v1 ships the steady-state mid-hold
scoreclock layer only.
