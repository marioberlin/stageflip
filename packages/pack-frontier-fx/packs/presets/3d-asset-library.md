---
id: 3d-asset-library
cluster: cluster-i
clipKind: na
parityFixture: na
source: Khronos glTF 2.0 binary (.glb) canonical asset envelope + StageFlip first-party 3D-asset commissions under work-for-hire from session 3D-artist collaborators + commercial-OK royalty-free licensing model parallel to T-530's SoundExchange-style audio-bed library
status: substantive
permissions:
  - assets:3d-library
signOff:
  parityFixture: na
  typeDesign: na
ownerTask: T-533
relatedTasks:
  - T-531
  - T-532
  - T-534
  - T-535
---

# Pre-licensed 3D asset library — assets contribution slot

Sixth substantive contribution in the Frontier Effects pack (skeleton
landed T-531; five premium shader presets landed T-532). UNLIKE sister
T-532 (premium shader presets binding the `ShaderClip` primitive), T-533
is an **assets contribution** — a manifest-level declaration via
`contributes.assets` that reserves eight pre-licensed commercial-OK 3D
asset references under the Frontier Effects pack's asset scope. The
mechanism is the same one T-530 introduced for the Wedding & Events
pack's audio-bed library: per ADR-012 §D5, `manifest.contributes.assets`
is a parallel surface to `contributes.presets` /
`contributes.clipKinds` / `contributes.fonts` / `contributes.fixtures` /
`contributes.tools` / `contributes.adapters` /
`contributes.themePacks`; each entry has shape
`{ path: string; mimeType: string }` (per `packAssetContributionSchema`
in `packages/pack-format/src/manifest.ts`). T-533 seeds the array with
eight entries — one per canonical premium-3D use case across the
frontier-effects register (podium, stage spotlight rig, data cube,
particle sphere, confetti burst, handshake icon, award trophy, ribbon
cut) — all keyed under the `3d/` archive subpath with the
`model/gltf-binary` MIME type.

## Assets

The library declares eight pre-licensed commercial-OK 3D assets
spanning the canonical premium-broadcast / corporate-event /
product-reveal lifecycle that the Frontier Effects pack targets. Each
asset is a forward reservation under the `3d/` subpath; the actual
.glb byte payload is delivered to the tenant externally per the
Trade-off documented below.

### `3d/podium-classic.glb`

**Scope.** Classical-style podium (three-tiered awards podium with
marble-finish material and gold-trim accents) for awards / announcement
register. Geometry: ~12k triangles; bounding box ~2.5m × 2.5m × 1.5m.
Use case: cluster-i live-audience leaderboard reveal moments; pairs
with the T-466 Leaderboard clip as the "top-N winners" reveal
backdrop.

**Encoding.** Khronos glTF 2.0 binary (`.glb`) / PBR materials
(metallic-roughness workflow) / 2K KTX2-compressed albedo + normal +
ORM textures embedded.

**Licensing.** Commissioned under work-for-hire from a first-party
3D-artist collaborator; commercial-OK royalty-free rights held by
StageFlip and sub-licensed to the Frontier Effects Pack tenant under
the `frontier-fx-1y` SKU's commercial-subscription terms. No external
clearance required at the tenant render site.

### `3d/stage-spotlight-set.glb`

**Scope.** Spotlight rig stage scene (truss frame + 4 spotlight
fixtures with cone-of-light geometry + stage floor) for
broadcast-quality stage-reveal register. Geometry: ~24k triangles
(stage spotlights animated via embedded glTF KHR_animation_pointer
extension); bounding box ~6m × 4m × 5m. Use case: cluster-i live-event
broadcast title-card backdrop; pairs with the T-321 TitleSequence clip
as the "stage reveal" envelope.

**Encoding.** Same `.glb` envelope; spotlight cones use the
KHR_materials_emissive_strength extension for HDR-bloom-friendly
output.

**Licensing.** Same first-party work-for-hire scope.

### `3d/data-cube-rotating.glb`

**Scope.** Rotating glass data-cube (transparent-glass material with
inscribed grid lines + suspended data-point particles) for product
reveal / data-driven storytelling register. Geometry: ~8k triangles;
bounding box ~1.5m × 1.5m × 1.5m. Use case: cluster-finance / cluster-i
product-reveal moments; pairs with the T-471 AudienceAiPrompt clip as
the "thinking" / "live data" indicator backdrop.

