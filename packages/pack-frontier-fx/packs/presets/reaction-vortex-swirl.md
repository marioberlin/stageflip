---
id: reaction-vortex-swirl
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

# Reaction Vortex Swirl

## Visual signature
Particles caught in a rotating vortex centered on the frame: ~160 active particles trace spiraling paths around the frame center, with radius pulsing in/out as they rotate. Each particle completes 2–3 full rotations across its lifetime before dissipating outward. Palette is deep purple `#7C3AED` core fading to electric pink `#EC4899` at trailing tails — produces a chromatic-violet swirl read on a transparent backdrop. Mood: chaotic, kinetic, dance-music register, sci-fi club aesthetic.

## Particle props
- Count: ~160 active particles steady-state, distributed across 3 angular phase groups (60° / 180° / 300° initial offsets).
- Lifetime: 2.4 s per particle (long enough for 2–3 full rotations at the mid-orbit angular velocity).
- Spawn rate: 65 particles/s seeded at the vortex inner radius; despawn occurs when a particle's radius exceeds the dissipation envelope.
- Color palette: 2-stop linear blend along lifetime — purple `#7C3AED` at head (0–30% lifetime) → electric pink `#EC4899` at body (30–80%) → fading-pink alpha ramp (80–100%). Trail length = 8 frames decimated, additive-blend.
- Motion equation: `r(t) = r0 + r_pulse · sin(ω_radial · t)`, `θ(t) = θ0 + ω_angular · t`, where `ω_angular = 2.6 rad/s` (≈ 2.5 rotations across 2.4 s lifetime), `r_pulse = 40 px`, `ω_radial = 1.8 rad/s`. Outward drift over lifetime: `r_offset(t) = lifetime_progress · 80 px`. Particles dissipate when `r > min(frame_w, frame_h) × 0.45`.
- Vortex center: frame center `(frame_width/2, frame_height/2)`. Inner radius `r0 = 60 px`.

## Animation
Continuous loop. Per frame:
1. Spawn scheduler: emit `round(65/fps)` particles at the inner radius with random θ uniformly across `[0, 2π]` and assigned to one of the 3 angular phase groups.
2. For every active particle: advance `t = t + 1/fps`; compute `(r, θ)` from the motion equation; convert to Cartesian relative to vortex center.
3. Render particle as a 3 px purple-pink gradient disc; append 8-frame trail with 60% alpha decay per step; additive-blend.
4. Despawn particles with `lifetime ≥ 2.4 s` OR `r > dissipation_radius`.
5. Composite over transparent backdrop.

Reference frame for parity: frame 60 (= 2000 ms @ 30 fps; the three phase groups are in mid-rotation; canonical swirl pattern stabilized).

## Rules
- Use as chaotic / kinetic / dance-music register backdrop. Pair with cluster-i Heatmap (T-469) high-energy reveal moments, LiveQuiz (T-465) tense-suspense interstitials, music-vis frontier-fx renders.
- Recommended frame-time budget: 5 ms (mid-tier — more particles + trails than snow, fewer than fireworks at peak); 9 ms hard ceiling.
- WCAG 2.3.1 (Three Flashes): vortex rotation is continuous (not pulsing); the radial pulse runs at 1.8 rad/s ≈ 0.29 Hz radial-amplitude oscillation, far below the 3 Hz photosensitivity threshold. Pulse amplitude is contrast-bounded; flash-content rating: SAFE.
- WCAG 2.3.3 (Animation from Interactions): vortex rotation is not user-triggered; production-safe.
- Do NOT pair with any clip containing fast-cut horizontal pan — the combined motion fields trigger motion-sickness reports. Recommended for static or slow-pan host clips only.
- Pair with shader-cosmic-nebula (T-532) backdrop for sci-fi compound registers.

## Acceptance (parity)
Reference frame 60 captures the mid-rotation steady-state with 3 phase groups in canonical configuration and ~160 particles across all radii. Parity tolerance: PSNR ≥ 31 dB / SSIM ≥ 0.93. Loosest of the five reaction presets — long lifetimes (2.4 s) + trails + additive blend + rotational FP precision drift compound across renderer backends.

## Trade-offs
- The actual particle simulation lands in the frontier-runtime ReactionStream extension post-Track A. T-534 reserves the preset id + the design spec only.
- Vortex center is hardcoded to frame center. Off-center-vortex / multi-vortex configurations are deferred to a T-534a-family carve-out.
- Angular velocity `ω_angular = 2.6 rad/s` is fixed. Tenant-configurable rotation speed is deferred.
- 3 phase groups is fixed; tenant-configurable phase-group count deferred.

## Out of scope
- The actual particle physics implementation — downstream frontier-runtime task.
- Reverse-rotation variants — deferred.
- Audio-reactive rotation rate (vortex tempo-locks to BPM) — deferred to a cluster-I audio-bind extension post-Track A.
- 3D vortex (z-axis depth) — deferred.

## References
- T-470 (`reaction-stream` clip primitive)
- T-531 (Frontier Effects pack skeleton)
- T-532 (premium shader presets — sibling substantive cluster-i contributions)
- ADR-012 §D5 (preset contribution schema)
- WCAG 2.3.1 / 2.3.3 (photosensitivity + motion guardrails)
- Cluster I (Live Audience — host context)
