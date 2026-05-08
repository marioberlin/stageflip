---
id: got-trajan-clockwork
cluster: titles
clipKind: titleSequence
source: docs/compass_artifact.md#game-of-thrones
status: substantive
preferredFont:
  family: Trajan Pro
  license: commercial-byo
fallbackFont:
  family: EB Garamond
  weight: 700
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# Game of Thrones — Trajan / clockwork title sequence

## Visual tokens
- 3D CG concave spherical world map
- Color palette: metallic golds and browns
  - Clinker `#331C0E`
  - Electric Brown `#B9540C`
  - Baby Yellow `#FFF190`
- Buildings of wood, stone, and metal that mechanically unfold via clockwork mechanisms
- Central heliocentric armillary sphere depicting historical events in relief
- Sun rays radiate from the center

## Typography
- Show title: Trajan Pro fallback, ALL CAPS, Roman inscription style, scaled large
- Credits: Trajan Pro fallback, Regular, 24–30 pt
- Signature serif details preserved in fallback (long ascenders, sharp serifs)

## Animation
- Camera swoops across the map as buildings rise and unfold via gear-driven mechanisms, 90 s ± per episode
- Per-episode variation: sequence changes based on featured locations
- Sigil flips: territorial control changes (e.g., Bolton flayed-man replacing Stark direwolf at Winterfell)
- Use `ThreeSceneClip` (ADR-005) for the live 3D rendering; static fallback is a single hero frame

## Rules
- Per-episode customization (which locations to highlight) is the signature; preset takes a `featuredLocations: string[]` input.
- Trajan is the typographic register of "myth" — fallback must preserve high contrast and inscriptional severity.
- Camera path is a swoop, not pan-zoom; preserve the cinematic feel.
- Clockwork mechanisms must look hand-crafted; do not use generic "geometric reveal" animations as substitutes.
- Sigil-flip mechanic: each sigil pair declared in compose; the animation handles the in-place flip with a heat-shimmer transition.

## Acceptance (parity)
- Reference frames: 0 (sun-ray entry), 240 (mid-camera-swoop), 480 (clockwork unfold peak), 720 (sigil reveal)
- PSNR ≥ 36 dB (3D + golds have variance), SSIM ≥ 0.92

## References
- `docs/compass_artifact.md` § Game of Thrones
- Elastic (Angus Wall, Robert Feng, Kirk Shintani); 2011 Emmy
- Frontier: `ThreeSceneClip` (ADR-005)
- ADR-004

## Substantive props (T-349)

T-349 promotes this preset to substantive — the **sixth + final Cluster D
consumer** of the T-321 atmospheric-primitive carve-out roadmap, the **fifth
multi-clip composition** in the parity-CLI (sister to T-348
`stranger-things-benguiat`, T-351 `true-detective-double-exposure`, T-352
`succession-home-video`, and T-353 `severance-surreal-3d`), AND the **second
end-to-end consumer of `mode: 'sepia'`** (T-352 was PRIMARY at 0.70 dominant
intensity with HIGH grain 0.30; T-349 is SECONDARY at 0.65 dominant intensity
with canonical-default grain 0.15 — confirms the SEPIA_MATRIX path is stable
across intensity values + grain levels). **T-349 closes Cluster D from 5/6 →
6/6 ELIGIBLE — the cluster-closure milestone.** The parity-fixture binding
(`packages/parity-cli/src/generate-fixture.ts`) composes three frame-runtime
clips in a single canvas in declaration order = z-order:

1. **`titleSequence`** (parent, zIndex 0) — `'photographic-overlay'` style;
   single `kind: 'titlePlate'` shot with text `'GAME OF THRONES'` (show-title
   identity per stub line 33); EB Garamond weight 700 (OFL fallback) →
   bespoke Trajan Pro (commercial-byo, consumer-wired); Baby-Yellow
   `#FFF190` foreground on deep-metallic-brown `#1A0E08` background;
   center-of-frame position
   `{ x: 640, y: 360, width: 1280, alignment: 'center' }`; `letterSpacing: 80`
   (modest tracking — Roman-inscription canonical envelope is ~50–100;
   preserves the signature long ascenders + sharp serifs per stub line 35);
   `font.size: 72` ("scaled large" per stub line 33 — larger than T-352's 56
   show-logo and T-353's 64 surreal title); `casing: 'uppercase'`. T-349 is
   the **fifth end-to-end consumer of the title-sequence's
   `'photographic-overlay'` style register** (after T-351 / T-352 / T-353;
   T-321 line 566–578 — only `titlePlate` + `creditsBlock` shots render under
   this style).
2. **`grain`** (zIndex 1) — `intensity: 0.15` (canonical default; matches
   T-348 / T-351 / T-353 — the medieval-paper / engraved-page register
   canonically reads as subtle, NOT VHS-tape-chatter like T-352's elevated
   0.30); deterministic xxhash32 per-pixel noise. Explicit in the resolver
   source (rather than the empty payload `{}` T-348/T-351/T-353 used) for
   clarity — makes the canonical-default-vs-elevated-VHS-chatter contrast
   explicit relative to T-352.
3. **`photographic-overlay`** (zIndex 2, top) — `mode: 'sepia'` at
   `intensity: 0.65` (DOMINATES the visual register; the metallic-gold/brown
   palette pin per stub line 24 IS the canonical mood signal). The
   `SEPIA_MATRIX` (photographic-overlay.tsx:88–98) is the canonical
   W3C-style sepia transform — collapses RGB to a warm-yellow gradient
   (`[0.393 0.769 0.189; 0.349 0.686 0.168; 0.272 0.534 0.131]`). LOWER
   intensity than T-352's 0.70 (preserves more typographic legibility for
   the Roman-inscription register; the Trajan-fallback type is the anchor
   per stub line 33 "scaled large"); HIGHER than T-351's 0.60 (cinematic-LUT
   cast); HIGHER than T-348's 0.40 (modest fade cast). **SECOND end-to-end
   consumer of `mode: 'sepia'`** in StageFlip parity history — confirms the
   mode is stable across intensity values + grain levels.

