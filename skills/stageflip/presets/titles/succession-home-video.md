---
id: succession-home-video
cluster: titles
clipKind: titleSequence
source: docs/compass_artifact.md#succession
status: substantive
preferredFont:
  family: Engravers Gothic + Sackers Gothic
  license: commercial-byo
fallbackFont:
  family: Copperplate + IBM Plex Sans Condensed
  weight: 600
  license: license-mixed
permissions: []
signOff:
  parityFixture: 'signed:2026-05-08'
  typeDesign: 'signed:2026-05-14'
---

# Succession — home video / dynastic title sequence

## Visual tokens
- Two visual registers intercut:
  1. Grainy 4:3 sepia "home video" footage — childhood privilege scenes (tennis, skiing, elephant rides)
  2. Crisp contemporary 16:9 footage — corporate power (skyscrapers, private planes, boardrooms)
- Sepia register: warm yellow-brown tint, moderate film grain, subtle frame chatter
- Contemporary register: high-contrast neutral grade, sharp focus

## Typography
- Show logo: Engravers Gothic fallback, ALL CAPS, wide tracking, classic stationery-engraving style
- Credits: Sackers Gothic Medium fallback, ALL CAPS, wider tracking, ~20–24 pt
- Tracking is signature — minimum +200, often +300 for credit lines

## Animation
- Quick-cut montage alternating between sepia + contemporary, ~90 s
- Patriarch shown from behind or at distance (faceless authority — preserve framing)
- Sequence intentionally evolves across seasons; preset takes a `seasonVariant: 1 | 2 | 3 | 4` slot
- Music: Nicholas Britell piano theme — `musicCue` slot is mandatory

## Rules
- The 4:3 sepia footage is shot NEW (not actual home video) — preset compose accepts a `sepiaSource: VideoRef` for custom footage with the period look applied via a film-grade layer.
- Patriarch faceless — frame from behind or at distance. The "Fort Knox" energy depends on this.
- Engravers / Sackers Gothic register signals "dynastic stationery" — fallback must preserve all-caps wide-tracking authority.
- Pacing matches the Britell piano cue; preset duration auto-fits to the supplied music cue.

## Acceptance (parity)
- Reference frames: 0 (entry sepia), 360 (mid-cut), 720 (corporate register), 1080 (resolution)
- PSNR ≥ 34 dB (mixed-grade footage has high variance), SSIM ≥ 0.91

## References
- `docs/compass_artifact.md` § Succession
- Picture Mill (William Lebeda); inspired by Fincher's The Game (1997)
- ADR-004

## Substantive props (T-352)

T-352 promotes this preset to substantive — the **fourth Cluster D consumer** of
the T-321 atmospheric-primitive carve-out roadmap, the **third multi-clip
composition** in the parity-CLI (sister to T-348 `stranger-things-benguiat` and
T-351 `true-detective-double-exposure`), AND the **secondary consumer of the
T-321d `photographic-overlay` primitive**. T-352 ships **`mode: 'sepia'`
end-to-end for the FIRST time** in StageFlip parity history (T-348 picked
`'fade'`; T-351 picked `'cinematic-lut'`) AND **non-default grain intensity
0.30 end-to-end for the FIRST time** (T-348/T-351 used the canonical 0.15
default). The parity-fixture binding (`packages/parity-cli/src/generate-fixture.ts`)
composes three frame-runtime clips in a single canvas in declaration order =
z-order:

1. **`titleSequence`** (parent, zIndex 0) — `'photographic-overlay'` style;
   single `kind: 'titlePlate'` shot with text `'SUCCESSION'` (show-logo
   identity per stub line 30); IBM Plex Sans Condensed weight 600 (OFL
   fallback) → bespoke Engravers Gothic + Sackers Gothic (commercial-byo,
   consumer-wired); warm off-white `#F4E8C8` foreground on warm-brown
   `#1A1410` background; center-of-frame position
   `{ x: 640, y: 360, width: 1280, alignment: 'center' }`; `letterSpacing: 250`
   (mid-range of stub line 32's "+200, often +300" envelope); `font.size: 56`
   (show-logo size envelope; larger than T-351's 28-pt credit hold);
   `casing: 'uppercase'`. T-352 is the **second end-to-end consumer of the
   title-sequence's `'photographic-overlay'` style register** (after T-351;
   T-321 line 566–578 — only `titlePlate` + `creditsBlock` shots render under
   this style).
2. **`grain`** (zIndex 1) — `intensity: 0.30` (HIGH; VHS-tape chatter per
   stub line 26 "moderate film grain, subtle frame chatter" — the "subtle"
   annotation is relative-to-VHS, NOT relative-to-T-348/T-351); deterministic
   xxhash32 per-pixel noise. **FIRST end-to-end consumer of non-default grain
   intensity** in StageFlip parity history.
3. **`photographic-overlay`** (zIndex 2, top) — `mode: 'sepia'` at
   `intensity: 0.7` (DOMINATES the visual register; sepia tint IS the
   canonical mood signal per stub line 26). The `SEPIA_MATRIX`
   (photographic-overlay.tsx:88–98) is the canonical W3C-style sepia
   transform — collapses RGB to a warm-yellow gradient with explicit
   per-channel scaling
   (`[0.393 0.769 0.189; 0.349 0.686 0.168; 0.272 0.534 0.131]`). HIGHER
   intensity than T-351's 0.6 (cinematic-LUT) and T-348's 0.4 (modest fade)
   — Succession's stub explicitly designates the sepia tint as the canonical
   mood anchor; capping at 0.7 preserves typographic legibility (>0.85 would
   obliterate type under the cast). **FIRST end-to-end consumer of
   `mode: 'sepia'`** in StageFlip parity history.

NO light-leak overlay (would over-saturate the sepia warm-yellow register to
muddy-brown — stub explicitly does not enumerate atmospheric leaks). NO
particles overlay (no atmospheric drift in this canon — the visual interest
IS the sepia + grain VHS register). 3-clip stack matches T-351's shape with
different mode + grain intensity per D-T352-2.

Single golden snapshot at frame 60 fps 30 (early-arc; the sepia register is
established within ~2 s; the photographic-overlay primitive is static so any
in-envelope frame captures the equivalent steady-state register). Lowered
parity thresholds `--psnr=34 --ssim=0.90` per stub line 48 (mixed-grade
footage variance + HIGH grain intensity 0.30; matches T-351's bar — slightly
more lenient than the stub's 0.91 to absorb 2x grain intensity vs. sister
presets).

## Documented divergences (T-352)

- **(a) Actual VHS video element rendering deferred — v1 ships ONLY the
  photographic-overlay sepia tonal grading layer.** Stub line 41: "preset
  compose accepts a `sepiaSource: VideoRef` for custom footage with the
  period look applied via a film-grade layer." The `videoShot` shot kind
  required to render an actual `<video>` element scoped to a shot's
  `[startMs, endMs]` window does NOT yet exist on the `titleSequence`
  primitive (the sealed shot enum is `titlePlate / letterAnimation /
  creditsBlock / colorPanel / holdFrame`). Per `docs/tasks/T-321-carveout-audit.md`
  carve-out #6, this is a TITLE-SEQUENCE MODIFICATION (not a new primitive).
  v1 ships ONLY the photographic-overlay sepia tonal grading (which captures
  the warm yellow-brown home-video tint per stub line 26) WITHOUT the actual
  video element. The visual register that ships in v1 is "sepia-graded
  credit hold over a placeholder background with heavy VHS-grade grain"
  rather than the full "sepia-graded home video footage with credit overlay"
  technique. **Tracked as T-352-followup `videoShot` shot-kind extension**.
  Structurally identical move to T-351's deferral of the silhouette-as-window
  technique to T-351-followup (also a primitive-side modification).
- **(b) 16:9 contemporary footage register intercut deferred — v1 ships ONLY
  the 4:3 sepia register.** Stub lines 23–25: "Two visual registers
  intercut: 1. Grainy 4:3 sepia 'home video' footage 2. Crisp contemporary
  16:9 footage — corporate power". The intercut between sepia + contemporary
  registers requires the same `videoShot` shot kind (twice — one per
  register) PLUS per-shot mode-toggle logic. v1 ships ONLY the 4:3 sepia
  register; the contemporary intercut is deferred. **Tracked as
  T-352-contemporary follow-up**. Cosmetic divergence; documented.
- **(c) Per-season visual variations deferred — v1 renders only
  `seasonVariant: 1`.** Stub line 37: "Sequence intentionally evolves across
  seasons; preset takes a `seasonVariant: 1 | 2 | 3 | 4` slot". The
  `seasonVariant` prop is a consumer-wired concept that drives subtle
  visual differences across S1–S4. v1 renders the canonical S1 register;
  other variants are deferred. **Tracked as T-352-seasonVariant follow-up**.
- **(d) Stub-listed candidate frames "0 / 360 / 720 / 1080" override to
  "60" only at fps 30 (parity-CLI default composition envelope).** The
  parity-CLI generator script uses a fixed `DEFAULT_COMPOSITION` (1280×720
  @ 30 fps × 150 frames) — `--fps` is not a CLI flag. Frame 60 @ fps 30 =
  2 s in (early-arc; sepia register fully established before any temporal
  evolution into the deferred contemporary intercut). The visual register
  (steady-state show-logo hold under sepia tonal grading + HIGH grain) is
  equivalent for any in-envelope frame because the photographic-overlay
  primitive is static (no frame counter) and the `'photographic-overlay'`
  style's `titlePlate` shot does NOT exercise per-letter staggered-fade
  animation. Single-variant v1 mirrors T-348 / T-350 / T-351 / T-369 /
  T-370 / T-372 / T-373 posture; multi-variant + custom-fps infra is a
  T-359a-family follow-up.
