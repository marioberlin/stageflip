---
'@stageflip/pack-frontier-fx': patch
---

T-533 — Frontier Effects Pack: sixth substantive contribution — the
**pre-licensed commercial-OK 3D asset library** (`3d-asset-library`)
replacing the T-531 placeholder slot. UNLIKE sister T-532 (premium
shader presets binding the `ShaderClip` primitive), T-533 is an
**assets contribution** — a manifest-level declaration per ADR-012 §D5
that seeds `manifest.contributes.assets` with eight pre-licensed
commercial-OK 3D asset references: `3d/podium-classic.glb` (three-
tiered awards podium with marble + gold trim, ~12k triangles),
`3d/stage-spotlight-set.glb` (truss + 4 animated spotlights with
KHR_materials_emissive_strength, ~24k triangles),
`3d/data-cube-rotating.glb` (glass data cube with
KHR_materials_transmission, ~8k triangles),
`3d/sphere-particles.glb` (parametric particle cloud on sphere
surface, ~4k triangles + ~2000 instanced particles),
`3d/celebration-confetti-burst.glb` (radial confetti spray, 2-second
keyframe animation, ~500 instances), `3d/handshake-icon-3d.glb`
(stylized corporate handshake, ~6k triangles),
`3d/award-trophy.glb` (gold-finish trophy with nameplate decal slot,
~10k triangles), `3d/ribbon-cut-scissors.glb` (ribbon + chrome
scissors with 3-second cut animation, ~14k triangles). All eight
assets are first-party work-for-hire commissions; StageFlip holds
both geometry and texture copyrights, sub-licensed to the tenant
under the `frontier-fx-1y` SKU's commercial-subscription terms with
commercial-OK royalty-free guarantee within the StageFlip render
envelope. The library declares one permission scope
(`assets:3d-library`) granted once per pack-install. **The actual
.glb byte payloads are NOT shipped in the pack archive** — they're
delivered per-tenant externally via the StageFlip CDN's per-tenant
3D-asset bucket (signed-URL-resolved at render time) per
commercial-3D-asset licensing audit-trail requirements. The
host-side 3D-asset-delivery integration (per-tenant signed-URL
resolver, render-time fetch discipline, audit-trail wiring) lands
in a future post-Track-A task; T-533 is manifest-side declaration
only — the forward reservation. The structural template mirrors
T-530's audio-bed library (different asset modality, same
`contributes.assets` + per-tenant-delivery model). Manifest version
remains 0.1.0 — T-535 carries the v0.2.0 GA bump that closes the
Frontier Effects launch pack. Manifest's `contributes.presets` count
remains 8 (5 substantive shaders + 1 substantive 3D asset library +
2 remaining placeholders for T-534 + T-535).
