---
id: shader-cosmic-nebula
cluster: cluster-i
clipKind: shader-clip
parityFixture: pending-user-review
signOff:
  parityFixture: pending-user-review
  typeDesign: na
ownerTask: T-532
relatedTasks:
  - T-531
status: substantive
---

# Cosmic Nebula shader

## Visual signature
Deep-space particle cloud + starfield. Primary palette: deep purple `#581C87` → magenta `#A21CAF` → cyan-blue `#0EA5E9` highlights. Hundreds of point-lights (stars) twinkle at varying rates over a procedural nebula-cloud field rendered via 3D simplex noise. Slow zoom-and-rotate motion gives a sense of drifting through space. Mood: cosmic awe, premium product launch backdrop.

## Uniforms
- `uTime` (float): elapsed seconds. Drives star twinkle + nebula scroll + slow rotation.
- `uIntensity` (float, 0..1, default 0.65): overall brightness of nebula clouds. Stars scale independently.
- `uStarDensity` (float, 0..1, default 0.7): density of star field. 0 = sparse; 1 = dense Milky-Way-band feel.
- `uTwinkleRate` (float, 0..2, default 1.0): how fast stars pulse. 0 = static; 2 = strobing.
- `uRotationSpeed` (float, 0..1, default 0.15): nebula rotation rate. 0 = static; high values feel kinetic.
- `uSeed` (integer, default 13): scrambles star positions + nebula offsets.

## Animation
Continuous loop. Per frame:
1. Compute 3D simplex noise sample at `(x, y, uTime * uRotationSpeed + uSeed)` for nebula density.
2. Map density through palette: dark purple at 0.0 → magenta mid-band → cyan-blue at 0.95+.
3. Generate stars via hash-of-pixel-position thresholded by `uStarDensity`. Each star's brightness `= sin(uTime * uTwinkleRate + hash) * 0.5 + 0.5`.
4. Composite stars over nebula with additive blending.

Reference frame: frame 60 (mid-rotation, canonical star configuration per seed).

## Rules
- Use as backdrop for premium product launches, "future-of-X" announcements, sci-fi register overlays.
- Pair with prestige-creator (T-520) titles for cinematic intro. Pair with cluster-I AudienceAiPrompt clips when the prompt is forward-looking ("what will the future look like…").
- Recommended `uStarDensity`: 0.5–0.8. Above 0.85 the field competes with foreground text.
- `uTwinkleRate` ≥ 1.5 is photosensitivity-aggressive — verify against WCAG 2.3.1 flash guidelines before deploy.

## Acceptance (parity)
Reference frame 60; PSNR ≥ 35 dB / SSIM ≥ 0.97 vs golden.

## Trade-offs
- 3D simplex noise costs more fragment cycles than 2D fractal noise (T-aurora-borealis). Acceptable on M-class GPUs; deferred quality-dial would let producers swap to 2D fallback.
- Star twinkle uses a pure-sine pulse; per-star randomized waveform deferred.
- Procedural nebula color ramp is fixed at three stops (purple → magenta → cyan); 5-stop ramp deferred to T-532a-family.

## Out of scope
- The actual GLSL source — lands downstream.
- Camera dolly (forward motion through the nebula vs. fixed-distance rotation) — deferred carve-out.
- HDR / wide-gamut output — capped to sRGB.

## References
- T-383 (`ShaderClip` primitive)
- T-531 (Frontier Effects skeleton)
- ADR-012 §D5
- WCAG 2.3.1 (Three Flashes — `uTwinkleRate` guardrails)
