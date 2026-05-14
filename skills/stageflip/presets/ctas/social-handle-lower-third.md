---
id: social-handle-lower-third
cluster: ctas
clipKind: lowerThird
source: docs/compass_artifact.md#social-handle-lower-third
status: substantive
preferredFont:
  family: Roboto / Montserrat / Proxima Nova
  license: apache-2.0 / ofl / commercial-byo
fallbackFont:
  family: Inter
  weight: 700
  license: ofl
permissions: []
signOff:
  parityFixture: 'signed:2026-05-07'
  typeDesign: 'signed:2026-05-14'
---

# Social Handle Lower-third — cross-platform passport

## Visual tokens

- Horizontal bar, 30–60% of screen width
- Position: lower 15–20% of frame
- Background: black `#000000` @ 60–80% opacity
- Text: white `#FFFFFF` or brand-colored
- Platform icons (24 × 24 px @ 1080p) in OFFICIAL brand colors:
  - Instagram: gradient `#833AB4` → `#E1306C` → `#F77737`
  - TikTok: black `#000000` + cyan `#69C9D0` + pink/red `#EE1D52`
  - YouTube: red `#FF0000`
  - X / Twitter: black `#000000`
- Icons positioned left of @username text

### Substantive props (D-T373-1 / D-T373-3 / D-T373-4 / D-T373-6 / D-T373-12)

T-373 binds the `LowerThird` primitive (T-183 + T-183z) via the
`PRESET_ID_BINDINGS` override path (Pattern C) as the **fifth `lowerThird`-keyed
override** (after T-325 / T-326 / T-330 / T-329) and the **sixth `lowerThird`
clipKind consumer** overall (T-323 holds the clipKind-default arm). T-373 is
the **fifth production consumer of T-183z's `noFlag` / `subtitleColor` / `font`
props** — all three exercised. The cross-platform social-handle register
paints a text-only white-on-black bar with NO chrome, NO icons, NO cascade.

| Field | Value | Source |
|---|---|---|
| `name` | `'@yourbrand'` | Cross-platform handle canon (universal `@` prefix); Mixed Case (handles render as-typed; D-T373-7) |
| `title` | `'Follow us everywhere'` | Cross-platform passport tagline; sentence case (D-T373-7) |
| `accent` | `'#FFFFFF'` | Irrelevant — `noFlag: true` suppresses the strip (D-T373-3) |
| `background` | `'#000000'` | Flat black bar (translucent register approximated; D-T373-12-a) |
| `textColor` | `'#FFFFFF'` | Headline white-on-black per cross-platform-handle canon |
| `insetLeftPx` | `96` | Primitive default; canvas-safe at 1280×720 (D-T373-12) |
| `insetBottomPx` | `96` | Primitive default; canvas-safe at 1280×720 (D-T373-12) |
| `noFlag` | `true` | T-183z; cross-platform register has NO per-platform accent strip (D-T373-3) |
| `subtitleColor` | `'#FFFFFF'` | T-183z; subtitle decoupled from `accent`, painted explicit white (D-T373-4) |
| `font` | `{ family: 'Inter', weight: 700 }` | T-183z; Inter Bold = OFL fallback for compound preferred font (D-T373-5) |

**v1 cosmetic divergences from this register** (D-T373-12; flagged, NOT fixed
in T-373): background is opaque `#000000` (60–80% translucent register
approximated; over flat parity canvas the visual is identical) — `T-183z`-family
`backgroundOpacity` carve-out; primitive boxShadow is hard-coded; uniform 6 px
corner radius; entry curve is `EASE_OUT_QUART` (close to "ease-out"); no
multi-handle cascade — `T-373a` follow-up; no platform-icon row — `T-183z`-
family `iconRow` carve-out.

## Typography

- Roboto / Montserrat / Proxima Nova fallback (Inter), Bold (700)
- 18–24 pt @ 1080p
- @handles in Bold; platform names (if shown) in Regular

### Substantive notes (D-T373-5)

The stub's `preferredFont` is a **compound** declaration —
`'Roboto / Montserrat / Proxima Nova'` with `'apache-2.0 / ofl / commercial-byo'`
licenses — signaling that any of these three Bold-weight sans-serifs is
acceptable depending on the deploying brand's existing font corpus. The OFL
fallback is `Inter` weight 700.

v1 picks `font: { family: 'Inter', weight: 700 }`. Inter Bold approximates
Roboto Bold (the YouTube / Google platform default) and Montserrat Bold at the
same x-height and weight curve; Proxima Nova is commercial-byo (licensable
separately by deploying brands).

