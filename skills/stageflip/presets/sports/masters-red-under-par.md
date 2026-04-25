---
id: masters-red-under-par
cluster: sports
clipKind: standings
source: docs/compass_artifact.md#the-masters-leaderboard
status: stub
preferredFont:
  family: CBS Sports custom
  license: proprietary-byo
fallbackFont:
  family: Inter
  weight: 600
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# Masters Red-Under-Par — standings / leaderboard

## Visual tokens
- Compact bottom-right or full-panel leaderboard, showing top 5–10 players
- Augusta National Green `#006747` permeates the broadcast — applied as accent strip, not full fill
- Canonical score coloring (CBS / Chirkinian canon, now universal in golf):
  - **Red** numbers = UNDER par (good)
  - **Black** = OVER par
  - **Green** = EVEN par
- Player name + position + score-to-par + thru-hole

## Typography
- Player surnames: Bold, 18–22 pt, Mixed Case
- Position numbers: Bold, 20–24 pt, tabular
- Score to par (-4, E, +2): Bold, 20–24 pt, tabular, color-coded per rule above
- Thru-hole: Regular, 14–16 pt, tabular

## Animation
- Position changes: smooth row-slide, 400 ms ease-in-out
- Birdie / eagle: flash highlight (red pulse, 250 ms) + brief position callout
- Score-change count-up: physics-eased tick through intermediate values, 600 ms
- Full-screen leaderboard: scrolls during commercial-break transitions (Augusta mandates only 4 minutes of commercials per hour — time pressure is real)

## Rules
- The red/black/green color semantic is UNIVERSAL golf canon (originated CBS 1950s). Do not re-theme. Even color-blind-safe alternatives should keep RED meaning "under par."
- Augusta National green is accent only, never full-fill; the tournament's visual identity is restrained.
- Physical on-course leaderboards with hand-posted numbers coexist with our digital graphic; the digital register should feel complementary, not replacing.

## Acceptance (parity)
- Reference frames: 0 (settled), 40 (mid-position-change), 80 (post-birdie-flash), 120 (post-scroll)
- PSNR ≥ 40 dB, SSIM ≥ 0.97

## References
- `docs/compass_artifact.md` § The Masters leaderboard
- Color canon invented by CBS producer Frank Chirkinian
- ADR-004