**Encoding.** Same `.glb` envelope; transparent-glass material uses
the KHR_materials_transmission extension for physically-based glass
refraction.

**Licensing.** Same first-party work-for-hire scope.

### `3d/sphere-particles.glb`

**Scope.** Particle-sphere with bloom (parametric particle cloud
arranged on a sphere surface with HDR-emissive points + animated
inhale / exhale breathing motion) for sci-fi / frontier register.
Geometry: ~4k triangles + ~2000 instanced particle billboards;
bounding box ~3m × 3m × 3m. Use case: cluster-i AudienceAiPrompt clips
as the "AI thinking" indicator; pairs with the
`shader-cosmic-nebula` preset (T-532) as the foreground geometry over
the nebula backdrop.

**Encoding.** Same `.glb` envelope; particle billboards use the
KHR_materials_emissive_strength extension for bloom-friendly output.

**Licensing.** Same first-party work-for-hire scope.

### `3d/celebration-confetti-burst.glb`

**Scope.** Animated confetti burst geometry (radial spray of ~500
instanced confetti-piece meshes with embedded keyframe animation
spanning 60 frames at 30 fps = 2-second burst) for celebration /
reveal-moment register. Geometry: ~1.5k triangles per instance × 500
instances; bounding box expands ~0 to ~6m radius over the 2-second
animation. Use case: cluster-i live-event celebration moments; pairs
with the T-466 Leaderboard "winner announce" peak frame.

**Encoding.** Same `.glb` envelope; animation embedded via glTF
KHR_animation_pointer extension targeting per-instance position +
rotation channels.

**Licensing.** Same first-party work-for-hire scope.

### `3d/handshake-icon-3d.glb`

**Scope.** Corporate-handshake icon (two stylized hands clasped, gold
metallic-finish, pedestal-mounted) for partnership / deal-announcement
register. Geometry: ~6k triangles; bounding box ~1m × 1m × 1.2m. Use
case: cluster-finance investor-deck partnership-announcement slot;
pairs with the T-523 finance-investor-deck preset as the icon for the
"strategic partnerships" section.

**Encoding.** Same `.glb` envelope; PBR metallic-roughness workflow.

**Licensing.** Same first-party work-for-hire scope.

### `3d/award-trophy.glb`

**Scope.** Generic gold-finish trophy (two-handled cup on a square
plinth, gold metallic finish, room for a sub-pedestal nameplate decal)
for awards / recognition register. Geometry: ~10k triangles; bounding
box ~0.5m × 0.5m × 1.2m. Use case: cluster-i Leaderboard top-1
moment; pairs with the `podium-classic.glb` asset as the
trophy-on-podium peak-reveal composition.

**Encoding.** Same `.glb` envelope; PBR metallic-roughness workflow
with sub-pedestal nameplate decal slot reserved via a named glTF
material slot (`nameplate-decal`) for tenant-side dynamic text
binding.

**Licensing.** Same first-party work-for-hire scope.

### `3d/ribbon-cut-scissors.glb`

**Scope.** Opening-ceremony ribbon + scissors (red ribbon stretched
between two posts + oversized chrome ceremonial scissors mid-cut, with
embedded keyframe animation spanning 90 frames at 30 fps = 3-second
ribbon-cut sequence) for opening-ceremony / launch register. Geometry:
~14k triangles; bounding box ~3m × 1m × 2m. Use case: cluster-i
live-event launch / opening moments; pairs with the T-321
TitleSequence clip as the "grand opening" reveal envelope.

**Encoding.** Same `.glb` envelope; animation embedded via glTF
KHR_animation_pointer extension targeting scissor-blade rotation +
ribbon cloth-simulation baked vertex displacement channels.

**Licensing.** Same first-party work-for-hire scope.

## Asset paths

All eight paths are keyed under the `3d/` subpath of the pack
archive — `3d/podium-classic.glb`, `3d/stage-spotlight-set.glb`,
`3d/data-cube-rotating.glb`, `3d/sphere-particles.glb`,
`3d/celebration-confetti-burst.glb`, `3d/handshake-icon-3d.glb`,
`3d/award-trophy.glb`, `3d/ribbon-cut-scissors.glb`. The host-side
asset resolver (`packages/host-config/`) reads
`manifest.contributes.assets[].path` to expose the reservation surface
to the tenant install UI; the actual .glb bytes resolve at render time
through the tenant's external-delivery channel (see Trade-offs below).

