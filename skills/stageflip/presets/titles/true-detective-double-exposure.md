---
id: true-detective-double-exposure
cluster: titles
clipKind: titleSequence
source: docs/compass_artifact.md#true-detective-season-1
status: substantive
preferredFont:
  family: 'Custom sans serif (clean, unobtrusive)'
  license: license-cleared
fallbackFont:
  family: Inter
  weight: 400
  license: ofl
permissions: []
signOff:
  parityFixture: 'signed:2026-05-08'
  typeDesign: 'signed:2026-05-14'
---

# True Detective S1 — photographic double-exposure title sequence

## Visual tokens
- Color palette: muted, desaturated earth tones — oily yellows, sickly greens, industrial grays
- Photographic source: Richard Misrach's Petrochemical America style — landscape photography of "Cancer Alley"
- Human silhouettes serving as windows revealing secondary imagery (faces, environments)
- Slowed-down footage to ~1/10th speed for surreal atmosphere
- Subtle film grain throughout

## Typography
- Credits: clean sans-serif (Inter fallback), Regular, 24–30 pt
- ALL CAPS or Mixed Case (per credit type)
- Letter spacing slightly wider than default (+30–50 tracking)
- Typography is unobtrusive — the photography is the foreground

## Animation
- Living photographs: footage rendered at ~1/10 speed with cross-dissolves between source plates
- Double-exposure technique: silhouette layer reveals secondary footage through the figure
- Builds from lightness to darkness; sequence climaxes with fire consuming the imagery, ~90 s
- Music sync (Handsome Family "Far From Any Road" — original cue; preset takes any `musicCue`)

## Rules
- Source photography quality is critical — at least 4K resolution per plate. Lower resolutions break the register.
- Double-exposure layering must use the silhouette-as-window technique, not opacity blending. The figure should reveal what's "inside" it, not just appear translucent.
- Slowed footage is mandatory — real-time playback is wrong for this register.
- Pacing builds; do not loop. Sequence has an arc.

## Acceptance (parity)
- Reference frames: 0 (entry), 360 (mid-arc), 720 (climax), 1080 (resolution at 90 s @ 12 fps effective)
- PSNR ≥ 34 dB (photographic source has high variance), SSIM ≥ 0.90

## References
- `docs/compass_artifact.md` § True Detective Season 1
- Elastic (Patrick Clair); animation by Antibody, Sydney; 2014 Emmy
- ADR-004

## Substantive props (T-351)

T-351 promotes this preset to substantive — the **third Cluster D consumer** of the
T-321 atmospheric-primitive carve-out roadmap, the **second multi-clip composition**
in the parity-CLI (sister to T-348 `stranger-things-benguiat`), AND the **PRIMARY
consumer of the T-321d `photographic-overlay` primitive** (compass canon
"photographic clip" register). The parity-fixture binding
(`packages/parity-cli/src/generate-fixture.ts`) composes three frame-runtime clips
in a single canvas in declaration order = z-order:

1. **`titleSequence`** (parent, zIndex 0) — `'photographic-overlay'` style; single
   `kind: 'titlePlate'` shot with text `'CREATED BY NIC PIZZOLATTO'`; Inter Regular
   400 (OFL fallback) → bespoke clean sans-serif (license-cleared, consumer-wired);
   muted off-white `#E8DCC4` foreground on `#000000` background; lower-third
   position `{ x: 640, y: 600, width: 1280, alignment: 'center' }`; `letterSpacing: 40`
   (+40 tracking per stub line 32 mid-range); `casing: 'uppercase'`. T-351 is the
   **first end-to-end consumer of the title-sequence's `'photographic-overlay'`
   style register** (T-321 line 566–578 — only `titlePlate` + `creditsBlock` shots
   render under this style; everything else defers to a sister photographic clip).
2. **`grain`** (zIndex 1) — `intensity: 0.15` (canonical subtle film-grain register
   per stub line 27 "subtle film grain throughout"); deterministic xxhash32
   per-pixel noise.
