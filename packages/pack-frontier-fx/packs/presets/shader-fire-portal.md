---
id: shader-fire-portal
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

# Fire Portal shader

## Visual signature
Circular flame portal anchored in the center of the frame. Warm palette: deep red `#7F1D1D` (cool outer rim) → orange `#F97316` (mid) → bright yellow `#FBBF24` (hot inner edge) → white `#FFFFFF` (core). Pulsing radial flames whip outward from the central ring; portal "breathes" with a slow expansion-contraction cycle. High-energy, urgency / breaking-news / sports-finale register.

## Uniforms
- `uTime` (float): drives flame turbulence + breathing pulse.
- `uIntensity` (float, 0..1, default 0.85): overall heat. 0 = embers; 1 = full inferno.
- `uPortalRadius` (float, 0.1..0.5, default 0.3): portal size as a fraction of the shorter frame dimension.
- `uBreathRate` (float, 0..2, default 0.7): pulse frequency. 0 = static; 2 = panicked.
- `uTurbulence` (float, 0..2, default 1.0): how chaotic the flame edges read. 0 = candle-flame still; 2 = blast-furnace chaotic.
- `uSeed` (integer, default 37): randomizes turbulence offsets.

## Animation
Continuous loop. Per frame:
1. Compute polar distance + angle from each pixel to portal center.
2. Sample 2D turbulent-noise field at `(angle * 8, uTime * uTurbulence + uSeed)` for radial flame perturbation.
3. Modulate effective portal radius by `uPortalRadius * (1.0 + 0.15 * sin(uTime * uBreathRate))` (breathing pulse).
4. Map distance-vs-radius through palette: black far away → deep red just outside → orange → yellow → white at the inner edge.
5. Add additive bloom on white-core pixels.

Reference frame: frame 60 (mid-cycle pulse + canonical turbulence per seed).

## Rules
- High-energy / urgency register. Use for sports finale countdowns, breaking-news stingers, AudienceAiPrompt "generating…" indicators.
- Strong photosensitivity guardrails: `uBreathRate` ≥ 1.5 OR `uTurbulence` ≥ 1.5 require WCAG 2.3.1 review before deploy.
- Pair with cluster-I LiveQuiz countdown shots; pair with Sports Networks (T-511..T-515) overtime / clutch moments.
- Do NOT use behind text-dense content — the flame motion competes severely.

## Acceptance (parity)
Reference frame 60; PSNR ≥ 32 dB / SSIM ≥ 0.94 (turbulent flame edges are the most precision-sensitive of the five shaders; relaxed tolerance accordingly).

## Trade-offs
- Bloom kernel is fixed 7×7; brighter cores would benefit from larger kernel but at higher fragment cost.
- Palette stops are fixed at 4; 5-stop palette (adding deep magenta between deep red and outer dark) is a future carve-out for "cooler" portal variants.
- Portal must be centered — off-center portal position is deferred.

## Out of scope
- Actual GLSL source — downstream task.
- Particle ember spawning around the portal — defer to T-534 (ReactionStream physics) if cross-clip composition is wanted.
- Time-of-day variants (sunset fire / midnight fire) — deferred.

## References
- T-383 (`ShaderClip` primitive)
- T-531 (Frontier Effects skeleton)
- WCAG 2.3.1 (Three Flashes — photosensitivity guardrails)