## Permissions

The library declares **one** permission scope that a tenant must grant
before the 3D assets may resolve at render time:

- **`assets:3d-library`** — required to admit the 3D asset library
  into the tenant's render-side asset registry. Same connector-card
  permission model as T-524's `data-source:bloomberg-pro`, T-525's
  `llm:tool-bundle:finance-domain`, and T-530's `assets:audio-bed`;
  surfaced to the tenant once per pack-install, not per-asset.

The pack-installer surface prompts the tenant for the grant during
install; the host short-circuits to a fallback (geometry-omitted /
placeholder-cube) render for any asset that cannot resolve its asset
path at render time.

## Trade-offs

- **.glb bytes NOT in the pack archive.** Per the Frontier Effects
  SKU's commercial-3D-asset licensing terms (which are broker-mediated
  via the StageFlip 3D-asset-bucket surface to allow per-tenant
  delivery records + audit trails for asset reuse), the actual .glb
  byte payload for each asset is delivered to the tenant via an
  **external per-tenant delivery channel** — the StageFlip CDN's
  per-tenant 3D-asset bucket, signed-URL-resolved at render time —
  NOT bundled in the pack archive itself. The pack archive ships only
  the manifest reservation; the bytes are NOT byte-fingerprinted into
  `manifest.integrity.hash` (which is SHA-256 over the archive bytes
  WITHOUT the manifest, per the standard pack-format envelope). This
  is a deliberate separation: commercial 3D-asset licensing
  audit-trail requirements track per-tenant download records (who
  downloaded which asset, when, against which SKU instance), and
  bundling the bytes in the archive would conflict with that audit
  model. The trade-off is identical in shape to T-530's audio-bed
  library — different licensing regime (commercial-3D vs.
  mechanical-licensing), same per-tenant-delivery solution.
- **3D-asset-delivery integration deferred.** The actual host-side
  per-tenant 3D-asset bucket resolver, signed-URL surface, render-time
  fetch discipline, and audit-trail wiring lands in a future task
  (forward-reference; NOT in scope for T-533). Until that task lands,
  consumers of these asset paths get a fixture-replay /
  placeholder-cube fallback at render time; the pack manifest's
  `contributes.assets` declaration is the **forward reservation** —
  the asset-delivery channel is the **runtime binding**; the two are
  wired post-Track-A. The Frontier Effects pack does NOT bump to
  v0.2.0 on T-533's merge because the sibling T-534 / T-535 fills are
  still pending — T-535 carries the v0.2.0 GA bump that closes the
  launch pack.
- **Commercial-OK royalty-free licensing scope.** All eight assets
  are commissioned under work-for-hire from first-party 3D-artist
  collaborators; StageFlip holds both the geometry copyright AND the
  texture copyright. Tenants that re-distribute the .glb files
  outside the StageFlip render envelope (e.g. extracting the .glb and
  hosting it on a third-party 3D-asset marketplace) take on
  attribution + re-distribution obligations themselves; the pack
  license does NOT grant re-distribution rights outside
  StageFlip-rendered output. Within the render envelope, no
  royalty / attribution / per-render-fee obligation applies — that is
  the "commercial-OK" guarantee.
- **glTF 2.0 binary (.glb) format.** All eight assets ship as glTF
  2.0 binary (`.glb`) with embedded KTX2-compressed textures (2K
  resolution standard; 4K variants are a future post-Track-A SKU
  upgrade). Tenants needing other 3D formats (FBX / OBJ / USDZ) must
  source them externally and bind them through the future
  3D-asset-delivery integration's per-tenant custom-asset slot. The
  glTF 2.0 binary choice is the canonical Khronos-Group format and
  is the format the cluster-i frontier-runtime three.js consumer
  natively loads.
- **PBR metallic-roughness workflow.** All eight assets use PBR
  metallic-roughness materials per the glTF 2.0 core spec; specular-
  glossiness workflow is NOT supported. Tenants overriding the
  material workflow via the host's render-config surface MUST verify
  the output level manually — the pack's material slots are the
  default, not a hard guarantee against tenant-side overrides.