3. **`photographic-overlay`** (zIndex 2, top) — `mode: 'cinematic-lut'` at
   `intensity: 0.6` (DOMINATES the visual; opposite posture from T-348's 0.4 which
   capped intensity to NOT obliterate red-glow letterforms — T-351's stub
   designates the photography as foreground per line 33). The cinematic-LUT
   teal-and-orange contrast bias matrix matches True Detective's "oily yellows,
   sickly greens, industrial grays" palette closely (boosted R/B, slightly-lifted G,
   subtle cross-channel mixing).

NO light-leak overlay (would conflict with the muted earth-tone register — stub
explicitly does not enumerate atmospheric leaks). NO particles overlay (no
atmospheric drift in this canon — the photographic-overlay tonal register IS the
visual interest). 3-clip stack (vs. T-348's 5-clip stack) is intentional simpler
per D-T351-2.

Single golden snapshot at frame 120 fps 30 (parity-CLI default composition envelope
is 150 frames — see divergence (d) below; `endMs: 90000` covers the 90-s sequence
per stub line 38; the static cinematic-LUT tonal pass + frame-stable titlePlate
shot under `'photographic-overlay'` style mean the captured frame 120 register
is equivalent to the stub-canon "mid-arc" register).

## Documented divergences (T-351)

- **(a) Inter Regular 400 rendered, not the bespoke license-cleared sans-serif.**
  Stub specifies "Custom sans serif (clean, unobtrusive)" with `license: license-cleared`
  (consumer-wired). The parity render uses Inter Regular 400 (OFL fallback;
  registered via T-307). Inter is itself a clean, unobtrusive sans-serif — it
  carries the deferential register that the stub canonicalizes (line 33:
  "Typography is unobtrusive — the photography is the foreground"). The visual
  register (lower-third credit hold, ALL CAPS, +40 letterspacing tracking, 28 pt)
  is captured faithfully; only the typeface differs.
- **(b) Double-exposure silhouette-as-window technique deferred — v1 ships ONLY
  the photographic-overlay tonal grading layer.** Stub lines 25 / 43 describe
  human silhouettes serving as alpha-mask windows revealing secondary imagery.
  No `silhouette-mask` / `double-exposure` / `alpha-window` rendering primitive
  exists on `main`. v1 ships ONLY the photographic-overlay tonal grading
  (which captures the muted earth-tone palette per stub line 23) WITHOUT the
  silhouette-window compositing. Tracked as T-351-followup `silhouette-window`
  primitive carve-out.
- **(c) Slowed footage @ ~1/10 speed deferred — v1 ships a static frame.** Stub
  lines 26 / 36 / 44 reference slowed footage at ~1/10 speed for surreal
  atmosphere; that applies to the underlying photographic source plates which
  v1 does NOT ship (see (b)). Pace adjustment is moot for a single-frame
  snapshot; deferred with the double-exposure technique.
- **(d) Stub-listed candidate frames `0 / 360 / 720 / 1080` (annotated "12 fps
  effective") rendered as a single golden at frame 120 fps 30 (parity-CLI default
  composition envelope).** The parity-CLI generator script uses a fixed
  `DEFAULT_COMPOSITION` (1280×720 @ 30 fps × **150 frames**) — `--fps` is not a CLI
  flag, AND frame 360 falls outside the 150-frame envelope. The renderer rejects
  frame 360 with `renderFrame: frame must be an integer in [0, 150), got 360`.
  Frame 120 @ fps 30 is well past the entry register and matches T-348
  stranger-things-benguiat's frame 120 posture for the same composition envelope
  reason. The visual register (steady-state credit hold under cinematic-LUT
  tonal grading + grain) is equivalent for any in-envelope frame because the
  photographic-overlay primitive is static (no frame counter) and the
  `'photographic-overlay'` style's `titlePlate` shot does NOT exercise per-letter
  staggered-fade animation. Single-variant v1 mirrors T-348 / T-350 / T-369 /
  T-370 / T-372 / T-373 posture; multi-variant + custom-fps infra is a
  T-359a-family follow-up.
