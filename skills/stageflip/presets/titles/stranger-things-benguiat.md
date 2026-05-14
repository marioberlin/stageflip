---
id: stranger-things-benguiat
cluster: titles
clipKind: titleSequence
source: docs/compass_artifact.md#stranger-things
status: substantive
preferredFont:
  family: ITC Benguiat Bold
  license: commercial-byo
fallbackFont:
  family: Cormorant Garamond
  weight: 700
  license: ofl
permissions: []
signOff:
  parityFixture: 'signed:2026-05-08'
  typeDesign: 'signed:2026-05-14'
---

# Stranger Things — Benguiat title sequence

## Visual tokens
- Background: deep black `#000000`
- Title glow: red `#FF0000` → `#CC0000` range, simulating neon torch through canvas
- Optical film grain (subtle, animated noise)
- Light leaks (warm orange, intermittent)
- Atmospheric dust particles drifting
- Letters in extreme close-up — typeface fills the screen

## Typography
- Title: ITC Benguiat Bold fallback, ALL CAPS, scaled to fill the viewport
- Credits: ITC Avant Garde Gothic fallback (Geomanist or DM Sans as alternative), Regular, 22–28 pt

## Animation
- Letters drift slowly from different directions, sliding together like puzzle pieces, ~50 s total
- Red neon glow builds gradually — torch through canvas simulation
- Pacing synchronized to a synth score (Survive-canon); preset takes a `musicCue` slot
- Camera does not move — letterforms move; this distinction matters

## Rules
- The Benguiat fallback is critical; if no fallback adequate, escalate. The font is the show.
- No fast cuts. Pacing is meditative. Don't compress the sequence below 40 s without explicit permission.
- ALL CAPS, scaled to viewport — do not shrink. The point is letterform-as-environment.
- Glow is warm red, never blue / cyan. The register is 80s analog warmth.
- Optical film grain is mandatory; clean digital looks wrong.

## Acceptance (parity)
- Reference frames: 0 (pre-letter-entry), 240 (mid-assembly), 480 (full assembly + glow), 1200 (final pose at 50 s @ 24 fps)
- PSNR ≥ 36 dB (film grain reduces precision), SSIM ≥ 0.92

## References
- `docs/compass_artifact.md` § Stranger Things
- Imaginary Forces (Michelle Dougherty); 2017 Creative Arts Emmy
- ADR-004

## Substantive props (T-348)

T-348 promotes this preset to substantive — the **first multi-clip-composition consumer
in StageFlip parity-CLI history** (D-T348-1) AND the **first Cluster D consumer to
ride the just-completed T-321 atmospheric-primitive carve-out roadmap end-to-end**.
The parity-fixture binding (`packages/parity-cli/src/generate-fixture.ts`) composes
five frame-runtime clips in a single canvas in declaration order = z-order:

1. **`titleSequence`** (parent, zIndex 0) — `'letterform-assemble'` style; ALL-CAPS
   `'STRANGER THINGS'`; Cormorant Garamond Bold (OFL fallback) → ITC Benguiat Bold
   (commercial-byo); white letters on `#000000` background; red `#FF0000`
   Gaussian-blur glow (blur 8 px) producing the canonical neon-torch-through-canvas
   register; `letterformScale: 0.7` → ~504 px per letter at 1280×720 (clipping the
   canvas edges per stub canon "letterform-as-environment").
2. **`grain`** (zIndex 1) — `intensity: 0.15` (canonical Stranger Things-grade subtle
   grain per the primitive's file header); deterministic xxhash32 per-pixel noise.
3. **`light-leak`** (zIndex 2) — three warm-orange radial blobs (`color1='#ff6b35'`
   warm-orange, `color2='#ff8c1a'` amber, `color3='#ffa040'` peach); `intensity: 0.7`,
   `seed: 42`; `mixBlendMode: 'screen'` lifts highlights without darkening shadows.
4. **`particles`** (zIndex 3) — `style: 'snow'`, `count: 30` (low for atmospheric
   subtlety; primitive default is 50), `color: '#ffffff'` (pure white, no blue tints).
5. **`photographic-overlay`** (zIndex 4, top) — `mode: 'fade'` at `intensity: 0.4`
   (subtle 80s-analog warm-fade tonal pass; full intensity 1.0 would obliterate the
   red-neon-glow register).

Single golden snapshot at frame 120 fps 30 (canonical "full assembly + glow"
register; well past the per-letter staggered-fade assembly window which completes
at ~frame 90 = 15 letters × 200 ms staggerMs × 30 fps + 400 ms LETTER_FADE_DURATION_MS;
the equivalent stub-canon frame 480 @ fps 24 = 20 s of show time falls outside the
parity-CLI's fixed 150-frame composition envelope — see divergence (d) below).

## Documented divergences (T-348)

- **(a) Cormorant Garamond Bold rendered, not ITC Benguiat Bold.** Stub specifies
  ITC Benguiat as preferred; license `commercial-byo` means consumer-wired. The
  parity render uses the OFL fallback (registered via T-307). The visual register
  (deep-black bg, ALL CAPS scaled-to-viewport, red neon glow) is captured faithfully;
  only the typeface differs.
- **(b) Letter-staggered fade, not "letters drifting from different directions /
  puzzle pieces" choreography.** The `letterAnimation` shot kind ships per-letter
  staggered fade-entry (`LETTER_FADE_DURATION_MS = 400`; `staggerMs = 200`).
  Directional-drift / puzzle-piece slide is interpretive prose; the staggered fade
  IS the v1 implementation. Adding directional drift is a T-321-followup carve-out.
- **(c) Single golden frame 480 only.** Acceptance lists 0 / 240 / 480 / 1200 as
  candidate frames. Single-variant v1 mirrors T-350 / T-369 / T-370 / T-372 / T-373
  posture; multi-variant infra is a T-359a-family follow-up.
- **(d) Single golden frame 120 @ fps 30 (parity-CLI default composition), not the
  stub-canon frame 480 @ fps 24.** The stub designates cinematic 24 fps and lists
  candidate frames `0 / 240 / 480 / 1200` at that frame rate. The parity-CLI
  generator script uses a fixed `DEFAULT_COMPOSITION` (1280×720 @ 30 fps × 150
  frames) — `--fps` is not a CLI flag, and frame 480 / 600 falls outside the 150-
  frame envelope. The captured frame 120 @ fps 30 is well past the assembly window
  (15 letters × 200 ms staggerMs × 30 fps + 400 ms LETTER_FADE_DURATION_MS = ~90
  frames assembly window) and matches T-350 squid-game-geometric's frame 120
  posture. The visual register (full assembly + glow) is equivalent. Adding `--fps`
  + custom-duration plumbing is out-of-envelope for T-348; multi-variant + custom-
  composition infra is a T-359a-family follow-up. Documented; NOT a T-348 fix.
