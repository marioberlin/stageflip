---
id: bloomberg-ticker
cluster: data
clipKind: newsTicker
source: docs/compass_artifact.md#financial-market-data
status: stub
preferredFont:
  family: Bloomberg in-house
  license: proprietary-byo
fallbackFont:
  family: IBM Plex Mono
  weight: 500
  license: ofl
permissions: [network]
signOff:
  parityFixture: pending-user-review
  typeDesign: na
---

# Bloomberg Ticker — financial market register

## Visual tokens
- Bottom-of-screen scrolling ticker, ~40–50 px tall @ 1080p
- Background: dark `#0A0A0A` solid
- Symbol fill: white `#FFFFFF`
- Up: green `#00D26A` (Western markets); inverted for Asian markets per locale
- Down: red `#FF3C3C`
- Dividers between symbol entries: thin vertical bars, `#333333`

## Typography
- Symbol code: Bold mono, 22–24 pt, tabular
- Price: Bold mono, 22–24 pt, tabular
- Delta (+/- + %): Bold mono, 20–22 pt, tabular, color-coded
- Mono is mandatory for column-stable scrolling

## Animation
- Continuous scroll right-to-left, 50–80 px / s configurable per `speed` input
- New entries enter from right; old entries exit left
- Update pulse: brief flash (150 ms) on price change
- No bounce, no easing — linear scroll is correct for tickers

## Rules
- Locale-dependent green/red semantic. `locale: 'us-eu' | 'asia'` declared on compose; the up/down colors swap accordingly.
- Mono typography is non-negotiable for column alignment; escalate if fallback fails.
- Always include the unit (currency or symbol). Don't render bare numbers.
- Updates tick at most every 1 s (avoid jitter); use `LiveDataClip` for live feed, otherwise seeded sample data with pre-recorded updates.

## Acceptance (parity)
- Reference frames: 0 (entry frame), 30 (mid-scroll), 60 (post-update-flash), 120 (steady cycle)
- PSNR ≥ 40 dB, SSIM ≥ 0.97

## References
- `docs/compass_artifact.md` § Financial Market Data
- Frontier: `LiveDataClip` for market feed
- ADR-004
