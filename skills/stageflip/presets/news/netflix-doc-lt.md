---
id: netflix-doc-lt
cluster: news
clipKind: lowerThird
source: docs/compass_artifact.md#netflix-documentaries
status: stub
preferredFont:
  family: Netflix Sans
  license: proprietary-byo
fallbackFont:
  family: DM Sans
  weight: 500
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# Netflix Documentary — lower third

## Visual tokens
- **No background shape.** Clean white `#FFFFFF` text directly on footage.
- Optional: subtle dark gradient vignette at bottom of frame for contrast when footage is bright.
- Thin line separator between name and title (optional, per doc).
- Position: bottom-left, generous padding (120 px from left, 80 px from bottom @ 1080p).

## Typography
- Name: Netflix Sans fallback, Medium / SemiBold, Mixed Case, 24–30 pt, letter spacing +50–100
- Title: Light / Regular, often ALL CAPS, wide tracking +150–200, 18–22 pt
- "Approachable geometric grotesque" — fallback must preserve this register

## Animation
- Entry: simple fade-in, 500–1000 ms
- Or gentle slide up from below, 600 ms ease-out
- Static hold 4–7 seconds
- Exit: fade out 500–800 ms
- Netflix favors subtlety — no bounce, no elastic

## Rules
- **No background box.** If the footage is so busy a box is needed, re-framing the shot is the right answer — not adding a box.
- Generous padding is non-negotiable; this is typographic art, not information packing.
- ALL CAPS + wide tracking on the title is the signature; do not collapse to Mixed Case.
- Use this preset by default when no broadcast-register brand is specified (falls back to documentary-neutral).

## Acceptance (parity)
- Reference frames: 0 (pre-fade), 24 (mid-fade), 48 (settled), 144 (pre-exit)
- PSNR ≥ 42 dB (higher bar — minimal motion means less variance)
- SSIM ≥ 0.98

## References
- `docs/compass_artifact.md` § Netflix documentaries
- Netflix Sans saves Netflix "millions of dollars" in Gotham licensing — fallback quality matters
- ADR-004
