---
id: shader-liquid-metal
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

# Liquid Metal shader

## Visual signature
Chromatic distortion shader with reflective gradient — mercury-silver `#E5E7EB` → steel-blue `#3B82F6` → chrome-pink `#F472B6`. Surface ripples as if a liquid metal sheet were being gently disturbed. Strong specular highlights on ripple peaks. Modern, premium-tech register (think Apple keynote backdrops, automotive luxury reveals).

## Uniforms
- `uTime` (float): drives ripple propagation + specular shimmer.
- `uIntensity` (float, 0..1, default 0.8): ripple amplitude. 0 = flat sheet; 1 = active surface.
- `uRippleScale` (float, 0..2, default 1.0): wave frequency. 0.5 = long undulations; 2 = tight ripples.
- `uChromaShift` (float, 0..1, default 0.3): per-channel offset for chromatic-aberration effect; 0 = no aberration; high values feel hyper-modern.
- `uSpecularPower` (float, 1..64, default 32.0): Phong-style highlight sharpness.
- `uSeed` (integer, default 21): displaces ripple origin points.

## Animation
Continuous loop. Per frame:
1. Compute ripple height at each pixel as the sum of N (=8) wave sources, each defined by `(originX, originY, radius=uTime * uRippleScale)`.
2. Compute surface normal from height gradient.
3. Light the surface with a fixed environment-map probe (sampled cubemap of a studio lighting rig).
4. Apply chromatic aberration: sample R, G, B channels at `uv ± uChromaShift * normal.xy`.
5. Add Phong specular per `uSpecularPower`.

Reference frame: frame 60 (mid-ripple cycle; canonical normal field per seed).

## Rules
- Premium-tech / luxury register. Use for product reveal title cards, brand-anniversary intros, high-end keynote opens.
- Pair with prestige-creator (T-520) titles + GT Sectra serif typography for editorial polish.
- Recommended `uChromaShift`: 0.2–0.5. Above 0.7 the aberration becomes a primary visual element rather than a polish layer.
- Do NOT use as a backdrop for audience-participation clips — the constant motion competes with poll bars / leaderboards.

## Acceptance (parity)
Reference frame 60; PSNR ≥ 33 dB / SSIM ≥ 0.95 (specular highlights are more sensitive to floating-point precision than smooth gradients; slightly relaxed tolerance vs aurora/nebula).

## Trade-offs
- Fixed studio-light cubemap baked into shader bundle. Tenant-customizable cubemap is a future carve-out.
- 8 wave sources is fixed; production deployments may want 4 (mobile-class GPUs) or 16 (cinema-class).
- Phong (not PBR) lighting model — physically-based shading deferred to T-532a-family.

## Out of scope
- The actual GLSL source — lands downstream.
- Custom cubemap upload via tenant asset pipeline.
- Real-time refraction (this is a reflective surface, not transparent).

## References
- T-383 (`ShaderClip` primitive)
- T-531 (Frontier Effects skeleton)
- T-520 (prestige-creator — typography pairing)
