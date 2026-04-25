---
id: bbc-reith-dark
cluster: news
clipKind: lowerThird
source: docs/compass_artifact.md#bbc-news
status: stub
preferredFont:
  family: BBC Reith Serif + BBC Reith Sans
  license: proprietary-byo
fallbackFont:
  family: Source Serif 4 + Source Sans 3
  weight: 600
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# BBC Reith Dark — lower third

## Visual tokens
- Bar: dark `#1A1A1A` @ 85% opacity, width ≈ 60–70% of frame, extending from left
- Accent strip: BBC Red `#BB1919`, left edge
- Text: `#FFFFFF`
- Dimensions: ≈ 900 × 80 px @ 1080p, positioned 40–60 px from bottom
- 2019 rebrand inverted the traditional white-on-dark to dark-on-light for some contexts; this preset preserves the dark register

## Typography
- Headline (`name`): Reith Serif fallback, Medium, Mixed Case, 26–32 pt
- Subtitle (`title`): Reith Sans fallback, Regular, Mixed Case, 18–22 pt
- Slightly open letter spacing (+10–15 tracking) for screen clarity

## Animation
- Entry: accent red strip appears first, 150 ms; bar wipes in L→R, 400 ms; text slides in from slight offset, 200 ms. Total ≈ 500–600 ms.
- Ticker below (optional): flipper format, one headline at a time, no scroll — per 2019 rebrand canon.
- Exit: reverse wipe L←R or fade down, 500 ms.

## Rules
- Use when a humanist, authoritative, public-broadcaster register is called for.
- The serif/sans pairing is the signature — do not substitute a single-family compose.
- Flipper, not scroll, for any ticker companion — this is the BBC canon (comprehension > density).
- Designed for legibility across ages 5–85 — avoid shrinking below 18 pt on the subtitle.

## Acceptance (parity)
- Reference frames: 0 (accent visible), 8 (bar mid-wipe), 24 (text settled), 60 (steady-state)
- PSNR ≥ 40 dB, SSIM ≥ 0.97

## References
- `docs/compass_artifact.md` § BBC News
- Compass canon note: BBC Reith won a Red Dot Design Award; fallback pairing must preserve serif+sans hierarchy
- ADR-004
