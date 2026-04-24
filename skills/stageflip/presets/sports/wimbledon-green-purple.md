---
id: wimbledon-green-purple
cluster: sports
clipKind: scoreBug
source: docs/compass_artifact.md#wimbledon
status: stub
preferredFont:
  family: Gotham
  license: commercial-byo
fallbackFont:
  family: Montserrat
  weight: 500
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# Wimbledon Green-Purple — scoreBug

## Visual tokens
- Compact bottom-left scorebug
- Wimbledon green `#006633` + purple `#4B0082`
- Two player rows, ≈ 350–400 × 80 px @ 1080p — deliberately small to preserve court visibility
- Player surname, country flag, seed number, set columns (1–5), current game score
- Active server: small yellow / green dot indicator
- 2025 update: full previous-set scores shown for the first time in ~20 years

## Typography
- Surnames: Gotham Medium fallback, Bold, 18–20 pt, Mixed Case
- Country codes: Regular, 12–14 pt, ALL CAPS
- Set scores: Bold, 16–18 pt, tabular / monospaced (essential for column alignment)
- Game score: Bold, 20–22 pt, tabular

## Animation
- Entry: fade + slide up from below, 500 ms ease-out
- Score change: brief pulse (150 ms)
- Server-dot: smooth transition on serve change, 300 ms
- Set complete: brief flash + addition of new column, 600 ms

## Rules
- Restraint is the signature. Do not add decorative elements. In a sport obsessed with tradition, the bug must feel inevitable, not designed.
- Monospaced / tabular numerals are mandatory for column alignment — escalate if fallback fails.
- Active-server indicator is the directional signal; keep it small but unambiguous.
- Do not use this preset for non-Wimbledon tennis — it's specifically the Wimbledon register.

## Acceptance (parity)
- Reference frames: 0 (pre-entry), 15 (mid-fade), 30 (settled), 60 (post-set-update)
- PSNR ≥ 42 dB (higher bar for minimal-motion preset), SSIM ≥ 0.98

## References
- `docs/compass_artifact.md` § Wimbledon
- ADR-004
