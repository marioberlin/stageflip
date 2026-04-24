---
id: cnn-breaking
cluster: news
clipKind: breakingBanner
source: docs/compass_artifact.md#cnn-breaking-news-banner
status: stub
preferredFont:
  family: CNN Sans
  license: proprietary-byo
fallbackFont:
  family: Inter Tight
  weight: 800
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# CNN Breaking — urgent banner

## Visual tokens
- Full-width banner, `#FFFFFF` fill
- End-cap flag: `#CC0000`, full-height left
- Post-2023: rounded corners + flatter styling
- "BREAKING NEWS" label: red `#CC0000` with white text OR white with red text depending on the banner's light/dark state
- LIVE bug: pulsating red, beneath the CNN logo
- Ticker strip below main banner: dark gray gradient

## Typography
- "BREAKING NEWS" label: Bold Condensed, ALL CAPS, 32–40 pt
- Headline: Bold Condensed, ALL CAPS, 36–44 pt, `#000000`
- Ticker: Regular, Mixed Case, 18–22 pt

## Animation
- Entry: red block sweeps across banner L→R, reveals "BREAKING NEWS" label then headline, 800 ms total
- LIVE bug: pulse 2 s cycle, 0.6 → 1.0 opacity
- Text change during breaking: same red-block wipe as `cnn-classic`, 600 ms
- Flipper ticker below, red chevron prefix per item
- Exit: banner minimizes to `cnn-classic` register OR hard cut to next element

## Rules
- Use only for true breaking news. Do not apply to ongoing developing coverage; escalate to `cnn-classic` after the initial breaking.
- "BREAKING NEWS" label is not customizable — it's the brand signal; do not brand-override.
- If the story later resolves, exit to `cnn-classic` with the story-update headline; do not just dismiss.

## Acceptance (parity)
- Reference frames: 0 (pre-entry), 12 (wipe mid-point), 30 (label visible), 48 (headline settled)
- PSNR ≥ 40 dB vs. reference, all four frames
- SSIM ≥ 0.97 across the shot

## References
- `docs/compass_artifact.md` § CNN Breaking News banner
- Sibling preset: `cnn-classic`
- ADR-004
