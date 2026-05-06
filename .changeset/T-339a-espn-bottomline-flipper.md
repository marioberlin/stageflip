---
'@stageflip/parity-cli': patch
---

T-339a — `espn-bottomline-flipper` preset substantive (Cluster B
fourth; second `newsTicker` clipKind consumer via `PRESET_ID_BINDINGS`
override — Pattern C; first non-`scoreBug`-clipKind Cluster B preset;
**first production consumer of T-356b's `mode: 'flip'` two-row stacked
register** on the `news-ticker-bar` primitive).

Adds `espnBottomlineBinding` as a new entry in `PRESET_ID_BINDINGS`
keyed by `'espn-bottomline-flipper'` (Pattern C — second-preset-for-
clipKind via the override path, NOT clipKind-default). The
`'newsTicker'` arm in `DEFAULT_CLIP_KIND_RESOLVER` stays UNCHANGED at
`newsTickerBinding` (T-356's bloomberg-ticker continuous-marquee
`mode: 'scroll'` register on the same `news-ticker-bar` primitive);
T-333's `premierLeagueFopBinding` + T-334's `foxNflNoChromeBinding` +
T-335's `nbcSnfBinding` and their respective `PRESET_ID_BINDINGS`
entries stay UNCHANGED. Exports one new constant:
`ESPN_BOTTOMLINE_PROPS` (the canonical post-2018 ESPN BottomLine
register snapshot — full-width band on dark `#1A1A1A` charcoal base +
two-row stacked flipper at `mode: 'flip'` + 4500 ms `flipDurationMs`
mid-canon segment cadence + 100 px band height (50 px per row) +
`bandPosition: 'bottom'` + Yellow `#FFD700` `upColor` score
highlights + ESPN Red `#CC0000` `downColor` brand-locked accent +
white `#FFFFFF` `flatColor` + six-entry NBA team-vs-team score mix
exercising up/down/flat chip-color paths: `NYK 102 +5 ▲` /
`BOS 97 F ▬` / `LAL 88 -3 ▼` / `PHX 91 F ▬` / `PHI 24 +2 ▲` /
`DAL 22 F ▬`). Reference frame 60 (steady-state mid-segment
`pairIdx = 0`; top row NYK +5 yellow / bottom row BOS F white)
signed at PSNR ≥ 42 dB / SSIM ≥ 0.98 via F-4 generator flags
`--psnr=42 --ssim=0.98` (no manual hand-pin).
