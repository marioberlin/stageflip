---
id: coinbase-dvd-qr
cluster: ctas
clipKind: qrCodeBounce
source: docs/compass_artifact.md#coinbase-super-bowl-qr-code
status: stub
preferredFont:
  family: N/A
  license: na
fallbackFont:
  family: N/A
  weight: 0
  license: na
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: na
---

# Coinbase DVD QR — zero-context curiosity gap

## Visual tokens
- Standard QR code on pure black `#000000` background
- **Zero branding, zero text, zero context**
- Color-shifts through rainbow hues throughout the bounce
- ~20–25% of TV screen
- Deliberately evokes the "bouncing DVD screensaver"
- No watermark, no logo, no caption

## Typography
- N/A — icon-only

## Animation
- Continuous bounce around screen (DVD-screensaver canon)
- Speed: moderate enough to allow scanning while in motion (40–60 px/s)
- Color modules cycle smoothly through rainbow palette, 6–8 s cycle
- 60-second commercial duration is the canonical use case
- Bounces preserve angle of incidence at edges (rebound physics)

## Rules
- ZERO branding is the point. Every brand element added kills the curiosity gap. Coinbase Super Bowl LVI: 20M scans in 60 s by trusting absence.
- The QR code itself must be valid and scannable in motion — render it at sufficient size and contrast.
- Speed must allow scanning — too fast and viewers can't catch it; too slow and the bouncing feels tedious.
- Use this register for attention-max moments (Super Bowl, premiere events, viral campaigns). For routine CTAs, use a branded QR variant.

## Acceptance (parity)
- Reference frames: 0 (top-left position), 60 (mid-bounce), 120 (rebound off edge), 180 (color cycle midpoint)
- PSNR ≥ 38 dB (motion blur reduces precision), SSIM ≥ 0.94

## References
- `docs/compass_artifact.md` § Coinbase Super Bowl QR code
- 20M+ landing page hits in 60 s; jumped from #186 to #2 on App Store
- Gap clip T-319 (`QRCodeBounce`)
- ADR-004
