---
id: fox-news-alert
cluster: news
clipKind: breakingBanner
source: docs/compass_artifact.md#fox-news-alert-system
status: stub
preferredFont:
  family: FF Good OT Black
  license: commercial-byo
fallbackFont:
  family: League Gothic
  weight: 700
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# Fox News Alert — breaking banner

## Visual tokens
- Bug: flat design with white border
- Primary fill: Prussian Blue `#003366`
- Accent / alert: Red `#C20017`
- Persistent "Fox News Alert" sliver remains visible during nearly all breaking coverage
- Semi-transparent dark overlay extends below all graphics

## Typography
- Banner label (ALERT / BREAKING): FF Good OT Black fallback, ALL CAPS, 30–38 pt
- Headline: Heavy / Black, Mixed Case, 32–40 pt
- Ticker (introduced at Fox in 9/11/2001 — now industry-standard): Regular, 18–22 pt

## Animation
- Signature vertical slide motion — elements slide up/down, not horizontal wipes
- Return-from-commercial: bug returns as simple angled lines that morph into searchlight beams, other elements zoom and fade, 1.2 s total sequence
- LIVE pulse: discrete 2 s cycle, matches cluster convention
- Exit: slide down, 400 ms

## Rules
- Vertical slide is the Fox signature — do not substitute horizontal wipes.
- "Fox News Alert" sliver is persistent; hide only during non-breaking programming. Do not repurpose the sliver for non-Fox-register content.
- The searchlight morph is a Fox-specific bumper flourish; do not migrate to other cluster-A presets.

## Acceptance (parity)
- Reference frames: 0 (pre-slide), 10 (mid-slide), 24 (settled), 60 (steady)
- PSNR ≥ 40 dB, SSIM ≥ 0.97

## References
- `docs/compass_artifact.md` § Fox News Alert system
- ADR-004
