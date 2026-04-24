---
id: succession-home-video
cluster: titles
clipKind: titleSequence
source: docs/compass_artifact.md#succession
status: stub
preferredFont:
  family: Engravers Gothic + Sackers Gothic
  license: commercial-byo
fallbackFont:
  family: Copperplate + IBM Plex Sans Condensed
  weight: 600
  license: license-mixed
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# Succession — home video / dynastic title sequence

## Visual tokens
- Two visual registers intercut:
  1. Grainy 4:3 sepia "home video" footage — childhood privilege scenes (tennis, skiing, elephant rides)
  2. Crisp contemporary 16:9 footage — corporate power (skyscrapers, private planes, boardrooms)
- Sepia register: warm yellow-brown tint, moderate film grain, subtle frame chatter
- Contemporary register: high-contrast neutral grade, sharp focus

## Typography
- Show logo: Engravers Gothic fallback, ALL CAPS, wide tracking, classic stationery-engraving style
- Credits: Sackers Gothic Medium fallback, ALL CAPS, wider tracking, ~20–24 pt
- Tracking is signature — minimum +200, often +300 for credit lines

## Animation
- Quick-cut montage alternating between sepia + contemporary, ~90 s
- Patriarch shown from behind or at distance (faceless authority — preserve framing)
- Sequence intentionally evolves across seasons; preset takes a `seasonVariant: 1 | 2 | 3 | 4` slot
- Music: Nicholas Britell piano theme — `musicCue` slot is mandatory

## Rules
- The 4:3 sepia footage is shot NEW (not actual home video) — preset compose accepts a `sepiaSource: VideoRef` for custom footage with the period look applied via a film-grade layer.
- Patriarch faceless — frame from behind or at distance. The "Fort Knox" energy depends on this.
- Engravers / Sackers Gothic register signals "dynastic stationery" — fallback must preserve all-caps wide-tracking authority.
- Pacing matches the Britell piano cue; preset duration auto-fits to the supplied music cue.

## Acceptance (parity)
- Reference frames: 0 (entry sepia), 360 (mid-cut), 720 (corporate register), 1080 (resolution)
- PSNR ≥ 34 dB (mixed-grade footage has high variance), SSIM ≥ 0.91

## References
- `docs/compass_artifact.md` § Succession
- Picture Mill (William Lebeda); inspired by Fincher's The Game (1997)
- ADR-004