- **No baked lighting.** All eight assets ship with PBR materials
  only — no baked lighting / shadow maps are embedded. The host-side
  cluster-i three.js renderer applies IBL (image-based lighting) at
  render time per the live-audience render-config defaults. Tenants
  rendering into non-IBL environments MUST supply their own lighting
  binding through the host's render-config surface.
- **No rigged characters.** All eight assets are static or
  keyframe-animated geometry only — no skeletal-rigged characters are
  in scope. Skeletal-rigged character assets carry additional
  motion-capture licensing complexity (actor royalty obligations,
  performance-rights canon for recognizable mocap performers) that
  the work-for-hire scope here deliberately avoids. Tenants needing
  rigged characters must source them externally and bind them
  through the future 3D-asset-delivery integration's per-tenant
  custom-asset slot.

## Out of scope

- **The actual .glb byte payloads** — delivered per-tenant externally
  via the StageFlip CDN's per-tenant 3D-asset bucket; NOT bundled in
  the pack archive. The pack-archive integrity hash covers the
  manifest reservation only.
- **The host-side 3D-asset-delivery integration** — per-tenant
  signed-URL resolver, render-time fetch discipline, audit-trail
  wiring, commercial-3D-licensing audit-trail surface — lands in a
  future task post-Track-A. T-533 is manifest-side declaration only.
- **4K texture variants** — not in scope per the 2K standard design
  choice; future post-Track-A SKU upgrade surface for 4K-texture
  scope.
- **FBX / OBJ / USDZ format variants** — not in scope per the glTF
  2.0 binary canonical-format design choice; future
  3D-asset-delivery integration's per-tenant custom-asset slot is
  the binding surface for non-glTF formats.
- **Skeletal-rigged character assets** — not in scope per the
  static / keyframe-only design choice; future 3D-asset-delivery
  integration's per-tenant custom-asset slot is the binding surface
  for rigged characters.
- **Re-distribution rights outside StageFlip-rendered output** — the
  pack license does NOT grant re-distribution rights; the bytes
  remain proprietary to StageFlip outside the render envelope.
- **Live binding into T-532 shader presets** — the five
  T-532 shader presets currently declare uniform schemas without
  3D-asset binding markers. Live binding via these asset paths
  lands at the future 3D-asset-delivery integration task with the
  `assets:3d-library` permission scope as the tenant-grant gate.

## References

- ADR-012 §D2 — pack manifest schema
  (`packContributionsSchema.assets` shape:
  `z.array(packAssetContributionSchema).optional()`)
- ADR-012 §D5 — asset contributions
  (`packAssetContributionSchema`:
  `{ path: z.string().min(1), mimeType: z.string().min(1) }`)
- ADR-013 §D3 — paid-per-tenant commercial-subscription tier
  (`frontier-fx-1y` SKU; the Frontier Effects pack's license tier
  carries the 3D-asset-library entitlement)
- Khronos glTF 2.0 specification — canonical .glb binary envelope
  + KHR_animation_pointer + KHR_materials_emissive_strength +
  KHR_materials_transmission extensions
- KTX2 (Khronos Texture 2) — canonical compressed-texture format
  embedded in the .glb files
- T-383 (`ShaderClip` primitive — sibling cluster-i runtime
  primitive; T-532 shader presets are the visual-shader counterpart
  to this T-533 3D-asset library)
- T-437 (three.js scene consumer — cluster-i frontier-runtime
  consumer of glTF 2.0 binary geometry; the runtime binding for
  these asset paths)
- T-530 — Wedding & Events pack's pre-licensed audio bed library
  (the structural template T-533 mirrors — different asset modality,
  same `contributes.assets` + per-tenant-delivery model)
- T-531 — Frontier Effects pack skeleton (this preset's parent pack;
  landed the original placeholder slot for T-533)
- T-532 — Premium shader presets (sibling cluster-i preset bundle;
  visual-shader counterpart to this 3D-asset library)
- T-534 — Premium ReactionStream particle physics presets (pending;
  next sibling fill in the Frontier Effects pack)
- T-535 — Premium TitleSequence templates (pending; final sibling
  fill in the Frontier Effects pack; carries the v0.2.0 GA bump
  that closes the launch pack)
