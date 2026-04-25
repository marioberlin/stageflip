---
id: espn-bottomline-flipper
cluster: sports
clipKind: newsTicker
source: docs/compass_artifact.md#espn-sportscenter
status: stub
preferredFont:
  family: ESPN A2 Beckett + Klavika
  license: proprietary-byo
fallbackFont:
  family: Roboto Condensed + Inter
  weight: 700
  license: apache-2.0 + ofl
permissions: [network]
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# ESPN BottomLine — two-line flipper ticker

## Visual tokens
- Full-width persistent ticker at absolute bottom of frame, ≈ 1920 × 40 px @ 1080p
- Topic / story bar above the BottomLine, ≈ 1920 × 60 px (optional companion layer)
- Background gradient: dark charcoal `#333333` → black `#1A1A1A`
- ESPN Red `#CC0000` for accents and the logo box
- White `#FFFFFF` text
- Yellow `#FFD700` for score highlights / record callouts
- Logo box: ESPN Red rounded rectangle on the left edge, ~120 × 40 px
- Two-line flipper format (post-2018 canon): scores and headlines flip in segments, never scrolls continuously

## Typography
- Team abbreviations: A2 Beckett fallback (Roboto Condensed), Bold Condensed, ALL CAPS, 18–22 pt, tabular
- Scores: Bold Condensed, 22–26 pt, tabular
- Headlines: Klavika fallback (Inter), Bold, Mixed Case, 18–22 pt
- Story-bar text: Bold, 26–32 pt
- Optimized for rapid scanning — letterforms wide enough at small TV-broadcast sizes

## Animation
- Two-line flipper: each segment displays for 4–5 s, then flips top-to-bottom (vertical flip transition, 350 ms ease-in-out)
- Score updates: brief yellow flash (200 ms) on the segment containing the changed game
- Wicket / TD / goal-equivalent moments: longer flash + scale pulse (1.0 → 1.04 → 1.0, 350 ms)
- The ticker is **persistent** — stays on screen almost permanently during programming. No entry / exit animations during programming hours.
- Initial entry (at programming start): slide up from bottom, 400 ms ease-out

## Rules
- **Persistent during programming.** Don't pop in / out per highlight; it lives on the screen for the duration.
- Two-line flipper is the post-2018 canon — do not revert to single-line continuous-scroll. The flipper format won out specifically because it improves comprehension during fast-cut programming.
- ESPN Red is brand-locked; the logo box must use it. Other brand applications can vary.
- Score highlights in yellow; do not re-theme to brand colors.
- Pairs with cluster B sports presets (cricket / NFL / MLB-register score bugs) for full broadcast layout.

## Acceptance (parity)
- Reference frames: 0 (segment N visible), 30 (mid-flip), 60 (segment N+1 settled), 120 (post-score-flash on next change)
- PSNR ≥ 40 dB, SSIM ≥ 0.97

## References
- `docs/compass_artifact.md` § ESPN SportsCenter
- 2014 Troika Design redesign; 2018 two-line flipper upgrade
- Frontier: `LiveDataClip` for live scores feed
- ADR-004
