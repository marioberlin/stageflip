---
id: shader-data-stream
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

# Data Stream shader

## Visual signature
Matrix-style cascading character rain. Pure black `#000000` backdrop with vertical columns of glyphs falling top-to-bottom. Primary color teal `#14B8A6` (mid-stream) with bright white `#FFFFFF` highlights at column heads, fading to dark teal `#0F766E` at column tails. Glyph set: Katakana half-width + digits + Latin uppercase. Tech / data-driven / AI-aware register.

## Uniforms
- `uTime` (float): drives column fall rate + glyph cycle.
- `uIntensity` (float, 0..1, default 0.7): brightness of mid-stream glyphs. Heads stay near-white regardless.
- `uColumnDensity` (float, 0..1, default 0.6): fraction of columns active at any given time. 1.0 = every column active; 0.5 = half empty.
- `uFallSpeed` (float, 0..2, default 1.0): per-column drop rate in glyphs-per-second.
- `uGlyphChurn` (float, 0..1, default 0.4): rate at which individual glyphs swap within a column. 0 = static glyphs; 1 = every frame re-rolls.
- `uSeed` (integer, default 53): randomizes per-column phase + glyph selection.

## Animation
Continuous loop. Per frame:
1. Each column has a fixed `headY = uTime * uFallSpeed + columnOffset` modulo column height.
2. Pixels within `headY ± 1 glyph` render bright white (column head).
3. Pixels at `headY - n` render teal at brightness `(1 - n/tail-length) * uIntensity`.
4. Glyph selection per cell uses `hash(columnIdx, cellIdx, floor(uTime * uGlyphChurn))` mapped into the glyph palette.
5. Pixels outside any active column stay pure black.

Reference frame: frame 60 (mid-flow; canonical column phase per seed).

## Rules
- Tech / data / AI-driven register. Use for AudienceAiPrompt "loading", LiveQuiz "computing scores" interstitials, data-source ingestion shots, security-themed content.
- Recommended `uColumnDensity`: 0.4–0.7. Above 0.85 the field reads as noisy rather than data-driven.
- `uFallSpeed` ≥ 1.5 photosensitivity-aggressive when paired with `uGlyphChurn` ≥ 0.6 — WCAG 2.3.1 review required.
- Pair with cluster-I AudienceAiPrompt + Earnings & Investor (T-521..T-525) compute-time interstitials.
- Pair with Frontier Effects sibling: liquid-metal title card → data-stream interstitial → result reveal.

## Acceptance (parity)
Reference frame 60; PSNR ≥ 36 dB / SSIM ≥ 0.97 (sharp text edges are precision-friendly; tightest tolerance of the five shaders).

## Trade-offs
- Glyph palette is fixed at half-width Katakana + digits + Latin caps. Per-tenant glyph customization is a future carve-out.
- Column width is fixed at 16 px; tenant-customizable column width deferred.
- Single-color palette (teal). Multi-color column-by-column variants are a T-532a-family carve-out.

## Out of scope
- The actual GLSL source — downstream task.
- Reactive glyphs (column responds to live audio) — deferred to a cluster-I audio-bind extension post-Track A.
- 3D depth (parallax across multiple column-layers) — deferred.

## References
- T-383 (`ShaderClip` primitive)
- T-531 (Frontier Effects skeleton)
- WCAG 2.3.1 (Three Flashes — photosensitivity guardrails)
- Cluster I AudienceAiPrompt (companion clip family)
