---
id: shader-aurora-borealis
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

# Aurora Borealis shader

## Visual signature
Smooth gradient sky waves in nordic-aurora colors — emerald `#10B981` → violet `#8B5CF6` → magenta-pink `#EC4899`. Slow vertical drift of luminous ribbons across a deep navy `#0F172A` backdrop. Soft Gaussian bloom on bright bands; subtle ground glow at the lower edge to imply horizon proximity. Mood: contemplative, ethereal, premium broadcast title overlay.

## Uniforms
- `uTime` (float): elapsed seconds since clip mount. Drives ribbon drift + noise scroll.
- `uIntensity` (float, 0..1, default 0.7): overall brightness of the auroral bands. 0 = barely visible; 1 = saturated.
- `uHueShift` (float, -1..1, default 0.0): rotates the palette through the green→violet→magenta range. -1 favors emerald; +1 favors magenta.
- `uSpeed` (float, 0..2, default 0.5): drift rate. 0.5 = slow contemplative; 1.0 = brisk; >1 = frenetic.
- `uSeed` (integer, default 7): noise-field offset; lets the same uniforms produce different ribbon shapes per deploy.

## Animation
Continuous loop. Per frame:
1. Sample 2D fractal-noise field offset by `uTime * uSpeed + uSeed` to derive ribbon iso-curves.
2. Map each iso-curve through the aurora palette (HSL interpolation, `uHueShift` rotates the hue range).
3. Apply Gaussian bloom (kernel 9×9, sigma 4) on bands above 0.7 luminance.
4. Composite over the navy backdrop; bottom 20% receives a 15% horizon-glow tint matching the dominant band hue.

Reference frame for parity: frame 60 (= 2000 ms @ 30 fps; mid-cycle drift; bands settled into canonical configuration).

## Rules
- Use as a hero-overlay backdrop behind cluster-I live-audience clips (poll bars, leaderboards, reaction streams) — the slow drift never competes with the foreground.
- Recommended `uIntensity` for production: 0.5 – 0.8. Above 0.9 the bloom blows out hot pixels on overlay-blend compositing.
- Pair with the prestige-creator preset (T-520) as a title-card backdrop; pair with cluster-I AudienceAiPrompt clips as the "thinking" / "live" indicator backdrop.
- Do NOT use behind dense text — the moving bands hurt readability. Use behind icon-driven or large-text overlays only.

## Acceptance (parity)
Reference frame 60 captures the mid-cycle steady-state with three primary ribbons visible. Parity tolerance: PSNR ≥ 35 dB / SSIM ≥ 0.97 (shader output is deterministic per `uTime` + `uSeed`).

## Trade-offs
- GLSL fragment source NOT shipped in the pack archive — production deployment ships the shader bundle separately via the frontier-runtime adapter surface. The pack reserves the preset id + uniform schema only.
- The bloom kernel is 9×9 (per the spec). Larger kernels would soften the bands further at the cost of fragment-shader cycles; deferred to a future shader-quality dial post-Track A.
- `uHueShift` is uniformly applied across all three primary hues. Per-ribbon hue-rotation control is a future carve-out for the shader-quality dial.

## Out of scope
- The actual GLSL source — lands in a downstream frontier-runtime task post-Track A.
- A `compositeMode: 'add' | 'screen' | 'normal'` knob — currently fixed to overlay-screen; deferred.
- Time-of-day variants (dawn aurora / midnight aurora) — deferred to a T-532a-family carve-out.

## References
- T-383 (`ShaderClip` primitive — clipKind this preset binds)
- T-531 (Frontier Effects pack skeleton)
- ADR-012 §D5 (preset contribution schema)
- Cluster I (Live Audience — host context for frontier-runtime overlays)
