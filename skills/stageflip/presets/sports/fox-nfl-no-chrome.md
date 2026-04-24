---
id: fox-nfl-no-chrome
cluster: sports
clipKind: scoreBug
source: docs/compass_artifact.md#fox-sports-nfl
status: stub
preferredFont:
  family: Fox Sports custom
  license: proprietary-byo
fallbackFont:
  family: Inter Display
  weight: 900
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# Fox NFL No-Chrome — scoreBug (2025 redesign)

## Visual tokens
- Bottom-center position, NO traditional container box
- Typography floats over a subtle gradient backdrop (radial darkening, ~40% opacity at centroid, fading to 0 at edges)
- Team primary colors fill the background boxes behind the 3-letter codes (e.g., KC red, PHI green)
- White `#FFFFFF` text for team codes
- Intentional FOX DNA: the letter "C" in team codes resembles the "O" in the FOX wordmark (preserved in fallback via font choice)

## Typography
- Team code: Extra Bold / Black, 36–44 pt, tabular
- Score: Extra Bold / Black, 40–48 pt (massive scale intended)
- Down-and-distance: Bold, 18–22 pt — physically moves between teams on possession change

## Animation
- Entry: zoom-in from a "FOX SPORTS" branded black field, 800 ms ease-out
- Down-and-distance: slides horizontally between team sides when possession changes, 350 ms
- Touchdown celebration: comic-book-inspired 3D-rendered text, deliberately stylistically inconsistent with the minimalist bug — optional, gated by `celebration: touchdown | null`
- Score change: quick flash (120 ms), no bounce

## Rules
- Radical departure from chrome — do NOT add a border box to "clean up." The absence of chrome is the design.
- Down-and-distance physically moves with possession. This is a UX innovation, not decoration — preserve it.
- The touchdown celebration intentionally clashes with the bug's minimalism. Don't harmonize them; that breaks the Fox tonal contrast.
- Generated significant public reaction at Super Bowl LIX debut (compass: "the most intense public reaction of any score bug in history") — treat the register as bold, not safe.

## Acceptance (parity)
- Reference frames: 0 (pre-zoom), 24 (mid-zoom), 48 (settled), 100 (post-possession-move)
- PSNR ≥ 40 dB, SSIM ≥ 0.97

## References
- `docs/compass_artifact.md` § Fox Sports NFL
- Fox invented the persistent score bug in 1994 (David Hill); preserve the heritage in the preset's brand signal
- ADR-004
