---
id: reaction-fireworks-burst
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

# Reaction Fireworks Burst

## Visual signature
Particles explode upward like fireworks: 8 burst points along the lower 30% of the frame each emit 32 short-lived particles. Each particle launches with explosive initial velocity, decays under gravity, and trails a multi-color glow that fades to transparent over the lifetime. Palette anchored at red `#EF4444` / orange `#F97316` / yellow `#FACC15` core glow with white-hot `#FFFFFF` centers at the burst head. Mood: celebratory, high-energy, win-screen. Premium broadcast register — readable behind reaction streams without competing with lower-third foregrounds.

## Particle props
- Count: 8 burst points × 32 particles/burst = 256 active particles peak; ~120 average steady-state as bursts overlap.
- Lifetime: 1.2 s per particle (60% upward rise + 40% gravitational fall before alpha-out).
- Spawn rate: 1 burst every 0.5 s, cycled across the 8 burst points (round-robin); particle generation at burst is instantaneous.
- Color palette: 4-stop gradient — `#FFFFFF` (head, 0–10% of lifetime) → `#FACC15` (10–30%) → `#F97316` (30–60%) → `#EF4444` (60–100%, fading alpha 1.0 → 0.0). Per-particle hue jitter ±8° in HSL space.
- Motion equation: `v(t) = v0 + g·t` where `v0` is radial-upward (random cone within ±35° of vertical, magnitude 280–360 px/s) and `g = (0, +340 px/s²)`. Trail length = 5 prior frames decimated, additive-blend.
- Burst origin distribution: 8 evenly-spaced X coordinates across frame width, Y at frame_height × 0.78.

## Animation
Continuous loop. Per frame:
1. Round-robin burst scheduler triggers the next burst point if `frame % 15 == 0` (30 fps × 0.5 s cadence). Burst seeds 32 particles at origin with per-particle randomized velocity vector.
2. For every active particle: advance position by `v0 + g·t`; advance lifetime; sample palette by normalized lifetime.
3. Render particle as a 4 px radial-gradient quad with additive blending; append the 5-frame trail behind it at 50% alpha decay per step.
4. Particles with `lifetime ≥ 1.2 s` are despawned.
5. Composite over transparent backdrop (host clip provides the live foreground).

Reference frame for parity: frame 60 (= 2000 ms @ 30 fps; bursts 0..3 of the round-robin have fired; ~120 particles in flight; canonical celebratory steady-state).

## Rules
- Use as celebration / win-screen / breaking-positive-news overlay. Pair with cluster-i Leaderboard (T-466) winner-reveal moments and LiveQuiz (T-465) right-answer screens.
- Recommended frame-time budget: 4 ms on the frontier-runtime particle compositor; 8 ms hard ceiling.
- Do NOT use during dense-text overlays — additive-blend bursts wash light text. Cap luminance at 0.8 if the host clip foreground contains body copy.
- WCAG 2.3.1 (Three Flashes): burst-point cadence is 2 Hz overall (0.5 s × 4 sequential bursts before any single point repeats); below the 3 Hz general-flash threshold. Per-burst exposure-duration ≤ 200 ms keeps luminance flash below the photosensitivity envelope.
- Pair with reaction-snow-fall (T-534 sibling) for celebratory-then-serene transitions, or with shader-fire-portal backdrop (T-532) for breaking-positive-news.

## Acceptance (parity)
Reference frame 60 captures the canonical 4-bursts-fired steady-state with ~120 particles in mixed lifetimes (heads + tails + falling decay). Parity tolerance: PSNR ≥ 32 dB / SSIM ≥ 0.94. Tolerance loosens vs. shader presets because particle position uses a deterministic-but-noise-driven RNG seeded from `(frame, burstIdx, particleIdx)` and floating-point precision drift across renderer backends accumulates over 1.2 s lifetimes.

## Trade-offs
- The actual particle-physics simulation lands in the frontier-runtime ReactionStream extension post-Track-A. T-534 reserves the preset id + the design spec (counts / lifetimes / motion equations / palette) — runtime computation deferred. Implementations must match the spec's deterministic-RNG seeding scheme so parity fixtures are reproducible.
- Trail length is fixed at 5 frames. A motion-blur quality dial (per-tenant config) is a future carve-out.
- Burst-point count is fixed at 8. Tenant-customizable burst-density is deferred to a T-534a-family follow-up.
- Additive blend mode is hardcoded. Multiply / screen variants for darker host clips are deferred.

## Out of scope
- The actual particle physics implementation — lands in a downstream frontier-runtime ReactionStream task post-Track A.
- Audio-reactive burst triggering (burst-on-applause) — deferred to a cluster-I audio-bind extension post-Track A.
- Per-tenant palette overrides — deferred to a shader-quality dial.

## References
- T-470 (`reaction-stream` clip primitive — clipKind this preset binds)
- T-531 (Frontier Effects pack skeleton)
- T-532 (premium shader presets — sibling substantive cluster-i contributions)
- ADR-012 §D5 (preset contribution schema)
- WCAG 2.3.1 (Three Flashes — photosensitivity guardrails)
- Cluster I (Live Audience — host context for reaction-stream overlays)
