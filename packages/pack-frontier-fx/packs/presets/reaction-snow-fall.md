---
id: reaction-snow-fall
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

# Reaction Snow Fall

## Visual signature
Gentle steady-state snowfall: ~120 active particles drift downward across the frame with subtle horizontal noise-driven drift. Particles are small soft-edged white discs `#FFFFFF` with pale-blue `#BFDBFE` highlights on the brighter half (mimicking ambient cool light). No bursts; no spawns clustered in time — the field is statistically uniform. Mood: serene, contemplative, holiday, classical-music register. Premium broadcast title-card backdrop register; reads as a calm wash beneath cluster-i reaction-streams without competing for attention.

## Particle props
- Count: 120 active particles, steady-state. Continuous spawn-at-top + despawn-at-bottom loop keeps the count constant.
- Lifetime: ~6.0 s per particle (frame_height / fall_speed = 1080 / ~180 px/s ≈ 6 s for top-to-bottom traversal at 1080p; actual lifetime ends when the particle exits the bottom of the frame).
- Spawn rate: 20 particles/s entering the top of the frame uniformly across the X axis; despawn rate matches.
- Color palette: 2-stop blend — primary white `#FFFFFF` (60% of disc) with pale-blue `#BFDBFE` highlight on the upper-left third (the implied light source). Alpha 0.85 at body, alpha 0.0 at the soft outer edge over a 2 px gradient.
- Motion equation: `v(t) = (drift(x, t), v_fall)` where `v_fall = 30 px/s` (gentle), and `drift(x, t) = 8 px/s · sin(0.6·t + x_phase)` using a deterministic per-particle phase. Particle size 3–5 px (uniform random per particle, deterministic from seed).

## Animation
Continuous loop. Per frame:
1. Spawn scheduler: emit `round(20/fps)` new particles at top edge (`y = -5 px`) with random X uniformly across `[0, frame_width]` and seeded random phase.
2. For every active particle: advance `y += v_fall / fps`; advance `x += drift(x, t) / fps`.
3. Render particle as a soft 3–5 px disc with white body + pale-blue upper-left highlight; alpha-blend (NOT additive — snow occludes background gently).
4. Despawn particles with `y > frame_height + 5 px`.
5. Composite over transparent backdrop.

Reference frame for parity: frame 60 (= 2000 ms @ 30 fps; field at steady-state with 120 particles distributed top-to-bottom).

## Rules
- Use as serene / holiday / classical-music backdrop. Pair with cluster-i WordCloud (T-467) reflective moments, AudienceAiPrompt (T-471) contemplative-question interstitials, year-end-recap LiveQuiz introductions.
- Recommended frame-time budget: 3 ms (lighter than fireworks-burst — fewer particles, no trails, alpha-blend not additive); 6 ms hard ceiling.
- Safe to layer behind body-copy lower-thirds — alpha-blended snow does not wash text. Maintain background contrast ≥ 4.5:1 on host-clip foregrounds.
- WCAG 2.3.1: zero flash content. Drift is below visible-motion threshold for vestibular-sensitive viewers; safe for production accessibility profile.
- Pair with shader-aurora-borealis (T-532) backdrop for premium nordic-winter title cards.

## Acceptance (parity)
Reference frame 60 captures the steady-state snow field with 120 particles distributed top-to-bottom and canonical drift phase. Parity tolerance: PSNR ≥ 33 dB / SSIM ≥ 0.95. Tighter than fireworks-burst (no trails / additive blending) but looser than shader presets (per-particle deterministic-RNG drift accumulates over 6 s lifetimes).

## Trade-offs
- The actual particle simulation lands in the frontier-runtime ReactionStream extension post-Track A. T-534 reserves the preset id + the design spec — runtime computation deferred. Drift function must use a deterministic seeded RNG so parity fixtures reproduce.
- Particle count is fixed at 120. Tenant-configurable density (sparser / denser) is deferred to a T-534a-family follow-up.
- Snow color is fixed at white + pale-blue highlight. Warm-tinted snow (golden-hour) is a future carve-out.
- No wind-gust events; only continuous noise-driven drift. Burst-wind reactivity is deferred.

## Out of scope
- The actual particle physics implementation — downstream frontier-runtime task.
- Snow-accumulation-on-bottom-edge (drifts piling at frame bottom) — deferred; would complicate determinism.
- Audio-reactive snowfall (snow-density responds to music tempo) — deferred to a cluster-I audio-bind extension.

## References
- T-470 (`reaction-stream` clip primitive)
- T-531 (Frontier Effects pack skeleton)
- T-532 (premium shader presets — sibling substantive cluster-i contributions)
- ADR-012 §D5 (preset contribution schema)
- WCAG 2.3.1 (Three Flashes — zero-flash baseline for accessibility profile)
- Cluster I (Live Audience — host context)
