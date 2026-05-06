---
'@stageflip/parity-cli': patch
---

T-324 — `cnn-breaking` preset substantive (Cluster A sixth; first
`breakingBanner` clipKind binding via the clipKind-default arm in
`DEFAULT_CLIP_KIND_RESOLVER`).

Adds `cnnBreakingBinding` as the new `'breakingBanner'` switch arm in
`DEFAULT_CLIP_KIND_RESOLVER` (Pattern C — first-preset-for-clipKind via
the clipKind-default path, NOT `PRESET_ID_BINDINGS`). Sister Cluster A
`breakingBanner` preset T-327 `fox-news-alert` will supply the second
consumer via `PRESET_ID_BINDINGS` for the sliver-register variant.
Exports the new `CNN_BREAKING_PROPS` constant: a ten-field snapshot
driving the canonical CNN-Breaking steady-state register on the
just-shipped T-324a `BreakingBanner` primitive — full-width white
banner (`background: '#FFFFFF'`) + red flag end-cap on the left
(`endCap: { fill: '#CC0000', position: 'left' }`) + red `BREAKING
NEWS` label badge with white text (`label: { text: 'BREAKING NEWS',
fill: '#CC0000', color: '#FFFFFF' }`) + UPPERCASE black headline
(`headline: 'SUPREME COURT RULES UNANIMOUSLY'`, `headlineColor:
'#000000'`, `casing: 'uppercase'`) at Inter Tight 800
(`font: { family: 'Inter Tight', weight: 800 }` honored via T-324a's
`font` prop override — D-T324-13), anchored at `insetBottomPx: 60`
(closer to bottom edge than the chyron's 64 px). `mode: 'banner'` and
`slideAxis: 'horizontal'` are CNN canonical defaults. Reference frame
60 (steady-state mid-hold) signed at PSNR ≥ 42 dB / SSIM ≥ 0.98 via
F-4 generator flags `--psnr=42 --ssim=0.98` (no manual hand-pin).

T-324 is the **first production consumer of the just-shipped T-324a
`BreakingBanner` primitive** AND the **first `breakingBanner` clipKind
to be wired into the parity-CLI resolver**. The five existing
`lowerThird` `PRESET_ID_BINDINGS` overrides (`bbc-reith-dark`,
`al-jazeera-orange`, `apple-tv-lt`, `netflix-doc-lt`,
`big-number-stat-impact`) and the existing `lowerThird` clipKind-default
(`cnnClassicBinding`) remain unchanged.

LIVE pulse bug, ticker strip, red-block-wipe text-change, CNN bug
rounded box, and staged red-block sweep entrance are deferred to
T-324b/c/d carve-outs IF Reviewer scrutiny demands them; ticker strip
composes externally via `news-ticker-bar` (T-356a). v1 ships the
steady-state register only.
