---
id: nhc-cone-of-uncertainty
cluster: weather
clipKind: stormTracker
source: docs/compass_artifact.md#nhc-hurricane-track-cone
status: stub
preferredFont:
  family: Open Sans
  license: ofl
fallbackFont:
  family: Open Sans
  weight: 600
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: na
---

# NHC Cone of Uncertainty — storm track

## Visual tokens
- White / translucent cone widening over 5-day forecast period
- Overlaid on coastal map (Atlantic basin or relevant region)
- Coastal warning palette (NHC standard, do NOT re-theme):
  - Hurricane Warning: `#DC143C` (Red)
  - Hurricane Watch: `#FF00FF` (Magenta)
  - Tropical Storm Warning: `#B22222`
  - Storm Surge Warning: `#B524F7` (Dark Purple)
- Track dots show forecast positions with intensity letters: D / S / H / M (Depression / Storm / Hurricane / Major)
- 2026 update: includes inland warnings (a major canon evolution)

## Typography
- Storm name: Bold, 28–32 pt, UPPERCASE
- Track-dot labels (D/S/H/M): Bold, 18–22 pt
- Time-stamp labels: Regular, 14–16 pt
- Disclaimer text: Regular, 14–16 pt

## Animation
- Updated every 6 hours (real-time data via `LiveDataClip` if frontier is enabled; otherwise static snapshot)
- Successive advisories animated as time-lapse: 1.5 s per advisory step
- Map zoom: from wide Atlantic to regional close-up, 3 s, ease-in-out
- Cone expands frame-by-frame as the forecast unfolds

## Rules
- **MANDATORY DISCLAIMER**: every render must include "Impacts extend beyond the cone" or equivalent text. The cone-of-uncertainty misinterpretation (people assuming "outside cone = safe") is a documented public-safety failure. Non-negotiable.
- Coastal warning color palette is set by NHC; do not re-theme even for brand reasons.
- Track-dot intensity letters (D/S/H/M) are mandated NWS shorthand; do not customize.
- Use this preset only with current NHC / official-source data. Speculative track lines must be marked clearly distinct from official forecasts.

## Acceptance (parity)
- Reference frames: 0 (current position), 30 (24-hr forecast), 60 (3-day), 120 (5-day)
- PSNR ≥ 38 dB, SSIM ≥ 0.95

## References
- `docs/compass_artifact.md` § NHC Hurricane Track Cone
- Bryan Norcross / NHC heritage (Hurricane Andrew, 1992)
- Frontier: `LiveDataClip` for live NHC feed
- ADR-004
