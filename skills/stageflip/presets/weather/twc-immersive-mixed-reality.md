---
id: twc-immersive-mixed-reality
cluster: weather
clipKind: fullScreen
source: docs/compass_artifact.md#the-weather-channel
status: stub
preferredFont:
  family: TWC custom modernized (Trollbäck+ system)
  license: proprietary-byo
fallbackFont:
  family: Inter Tight
  weight: 600
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: na
---

# TWC Immersive Mixed Reality (IMR) — fullScreen severe-weather register

## Visual tokens
- Photo-realistic 3D weather environment composited behind a (greenscreen) presenter or first-person viewpoint
- Standard atmospheric look (storm, tornado, surge, wildfire) with physics-modeled particle systems
- Foreground HUD with severity callouts: temperature, wind, surge depth, fire intensity
- Color palette: storm grays + danger reds `#CC0000` for severity; calmer blues / greens for non-severe register

## Typography
- Severity callout: Bold Condensed, 36–48 pt, UPPERCASE — `#FFFFFF` with a 2 px black stroke for legibility over photo-real 3D
- Data labels (mph, °F, ft): Regular, 22–28 pt, tabular
- Location labels: Bold, 24–30 pt

## Animation
- Photorealistic 3D scene rendered live (Unreal Engine + Zero Density Reality Engine + Mo-Sys StarTracker camera tracking) — implemented as `ThreeSceneClip` (ADR-005)
- Objects move based on physics-modeled data from actual weather events (real storm telemetry → particle behaviour)
- Severity callouts pulse on threshold transitions (warning → emergency)
- Camera path: cinematic sweep over the simulated environment, 12–20 s per segment

## Rules
- This is the "Emmy register" — premium-tier. Do not pair with low-fidelity assets; the IMR composite expects 4K source plates.
- Use `ThreeSceneClip` for the live IMR rendering; fall back to a high-quality pre-composited video if frontier is not enabled.
- Physics-driven motion is the differentiator. Don't author keyframed objects; drive from real or simulated telemetry data.
- Always include a severity callout in-frame; the immersive 3D alone is not sufficient as severe-weather communication.

## Acceptance (parity)
- Reference frames: 0 (scene entry), 60 (mid-camera-sweep), 120 (callout at peak), 180 (scene exit)
- PSNR ≥ 36 dB (3D scene compositing has higher variance), SSIM ≥ 0.93

## References
- `docs/compass_artifact.md` § The Weather Channel (IMR)
- Won an Emmy + swept Promax Informational Graphics
- Frontier: `ThreeSceneClip` (ADR-005)
- ADR-004
