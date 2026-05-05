---
id: squid-game-geometric
cluster: titles
clipKind: titleSequence
source: docs/compass_artifact.md#squid-game
status: substantive
preferredFont:
  family: Squid Game custom geometric
  license: proprietary-byo
fallbackFont:
  family: Anton + Bebas Neue
  weight: 700
  license: ofl
permissions: []
signOff:
  parityFixture: 'signed:2026-05-05'
  typeDesign: pending-cluster-batch
---

# Squid Game — geometric brutalist title

## Visual tokens
- Hot pink / magenta `#E91E63`
- Teal / dark green `#067162`
- Black `#000000`
- White `#FFFFFF`
- Korean title integration: ○ (circle) for "O", △ (triangle) for "J", □ (square) for "M" (Korean initials)
- Six-shot timeline driving the brutalist palette jump cut (mirrors `SQUID_GAME_GEOMETRIC_SHOTS` exported from `@stageflip/parity-cli`):

  | # | id | range (ms) | kind | content |
  |---|---|---|---|---|
  | 0 | `panel-pink-prelude` | 0..600 | colorPanel | `color: #E91E63` |
  | 1 | `panel-teal-circle` | 600..1200 | colorPanel | `color: #067162`, `glyph: ○` |
  | 2 | `panel-black-triangle` | 1200..1800 | colorPanel | `color: #000000`, `glyph: △` |
  | 3 | `panel-pink-square` | 1800..2400 | colorPanel | `color: #E91E63`, `glyph: □` |
  | 4 | `panel-teal-title` | 2400..3600 | colorPanel | `color: #067162` |
  | 5 | `title-hold` | 3600..5000 | titlePlate | `text: 'SQUID GAME'` |

  Total duration 5000 ms = 150 frames at 30 fps. The `'palette-jump-cut'` style bundle (T-321 D-T321-3) bleeds the most-recent `colorPanel.content.color` through the container background — the shot 5 title plate reads on the teal `#067162` panel established at shot 4.

## Typography
- Title typeface: custom geometric sans-serif with squared-off, brutalist letterforms (proprietary BYO; v1 ships without the bespoke font).
- Fallback stack: `Anton, Bebas Neue, system-ui, sans-serif` — Anton for headline mass, Bebas for compressed cuts (both Google Fonts under SIL Open Font License 1.1 per `THIRD_PARTY.md`).
- Weight 700, size 64 px (override of the bundle default 96 px; the spec proposed 120 as a starting point but the rendered output wrapped `SQUID GAME` at the 1024 px wrapper width at `font.size * 2 = 240 px`. Size 64 renders at `font.size * 2 = 128 px` — fits the title on one line at 1280×720 while keeping the brutalist mass).
- ALL CAPS (`casing: 'uppercase'`); applied at render time via the primitive's `applyCasing` helper — JS string transform, no CSS `text-transform`.
- Bilingual rendering (Latin + Hangul `오징어 게임`) is deferred to T-350a — v1 ships Latin only because the primitive's font-fallback chain does not currently include Pretendard / Spoqa Han Sans for Hangul coverage.

## Animation
- Six-shot palette jump cut, 5000 ms total. Container background bleeds the most-recent `colorPanel.content.color`; foreground glyphs / title text render on top.
- Hard cuts only — the `'palette-jump-cut'` style bundle hard-codes `transitionOut: 'cut'` regardless of declared shot-level transition (cut-only enforcement at `title-sequence.tsx:272–276` driven by `styleForcesCut = props.style === 'palette-jump-cut'`). Per-shot dwell IS the entrance under this bundle.
- Per-panel cadence is 600 ms (shots 0–3) then 1200 ms (shot 4 teal bridge) then 1400 ms (shot 5 title hold). Reconciles the stub's "200 ms per symbol" entrance — at the 600 ms cadence each glyph reads as a brand signal rather than a flicker; the primitive does not animate per-symbol entrance under `'palette-jump-cut'`, so the dwell time IS the entrance.
- Color contrast jump cuts (pink → teal → black → pink → teal) — instant, no fades. Pink-on-teal is iconic; brutalism is the register; do not soften with eases.

## Rules
- ○ △ □ symbols are the brand signal — must be present in any composition that cites this preset.
- Pink-on-teal is the iconic combination; do not substitute. (It became a viral Halloween costume palette.)
- Brutalism is the register — no rounded corners, no shadows, no gradients. `glow`, `highlightColor`, and `background` are deliberately UNSET in the binding.
- Korean title integration is mandatory if rendering for any Korean-language audience; do not Latinize. (v1 Latin-only — Hangul carve-out tracked as T-350a.)

## Acceptance (parity)
- Reference frame: 120 (= 4000 ms @ 30 fps; mid shot 5; full title visible on teal panel bleed).
- PSNR ≥ 42 dB, SSIM ≥ 0.98 (flat color register has low variance; sharp panel-color edges + title-text-on-teal contrast both produce high-frequency edge detail; hand-pinned per `parity-fixture-signoff.md` workflow per the F-4 follow-up flagged in T-359b).

## References
- `docs/compass_artifact.md` § Squid Game
- ADR-004 (preset system contract)
- T-321 — `TitleSequenceClip` primitive (the `'palette-jump-cut'` style bundle this preset wires)
- T-350 — preset promotion + first `titleSequence` clipKind binding
