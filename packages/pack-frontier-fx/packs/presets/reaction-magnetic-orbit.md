---
id: reaction-magnetic-orbit
cluster: cluster-i
clipKind: reaction-stream
parityFixture: pending-user-review
signOff:
  parityFixture: pending-user-review
  typeDesign: na
ownerTask: T-534
relatedTasks:
  - T-531
  - T-470
status: substantive
---

# Reaction Magnetic Orbit

## Visual signature
Particles orbit a center point along elliptical paths arranged in 3–4 concentric rings: ~50 active particles distributed across the rings, each ring rotating at a different angular velocity (inner faster, outer slower — Keplerian-flavored read). Ring planes tilt slightly off-axis to expose orbital ellipticity. Palette is bright cyan `#22D3EE` for inner-ring particles + magenta `#D946EF` for outer-ring particles with smooth radial blend between rings. Mood: sci-fi, tech-product launch, cosmic-precision register. Premium broadcast title-card backdrop register.

## Particle props
- Count: ~50 active particles steady-state, distributed across 4 rings — `ring_0` (innermost): 8 particles; `ring_1`: 12 particles; `ring_2`: 14 particles; `ring_3` (outermost): 16 particles.
- Lifetime: persistent — particles do not despawn. The field is closed-system steady-state (the magnetic-orbit metaphor is exact: no escape, no decay).
- Spawn rate: 50 particles spawned once at clip-mount; no further spawns under nominal operation. (If a particle is missing due to renderer-backend drift, the spawn scheduler re-seeds at the canonical orbital position at frame 0.)
- Color palette: radial blend by ring index — `#22D3EE` (ring_0) → `#67E8F9` (ring_1) → `#F0ABFC` (ring_2) → `#D946EF` (ring_3). Each particle has a 2 px white `#FFFFFF` rim-light at 60% alpha to imply specular highlight.
- Motion equation: per-particle, `θ_i(t) = θ_i0 + ω_ring(ring_i) · t` where angular velocities are `ω_0 = 1.2 rad/s` (innermost), `ω_1 = 0.85 rad/s`, `ω_2 = 0.62 rad/s`, `ω_3 = 0.45 rad/s` (outermost). Ring radii: `r_0 = 80 px`, `r_1 = 140 px`, `r_2 = 210 px`, `r_3 = 290 px`. Elliptical ratio `a/b = 1.12` per ring, with per-ring rotation offset `α_ring` of 0°, 22.5°, 45°, 67.5° respectively. Position: `(x, y) = center + (a · cos(θ) · cos(α) - b · sin(θ) · sin(α), a · cos(θ) · sin(α) + b · sin(θ) · cos(α))`.
- Orbit center: frame center `(frame_width/2, frame_height/2)`.

## Animation
Continuous loop. Per frame:
1. Spawn check at frame 0: seed all 50 particles at canonical `θ_i0` positions (`θ_i0 = i · 2π / N_ring` per ring). Idempotent — re-seeds only if particle is missing.
2. For every active particle: advance `θ_i = θ_i0 + ω_ring(ring) · t`; compute position via elliptical motion equation.
3. Render particle as a 3 px ring-colored disc + 2 px white rim-light at 60% alpha; alpha-blend (NOT additive — orbit-particles are discrete and precise, not glowy).
4. Optional: render a faint 1 px elliptical path trace per ring at 12% alpha to imply the orbital track (configured ON for hero-shot variants, OFF for backdrop use — default: OFF).
5. Composite over transparent backdrop.

Reference frame for parity: frame 60 (= 2000 ms @ 30 fps; rings have completed `(2.0 / (2π / ω))` rotations — ring_0 ≈ 0.38 rotations, ring_3 ≈ 0.14 rotations — canonical post-mount configuration).

## Rules
- Use as sci-fi / tech-product-launch / cosmic-precision backdrop. Pair with cluster-i Leaderboard (T-466) algorithmic-ranking reveals, AudienceAiPrompt (T-471) processing-state interstitials, Earnings & Investor (T-521..T-525) sci-fi-data-vis-flavored decks.
- Recommended frame-time budget: 2 ms (lightest of the five reaction presets — fixed 50 particles, no trails, no spawns, no pops); 4 ms hard ceiling.
- Safe to layer behind body-copy lower-thirds — alpha-blended orbit particles are sparse and discrete; do not wash text.
- WCAG 2.3.1: zero-flash content. Orbital motion is continuous and below the 3 Hz flash threshold (`ω_0 = 1.2 rad/s ≈ 0.19 Hz`). Flash-content rating: SAFE.
- WCAG 2.3.3: orbital motion is not user-triggered; production-safe.
- Pair with shader-cosmic-nebula (T-532) backdrop for full sci-fi cosmic register, or shader-data-stream (T-532) for AI-precision launch shots.

## Acceptance (parity)
Reference frame 60 captures the canonical post-mount steady-state with all 4 rings in mid-rotation at their assigned angular velocities. Parity tolerance: PSNR ≥ 34 dB / SSIM ≥ 0.96. Tightest of the five reaction presets — deterministic closed-system (no spawn-RNG, no lifetime-end RNG, no trail-decimation drift); the only drift source is FP precision on the trig calls.

## Trade-offs
- The actual particle simulation lands in the frontier-runtime ReactionStream extension post-Track A. T-534 reserves the preset id + the design spec — the equation is fully specified so reproduction is unambiguous.
- 4 rings is fixed. Tenant-configurable ring count (2–8) is deferred to a T-534a-family carve-out.
- Ring radii are hardcoded for the 1920×1080 reference. The motion-equation runtime must scale radii proportionally for non-16:9 aspect ratios; that scaling rule is part of the spec.
- Elliptical ratio is fixed at 1.12 per ring. Per-ring eccentricity variation is deferred.
- Path-trace alpha is hardcoded at 12% (when ON). Tenant-configurable trace intensity is deferred.

## Out of scope
- The actual particle physics implementation — downstream frontier-runtime task.
- Out-of-plane orbits (3D perspective with z-axis tilt of ring planes) — deferred to a 3D-particles extension post-Track A.
- Audio-reactive ring-rotation tempo-lock — deferred to a cluster-I audio-bind extension post-Track A.
- Inter-ring particle migration — deferred (would break the closed-system property + parity-determinism).

## References
- T-470 (`reaction-stream` clip primitive)
- T-531 (Frontier Effects pack skeleton)
- T-532 (premium shader presets — sibling substantive cluster-i contributions)
- T-533 (3D asset library — sibling substantive cluster-i contribution)
- ADR-012 §D5 (preset contribution schema)
- WCAG 2.3.1 / 2.3.3 (zero-flash + non-interaction-motion guardrails)
- Cluster I (Live Audience — host context)