The primitive applies weight 700 uniformly to both the headline (`@yourbrand`)
and the subtitle (`Follow us everywhere`). This **departs from T-329 / T-330**
(which used Light / Medium weights matching Apple / Netflix's restrained
registers); the social-handle register is **bold** by canon — the handle line
is meant to be **immediately readable** during the 4–8 s exposure window.

`Inter` ships under SIL Open Font License 1.1 via Google Fonts; already
present in `THIRD_PARTY.md` from the sister preset corpus. Roboto (Apache-2.0)
and Montserrat (OFL) are both whitelisted licenses; Proxima Nova is
commercial-byo (deploy-time licensee responsibility).

## Animation

- Entry: slides in from left or bottom, 300–500 ms ease-out
- Hold: 4–8 s
- Multiple handles cascade in sequentially: stagger 150–200 ms per handle
- Exit: reverse slide or fade

### Substantive notes (D-T373-12-d / D-T373-12-e)

v1 ships **steady-state mid-hold at frame 60 only**. The `LowerThird`
primitive's slide-in over `ceil(fps * 0.45) ≈ 14` frames at fps=30 is
~467 ms — comfortably inside the stub's 300–500 ms range. The curve is
`EASE_OUT_QUART` (asymmetric); the stub specifies generic ease-out; close
enough. Steady-state mid-hold golden at frame 60 sidesteps the entry curve
entirely.

**Multi-handle cascade is NOT in v1.** The primitive renders a single static
composite (one slide-in of the whole bar). Per-handle stagger / cascade is
documented for a future `T-373a` follow-up that would add a
`cascade?: { handles: string[]; staggerMs: number }` axis to the primitive.
NOT a T-373 fix.

Entry direction "from left or bottom" is fixed at slide-from-left in the
primitive (no per-preset entry-direction axis). The canonical golden at
frame 60 is at steady-state mid-hold where the curve / direction are
irrelevant.

## Rules

- Borrowed from broadcast TV conventions — the lower-third register signals professionalism.
- Lower 15–20% of frame is canonical (avoids critical content). Don't reposition.
- Brief exposure + repetition: 4–8 s, repeated throughout video. Do NOT hold for 30 s.
- Platform icons MUST be in official brand colors — monochrome "designer" versions look amateur.
- Cascade timing of 150–200 ms is the rhythm — don't compress to simultaneous reveal (loses the tracking eye).

### v1 outcome (D-T373-1 / D-T373-12)

- The parity fixture's `durationInFrames: 150` (~5 s at fps=30) sits in the
  middle of the 4–8 s exposure-window register.
- Lower 15–20% — the primitive's bottom-anchored `insetBottomPx: 96` on a
  1280×720 canvas places the bar baseline at approximately y=624 (~13.3% from
  bottom; slightly above the 15–20% range but within visual-register tolerance
  for the cross-platform handoff style).
- Platform icons official-color rule — N/A in v1 (no icons rendered;
  `T-183z`-family `iconRow` carve-out).

## Acceptance (parity)

- Reference frame: **60** (steady-state mid-hold; D-T373-8)
- PSNR ≥ 42 dB, SSIM ≥ 0.98 (cluster-norm pin written directly by F-4 flags `--psnr=42 --ssim=0.98`; D-T373-10)

### Substantive notes (D-T373-8 / D-T373-10)

The stub's candidate frame list (0 / 12 / 30 / 90) is reduced to a single
canonical mid-hold at frame 60. The cascade frames (12 first-handle settled,
30 cascade complete) are N/A for v1 — no cascade. Frame 0 is invisible
(pre-entry); frame 90 is mid-hold like 60. Frame 60 is comfortably mid-hold
(`60 > enterEnd ≈ 14 && 60 < exitStart ≈ 139`); aligns with the cluster-norm
convention (T-323 / T-325 / T-326 / T-329 / T-330 all use frame 60) and
`--frame=60` is the operator-default.

Threshold pin 42 dB / 0.98 matches the stub line 54 register exactly and is
written by the F-4 flag set `--psnr=42 --ssim=0.98 --mark-signed` directly
into `thresholds.json` — no hand-edit post-generation.

## References

- `docs/compass_artifact.md` § Social handle lower-third
- T-183 (`LowerThird` primitive base)
- T-183z (`noFlag` / `subtitleColor` / `font` props — central dep)
- T-330 (`apple-tv-lt`; primary template; canonical T-183z prop story)
- T-329 (`netflix-doc-lt`; secondary template; per-line casing pattern)
- T-369 (`youtube-subscribe-bounce`; sister Cluster G preset; canvas-size lesson source)
- T-373 task spec (`docs/tasks/T-373.md`)
- ADR-004
