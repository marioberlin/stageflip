---
'@stageflip/pack-frontier-fx': patch
---

T-534 — Frontier Effects Pack: seventh through eleventh substantive
contributions — **five premium ReactionStream particle physics
presets** binding the existing T-470 `reaction-stream` clip primitive
(cluster-I), replacing the T-531 `reactionstream-physics-placeholder`
slot. Each preset ships a distinct particle-physics behavior + design
spec (counts / lifetimes / motion equations / palette) — the actual
particle simulation lands in the frontier-runtime ReactionStream
extension post-Track-A; T-534 reserves the preset ids + design specs
only. The five presets are: `reaction-fireworks-burst` (8 burst points
× 32 particles = 256 peak; explosive-upward velocity + gravity decay +
multi-color tails; red `#EF4444` / orange `#F97316` / yellow `#FACC15`
/ white `#FFFFFF` palette; celebration / win-screen /
breaking-positive-news register), `reaction-snow-fall` (~120 active
particles; gentle downward `v_fall = 30 px/s` + noise-driven lateral
drift; white `#FFFFFF` + pale-blue `#BFDBFE` palette; serene /
holiday / classical-music register; zero-flash WCAG 2.3.1 SAFE
baseline), `reaction-vortex-swirl` (~160 active particles across 3
phase groups; rotational `ω_angular = 2.6 rad/s` around frame center
with `r_pulse = 40 px` radial oscillation; deep purple `#7C3AED` →
electric pink `#EC4899` palette; chaotic / kinetic / dance-music
register), `reaction-bubble-rise` (~80 mid-bubbles + ~40 foam-bubbles;
upward `v_rise = -80 px/s` + lateral wobble + pop-flourish at
`y < frame_height × 0.10`; pale-cyan `#7DD3FC` + white `#FFFFFF`
highlights; lighthearted / casual / underwater register), and
`reaction-magnetic-orbit` (~50 active particles in 4 concentric
elliptical rings with Keplerian-flavored angular velocities
`ω_0 = 1.2 rad/s` → `ω_3 = 0.45 rad/s`; cyan `#22D3EE` → magenta
`#D946EF` radial blend; closed-system steady-state, no spawns / no
despawns / persistent lifetime; sci-fi / tech-product-launch / cosmic
register; tightest parity tolerance of the five — PSNR ≥ 34 dB /
SSIM ≥ 0.96). All five declare cluster `cluster-i` and bind
`clipKind: reaction-stream` (the T-470 primitive shipped in P15
cluster-I). Reference frame for parity is frame 60 across all five
presets. Manifest's `contributes.presets` count grows from 8 to 12
(5 shaders + 1 3D + 5 reactions + 1 remaining `titlesequence-premium-
placeholder` for T-535). Manifest version remains 0.1.0 — T-535
carries the v0.2.0 GA bump that closes the Frontier Effects launch
pack.