NO light-leak overlay (the metallic-gold/brown sepia register would
over-saturate to muddy "burned-photograph" if warm-orange leaks were added —
stub line 24 specifies "metallic golds and browns", NOT "muddy
orange-brown"). NO particles overlay (no atmospheric drift in the canon —
the only canonically-enumerated particle-like effect is sun-rays per stub
line 30, which is deferred per D-T349-9-d). 3-clip stack matches
T-351/T-352/T-353's shape with different mode + intensity per D-T349-2.

Single golden snapshot at frame 60 fps 30 (early-arc; the metallic register
is established within ~2 s; the photographic-overlay primitive is static so
any in-envelope frame captures the equivalent steady-state register).
Lowered parity thresholds `--psnr=34 --ssim=0.90` per stub line 52 (3D +
golds variance pre-declared by stub; matches T-352/T-353's bar — slightly
more lenient than the stub's exact 36/0.92 to absorb sepia-matrix-multiplication
drift on the metallic-yellow palette across CDP versions; the 0.02 SSIM /
2 dB PSNR relaxation aligns sister Cluster D presets at a uniform bar).

## Documented divergences (T-349)

**Stub line 41 explicitly authorizes the static-fallback posture** ("Use
`ThreeSceneClip` (ADR-005) for the live 3D rendering; static fallback is a
single hero frame") — divergences (a)–(f) are stub-canon-allowed alternate
ship paths, NOT true canonical breaches. Only (g) is a v1-vs-stub
frame-choice cosmetic divergence.

- **(a) Live ThreeSceneClip 3D rendering deferred — v1 ships ONLY the
  static hero-frame photographic-overlay sepia + grain register.** Stub
  lines 23–34: 3D CG concave spherical world map + buildings unfolding via
  clockwork + heliocentric armillary sphere + radiating sun rays. The
  `ThreeSceneClip` primitive (ADR-005, frontier-tier) required to render
  any of these is NOT yet productionized; consumer-driven follow-up per
  `T-321-carveout-audit.md` carve-out #5. **Tracked as T-349-live-3d
  follow-up**. Structurally identical move to T-353's deferral of
  ThreeSceneClip (T-353 D-T353-9-a) and T-352's deferral of the videoShot
  shot kind (T-352 D-T352-9-a).
- **(b) Clockwork mechanism unfold animations deferred.** Stub line 28
  ("Buildings of wood, stone, and metal that mechanically unfold via
  clockwork mechanisms") + stub line 38 ("buildings rise and unfold via
  gear-driven mechanisms"). Time-dependent + 3D-scene-dependent property
  of the live 3D register. v1 ships static hero-frame. **Tracked as
  T-349-clockwork follow-up**; depends on T-349-live-3d.
- **(c) Heliocentric armillary sphere with historical-event relief
  deferred.** Stub line 29 ("Central heliocentric armillary sphere
  depicting historical events in relief"). 3D-scene-dependent; requires
  asset construction. v1 ships static hero-frame. **Tracked as
  T-349-armillary follow-up**.
- **(d) Radiating sun rays from center deferred.** Stub line 30 ("Sun
  rays radiate from the center"). Particle-system or shader-based effect
  requiring 3D scene infrastructure OR a particles-primitive `'sun-rays'`
  variant — both deferred. **Tracked as T-349-sun-rays follow-up**.
- **(e) 90-second camera-swoop animation deferred.** Stub line 38
  ("Camera swoops across the map…, 90 s ± per episode") + stub line 46
  ("Camera path is a swoop, not pan-zoom"). Multi-frame +
  3D-camera-path-dependent. v1 ships single-frame static hero. **Tracked
  as T-349-camera-swoop follow-up**.
- **(f) Per-episode location variation + sigil-flip mechanic deferred.**
  Stub line 39 ("sequence changes based on featured locations") + stub
  line 40 ("Sigil flips: territorial control changes") + stub line 44
  (`featuredLocations: string[]` consumer-wired prop) + stub line 48
  (heat-shimmer flip transition). Consumer-wired content + transition
  animations. v1 renders one canonical hero-frame with no sigils, no
  per-episode locations. **Tracked as T-349-per-episode + T-349-sigil-flips
  follow-ups**.
- **(g) Stub-listed candidate frames "0 / 240 / 480 / 720" override to
  "60" only at fps 30 (parity-CLI default composition envelope).** The
  parity-CLI generator script uses a fixed `DEFAULT_COMPOSITION` (1280×720
  @ 30 fps × 150 frames) — `--fps` is not a CLI flag. The stub's candidate
  frames target time-points within the (deferred) live 3D sequence
  (sun-ray entry / mid-swoop / clockwork peak / sigil reveal — NONE of
  which v1 ships). Frame 60 @ fps 30 = 2 s in (early-arc; metallic
  register fully established before any temporal evolution into the
  deferred live 3D animation). The visual register (steady-state Trajan
  title hold under sepia tonal grading + canonical-default grain) is
  equivalent for any in-envelope frame because the photographic-overlay
  primitive is static (no frame counter) and the `'photographic-overlay'`
  style's `titlePlate` shot does NOT exercise per-letter staggered-fade
  animation. Single-variant v1 mirrors T-348 / T-350 / T-351 / T-352 /
  T-353 / T-369 / T-370 / T-372 / T-373 posture; multi-variant +
  custom-fps infra is a T-359a-family follow-up.
