---
id: social-handle-lower-third
cluster: ctas
clipKind: lowerThird
source: docs/compass_artifact.md#social-handle-lower-third
status: stub
preferredFont:
  family: Roboto / Montserrat / Proxima Nova
  license: apache-2.0 / ofl / commercial-byo
fallbackFont:
  family: Inter
  weight: 700
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# Social Handle Lower-third — cross-platform passport

## Visual tokens
- Horizontal bar, 30–60% of screen width
- Position: lower 15–20% of frame
- Background: black `#000000` @ 60–80% opacity
- Text: white `#FFFFFF` or brand-colored
- Platform icons (24 × 24 px @ 1080p) in OFFICIAL brand colors:
  - Instagram: gradient `#833AB4` → `#E1306C` → `#F77737`
  - TikTok: black `#000000` + cyan `#69C9D0` + pink/red `#EE1D52`
  - YouTube: red `#FF0000`
  - X / Twitter: black `#000000`
- Icons positioned left of @username text

## Typography
- Roboto / Montserrat / Proxima Nova fallback (Inter), Bold (700)
- 18–24 pt @ 1080p
- @handles in Bold; platform names (if shown) in Regular

## Animation
- Entry: slides in from left or bottom, 300–500 ms ease-out
- Hold: 4–8 s
- Multiple handles cascade in sequentially: stagger 150–200 ms per handle
- Exit: reverse slide or fade

## Rules
- Borrowed from broadcast TV conventions — the lower-third register signals professionalism.
- Lower 15–20% of frame is canonical (avoids critical content). Don't reposition.
- Brief exposure + repetition: 4–8 s, repeated throughout video. Do NOT hold for 30 s.
- Platform icons MUST be in official brand colors — monochrome "designer" versions look amateur.
- Cascade timing of 150–200 ms is the rhythm — don't compress to simultaneous reveal (loses the tracking eye).

## Acceptance (parity)
- Reference frames: 0 (pre-entry), 12 (first handle settled), 30 (cascade complete), 90 (mid-hold)
- PSNR ≥ 42 dB, SSIM ≥ 0.98

## References
- `docs/compass_artifact.md` § Social handle lower-third
- ADR-004
