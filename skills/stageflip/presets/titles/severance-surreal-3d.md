---
id: severance-surreal-3d
cluster: titles
clipKind: titleSequence
source: docs/compass_artifact.md#severance
status: substantive
preferredFont:
  family: Severance custom (Helvetica + mid-century corporate identity)
  license: proprietary-byo
fallbackFont:
  family: Inter Display
  weight: 500
  license: ofl
permissions: []
signOff:
  parityFixture: signed:2026-05-08
  typeDesign: pending-cluster-batch
---

# Severance — surreal 3D corporate title sequence

## Visual tokens
- Hyper-realistic 3D-rendered human bodies and faces (approach: high-fidelity CGI heads, mid-century corporate-identity-manual color palette)
- Sterile color palette: muted neutrals, desaturated greens, occasional bright accent
- Bodies melt through walls, get trapped in office furniture, liquify into ooze (per S1)
- S2 introduces darker register: final shot of a character trying to pry open their own head ("jump scare" canon)
- Cloth simulation, hyper-detail rendering

## Typography
- Custom typeface inspired by Helvetica + mid-century corporate identity manuals (Massimo Vignelli era)
- Title: Bold, ALL CAPS, scaled large, very tight tracking
- Credits: Regular, 24–30 pt, wide tracking
- Fallback: Inter Display preserves the Helvetica-adjacent humanism

## Animation
- 3D cinematic — Cinema 4D + Houdini + Octane render quality
- Surreal vignettes: ~60 s, scripted not generated
- Camera holds, dolly-ins, no rapid cuts
- Use `ThreeSceneClip` for the live 3D path; static fallback is a hero frame from the canonical season variant

## Rules
- This is the highest-fidelity preset in the catalogue. Demands premium 3D pipeline — not for low-tier renders.
- Season variant matters: `seasonVariant: 1 | 2` declared in compose. S1 is sterile-surreal; S2 is darker / body-horror.
- Hidden plot clues are part of the canon (Severance hid clues in S1 visible only on rewatch). Preset compose accepts an optional `hiddenClues: string[]` for tenants who want this canon faithfully.
- Mid-century corporate-identity register is non-negotiable; "modern minimalism" looks wrong — this is specifically Vignelli-era.

## Acceptance (parity)
- Reference frames: 0 (entry), 240 (vignette mid-shot), 480 (climax shot), 720 (resolution)
- PSNR ≥ 34 dB (high-fidelity 3D varies), SSIM ≥ 0.91

## Substantive props (T-353 v1)

T-353 ships v1 as the **fifth Cluster D consumer** — fourth multi-clip composition; reuses T-348's `ClipKindBinding.overlays?` surface verbatim. Three primitives compose at full canvas in declaration order = z-order:

- **zIndex 0** — `titleSequence` (T-321) parent. `style: 'photographic-overlay'` (THIRD end-to-end consumer of this style register after T-351 + T-352). Single `kind: 'titlePlate'` shot text `'SEVERANCE'`. Inter Display weight 500, 64pt ("scaled large" per stub line 31), `letterSpacing: 0` (neutral; conservative interpretation of "very tight"), `casing: 'uppercase'`. Center-of-frame `{ x: 640, y: 360, width: 1280, alignment: 'center' }`. Background `#1A1F1A` (deep desaturated-green-black; anchors the muted-neutrals register). Foreground `#E8ECE5` (pale neutral off-white).
- **zIndex 1** — `grain` (T-321a) overlay. `intensity: 0.10` (LOW — sub-default; opposite posture from T-352's HIGH 0.30 VHS chatter; SLIGHTLY-BELOW T-348/T-351's canonical 0.15 default). **SECOND end-to-end consumer of non-default grain intensity / FIRST below-default consumer**. Hints at the 3D-rendered surface micro-texture without competing with the typographic identity.
- **zIndex 2** — `photographic-overlay` (T-321d) overlay. `mode: 'cinematic-lut'` at `intensity: 0.4` (MODERATE — visible but not dominating). **SECOND end-to-end consumer of `mode: 'cinematic-lut'`** (T-351 PRIMARY at 0.60 dominant; T-353 at 0.4 moderate). The cinematic-LUT cast preserves the sterile palette while subtly anchoring the corporate-Vignelli office mood.

NO light-leak / particles overlays (D-T353-2 — sterile / desaturated palette would conflict with warm-orange leaks; canon does not enumerate particle drift). Rationale: 3-clip stack matches T-351 / T-352 with different mode + intensities.

Tighter parity thresholds **PSNR 36 / SSIM 0.92** (D-T353-5 — TIGHTER than T-351/T-352's 34/0.90 because T-353's lower-engagement register has more headroom: LOW grain 0.10 + MODERATE photographic-overlay 0.4 + sterile palette = uniform pixel statistics).

Single golden-frame snapshot at `frame=60` fps 30 (D-T353-4; early-arc steady-state register; no `--fps` flag — parity-CLI does not accept it).

## Deferrals (v1 → follow-ups)

Four divergences from the canonical live 3D register, three documented as follow-ups; **divergence (a) is canon-explicit-allowed per stub line 39, NOT a true documented divergence**.

- **(a) Live ThreeSceneClip 3D rendering** — stub line 39 explicitly authorizes the static-fallback hero-frame posture: "Use `ThreeSceneClip` for the live 3D path; static fallback is a hero frame from the canonical season variant". v1 ships ONLY the photographic-overlay sterile-graded credit hold. Tracked as **T-353-live-3d** follow-up `threeScene` shot-kind extension (per `docs/tasks/T-321-carveout-audit.md` carve-out #5 — TITLE-SEQUENCE MODIFICATION, not a new primitive).
- **(b) Surreal melt-vignettes / S2 darker-register / cloth simulation** — stub lines 25–27. All require live ThreeSceneClip rendering. Tracked as **T-353-melt-vignettes / T-353-S2-jump-scare / T-353-cloth-sim** follow-ups; all depend on T-353-live-3d.
- **(c) Per-season visual variations** — stub line 43 (`seasonVariant: 1 | 2`). v1 renders only `seasonVariant: 1`. Tracked as **T-353-seasonVariant** follow-up.
- **(d) Stub-listed candidate frames "0 / 240 / 480 / 720" override to "60" only at fps 30** — stub frames assume the canonical 60s sequence at canonical pacing AND live 3D rendering. v1 ships single-frame at frame 60 (early-arc steady-state); multi-variant infra is a T-359a-family follow-up.

## References
- `docs/compass_artifact.md` § Severance
- Oliver Latta (Extraweg); typography by Teddy Blanks; SIGGRAPH 2022 Electronic Theater
- Two Emmys for Outstanding Main Title Design (2022 + 2025)
- Frontier: `ThreeSceneClip` (ADR-005)
- ADR-004
- T-353 task spec: `docs/tasks/T-353.md`
- Sister Cluster D presets (multi-clip composition pattern): `stranger-things-benguiat` (T-348; first multi-clip), `true-detective-double-exposure` (T-351; first 3-clip), `succession-home-video` (T-352; second 3-clip), `severance-surreal-3d` (T-353; third 3-clip — THIS preset)
