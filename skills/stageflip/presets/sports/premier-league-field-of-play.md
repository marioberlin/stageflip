---
id: premier-league-field-of-play
cluster: sports
clipKind: scoreBug
source: docs/compass_artifact.md#premier-league
status: stub
preferredFont:
  family: Premier Sans
  license: proprietary-byo
fallbackFont:
  family: Space Grotesk
  weight: 600
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# Premier League Field of Play — scoreBug

## Visual tokens
- Compact rectangular scoreclock, upper-left
- Primary fill: PL purple `#34003A`
- Accent: PL green `#00FC8A`
- Text: `#FFFFFF`
- Kit-color stripes on the outer edge of team boxes, 6 px wide
- Per-team box: ≈ 102 × 38 px at web scale (scales for broadcast)
- Solid background, **no transparency** (designed for legibility "from across fan-filled bars")

## Typography
- Team abbreviations (3 letters): Premier Sans fallback, Bold, 14–16 pt, tabular
- Scores: Bold, 24–30 pt, tabular — distinct numeral design preserved
- Minute / period: Regular, 12–14 pt
- Test case: must render "Alex Oxlade-Chamberlain" correctly in condensed cut (longest PL name — canon)

## Animation
- Entrance: 2 s cubic-bezier(.55, 0, .1, 1) with 1 s delay (compass-specified)
- Score changes: goal-celebration flourish; the 2024/25 canon introduced team-specific goal animations (Arsenal cannon, Brighton seagulls, United devils/pitchforks) — implement as `goalAnimation: { team, variant }` slot, optional
- "Field of Play" motion language: colored blocks rise, fall, and slide referencing passes, long balls, corners, dribbles — apply to companion transitions, not the scoreclock itself

## Rules
- Kit-color stripes are the instant-ID signal; do not substitute solid color fills.
- No transparency on the scoreclock — break this rule and legibility degrades in real-world viewing conditions.
- Team-specific goal celebrations are opt-in — don't default them on; they're high-effort and only sensible with brand approval.
- "Field of Play" motion applies to ancillary graphics (matchday opens, transitions), not the persistent scoreclock.

## Acceptance (parity)
- Reference frames: 0 (pre-entry), 60 (settled entry), 120 (steady), 150 (post-score-update)
- PSNR ≥ 40 dB, SSIM ≥ 0.97

## References
- `docs/compass_artifact.md` § Premier League
- Beazley Designs of the Year nomination (2017) — preset aspires to match this bar
- ADR-004
