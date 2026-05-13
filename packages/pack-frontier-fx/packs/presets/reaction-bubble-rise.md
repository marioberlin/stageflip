---
id: reaction-bubble-rise
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

# Reaction Bubble Rise

## Visual signature
Particles float upward like submerged bubbles: ~80 mid-size bubbles drift up from the lower edge, accompanied by smaller foam bubbles, with subtle lateral wobble. On reaching the top 10% of the frame, bubbles pop in a brief radial-burst flourish then dissipate. Palette is pale cyan `#7DD3FC` bubble body with white `#FFFFFF` rim-light highlights and a thin transparent core — the read is "underwater champagne." Mood: lighthearted, casual, celebratory-but-soft, underwater register.

## Particle props
- Count: 80 active mid-bubbles + ~40 small foam-bubbles steady-state = ~120 particles total.
- Lifetime: 4.0 s per mid-bubble (bottom-to-top traversal + 0.3 s pop) at 1080p; foam bubbles 1.5 s shorter lifetime.
- Spawn rate: 20 mid-bubbles/s + 27 foam-bubbles/s entering the bottom of the frame; despawn after the pop flourish.
- Color palette: bubble body pale-cyan `#7DD3FC` at 70% alpha; white `#FFFFFF` rim-light on the upper-third arc at 90% alpha; transparent center (visible at ≤ 20% alpha). Pop-flourish: 8-spoke radial burst in `#FFFFFF` fading to `#7DD3FC` over 200 ms.
- Motion equation: `v(t) = (wobble(t, x_phase), v_rise)` where `v_rise = -80 px/s` (negative = upward), `wobble(t, x_phase) = 12 px/s · sin(1.4·t + x_phase)`. Mid-bubble size 8–14 px diameter (uniform random per particle); foam-bubble size 2–5 px.
- Pop trigger: `y < frame_height × 0.10`.

## Animation
Continuous loop. Per frame:
1. Spawn scheduler: emit `round(20/fps)` mid-bubbles + `round(27/fps)` foam-bubbles at `y = frame_height + 5 px` with random X uniformly across `[0, frame_width]`.
2. For every active particle: advance `y += v_rise / fps`; advance `x += wobble(t, x_phase) / fps`.
3. Render bubble: pale-cyan body disc + white rim-light arc on the upper-third + transparent center; alpha-blend (NOT additive — bubbles occlude background softly).
4. When a bubble first enters the top 10% of the frame, transition to pop-flourish state: render 8-spoke radial burst over the next 200 ms (6 frames @ 30 fps); despawn after burst completes.
5. Despawn foam-bubbles when `y < frame_height × 0.10` (foam pops invisibly — no flourish).
6. Composite over transparent backdrop.

Reference frame for parity: frame 60 (= 2000 ms @ 30 fps; field at steady-state with first wave of bubbles popping at the top; foam bubbles distributed throughout).

## Rules
- Use as lighthearted / casual / underwater backdrop. Pair with cluster-i SurveyClip (T-468) friendly-survey moments, ReactionStream casual-emoji-flows, Word Cloud (T-467) post-prompt reveals.
- Recommended frame-time budget: 4 ms (mid-tier — 120 particles with simple alpha-blend, no trails, but pop-flourishes add transient cost); 7 ms hard ceiling.
- Safe to layer behind body-copy lower-thirds — alpha-blended bubbles do not wash text. Maintain background contrast ≥ 4.5:1 on host-clip foregrounds.
- WCAG 2.3.1: pop-flourish is a per-particle 200 ms event; aggregate flash rate over the field is ~20 pops/s but spatially distributed and each pop is sub-threshold luminance (peak white at 8-spoke center is 8 px wide; total integrated luminance is well below the 25% screen-area photosensitivity threshold). Flash-content rating: SAFE.
- Pair with shader-aurora-borealis (T-532) backdrop for nordic-aquarium / serene-celebration compound registers.

## Acceptance (parity)
Reference frame 60 captures the steady-state bubble field with ~120 particles across mid-bubbles + foam, plus 2–3 pop-flourishes in progress at the top. Parity tolerance: PSNR ≥ 32 dB / SSIM ≥ 0.94. Pop-flourishes are timing-sensitive — the parity gate must align frame 60 across renderer backends within ±1 frame.

## Trade-offs
- The actual particle simulation lands in the frontier-runtime ReactionStream extension post-Track A. T-534 reserves the preset id + the design spec only.
- Pop-flourish is a fixed 8-spoke radial. Per-tenant pop styles (heart-shaped, star-shaped) are deferred to a T-534a-family carve-out.
- Bubble size distribution is hardcoded as 8–14 px mid + 2–5 px foam. Tenant-configurable bubble-size range deferred.
- Rise speed is fixed at 80 px/s; tenant-configurable rise-speed deferred.

## Out of scope
- The actual particle physics implementation — downstream frontier-runtime task.
- Bubble-bubble collision physics (mid-bubbles bouncing off each other) — deferred; would complicate determinism.
- Audio-reactive bubble density (more bubbles during loud passages) — deferred to a cluster-I audio-bind extension post-Track A.
- 3D depth (parallax across bubble-layers) — deferred.

## References
- T-470 (`reaction-stream` clip primitive)
- T-531 (Frontier Effects pack skeleton)
- T-532 (premium shader presets — sibling substantive cluster-i contributions)
- ADR-012 §D5 (preset contribution schema)
- WCAG 2.3.1 (Three Flashes — photosensitivity guardrails)
- Cluster I (Live Audience — host context)
