---
id: true-detective-double-exposure
cluster: titles
clipKind: titleSequence
source: docs/compass_artifact.md#true-detective-season-1
status: stub
preferredFont:
  family: Custom sans serif (clean, unobtrusive)
  license: license-cleared
fallbackFont:
  family: Inter
  weight: 400
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# True Detective S1 — photographic double-exposure title sequence

## Visual tokens
- Color palette: muted, desaturated earth tones — oily yellows, sickly greens, industrial grays
- Photographic source: Richard Misrach's Petrochemical America style — landscape photography of "Cancer Alley"
- Human silhouettes serving as windows revealing secondary imagery (faces, environments)
- Slowed-down footage to ~1/10th speed for surreal atmosphere
- Subtle film grain throughout

## Typography
- Credits: clean sans-serif (Inter fallback), Regular, 24–30 pt
- ALL CAPS or Mixed Case (per credit type)
- Letter spacing slightly wider than default (+30–50 tracking)
- Typography is unobtrusive — the photography is the foreground

## Animation
- Living photographs: footage rendered at ~1/10 speed with cross-dissolves between source plates
- Double-exposure technique: silhouette layer reveals secondary footage through the figure
- Builds from lightness to darkness; sequence climaxes with fire consuming the imagery, ~90 s
- Music sync (Handsome Family "Far From Any Road" — original cue; preset takes any `musicCue`)

## Rules
- Source photography quality is critical — at least 4K resolution per plate. Lower resolutions break the register.
- Double-exposure layering must use the silhouette-as-window technique, not opacity blending. The figure should reveal what's "inside" it, not just appear translucent.
- Slowed footage is mandatory — real-time playback is wrong for this register.
- Pacing builds; do not loop. Sequence has an arc.

## Acceptance (parity)
- Reference frames: 0 (entry), 360 (mid-arc), 720 (climax), 1080 (resolution at 90 s @ 12 fps effective)
- PSNR ≥ 34 dB (photographic source has high variance), SSIM ≥ 0.90

## References
- `docs/compass_artifact.md` § True Detective Season 1
- Elastic (Patrick Clair); animation by Antibody, Sydney; 2014 Emmy
- ADR-004
