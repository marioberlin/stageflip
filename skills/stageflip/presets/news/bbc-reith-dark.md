---
id: bbc-reith-dark
cluster: news
clipKind: lowerThird
source: docs/compass_artifact.md#bbc-news
status: substantive
preferredFont:
  family: BBC Reith Serif + BBC Reith Sans
  license: proprietary-byo
fallbackFont:
  family: Source Serif 4 + Source Sans 3
  weight: 600
  license: ofl
permissions: []
signOff:
  parityFixture: 'signed:2026-05-05'
  typeDesign: 'signed:2026-05-14'
---

# BBC Reith Dark — lower third

## Visual tokens
- Bar: dark `#1A1A1A` fill — the canonical BBC Reith-dark register, public-broadcaster / humanist register. Stub specifies `#1A1A1A` @ 85 % opacity for footage-overlay legibility; the `LowerThird` primitive (T-183) accepts `background` as a single hex string with no opacity channel, so v1 renders at 100 % opacity. The 85 % spec is a production-time tunable for arbitrary-footage overlays; on a flat-color parity canvas the dark bar reads correctly at 100 % (see "Trade-offs").
- Accent strip: `#BB1919` (BBC Red) — rendered as a 6 px-wide flex child on the **left edge** of the composite (`borderRadius: 3`); this red strip IS the BBC brand identifier. Never paint the full bar red.
- Headline color `#FFFFFF` (white on dark); subtitle color renders in `#BB1919` (BBC Red — see "Trade-offs" below; not the stub-specified white).
- Bar anchored bottom-left at `insetLeftPx: 64`, `insetBottomPx: 48` — closer to the bottom than T-323's `cnn-classic` (BBC Reith bars sit visually lower in the frame).
- Card auto-fits the headline against a `minWidth: 240` floor with `padding: '12px 20px'` and uniform `borderRadius: 6` (the BBC broadcast canon sometimes shows asymmetric corners — sharp left edge against the red strip, rounded right edge — but the primitive renders all four corners uniform 6 px; see "Trade-offs").
- v1 uses the existing `LowerThird` primitive (T-183) prop surface: `background`, `accent`, `textColor`, `name`, `title`, `insetLeftPx`, `insetBottomPx`. Snapshot constants live in `BBC_REITH_DARK_PROPS` (exported from `@stageflip/parity-cli`).

## Typography
- Headline (`name`): Mixed Case applied at the snapshot string level (`'Sarah Smith'`). Rendered at the primitive's default 34 px / fontWeight 700 — close to the stub's 26–32 pt range. Mixed Case (NOT UPPERCASE) is the BBC humanist register's signature — UPPERCASE would read as American-tabloid, contrary to the BBC voice.
- Subtitle (`title`): Mixed Case (`'Chief Political Correspondent'`); rendered at 18 px / fontWeight 500. Three-word presenter role; ASCII-only; full coverage in the Plus Jakarta Sans fallback.
- Rendered family v1: `Plus Jakarta Sans` (the primitive's hard-coded inline `fontFamily`). The bespoke `BBC Reith Serif + BBC Reith Sans` (proprietary BYO) and the OFL fallback `Source Serif 4 + Source Sans 3` declared in frontmatter exist for the type-design batch review (T-331 / sister cluster-A composer task) — they are NOT honored at render time today; the primitive does not expose a `font.family` prop. Adding one is a candidate `T-183z` primitive-level follow-up, NOT a T-325 carve-out (mirrors T-323's D-T323-13 posture).
- Letter-spacing: the primitive hard-codes `letterSpacing: '-0.015em'` on the name and `letterSpacing: '0.02em'` on the title. The stub's "+10–15 tracking" maps to roughly `+0.04em` to `+0.06em`, contradicting the primitive's tight-name + open-title posture; cosmetic divergence, primitive-level concern.

## Animation
- Slide-in from the left over `ceil(fps * 0.45)` frames easing `EASE_OUT_QUART`; mid-shot hold; slide-out to the right over the last `ceil(fps * 0.35)` frames easing `EASE_IN_QUART` (per the `LowerThird` primitive contract from T-183).
- Steady-state mid-hold: `translatePct == 0`, `opacity == 1`. The parity golden captures this state at frame 60 (= 2000 ms @ 30 fps composition).
- The stub describes a multi-stage entrance choreography (red strip 150 ms → bar wipe L→R 400 ms → text slide 200 ms; total ≈ 500–600 ms), a ticker / flipper companion below the bar, and a fade-down exit. The primitive does NOT decompose entrance into per-element timings, does NOT support a ticker companion as a `LowerThird` prop, and does NOT support a fade-down exit. v1 ships only the steady-state register; the multi-stage entrance, ticker companion, and fade-down exit are deferred to T-325a / T-325b / T-325c carve-outs IF Reviewer scrutiny demands them (per D-T325-3).

## Rules
- Use when a humanist, authoritative, public-broadcaster register is called for — presenter / role identification, contributor identification, on-screen attribution.
- Do not use for breaking-news / urgent-alert contexts (use a `breakingBanner`-clipKind preset like `cnn-breaking` or `fox-news-alert`).
- Do not paint the full bar red. The 6 px-wide BBC Red `#BB1919` accent strip on the left is the brand identifier — pulling the strip to white (to recover the white-subtitle stub spec) would destroy the brand signal.
- The serif/sans pairing is the brand signature in production — do not substitute a single-family compose. v1 renders in Plus Jakarta Sans by primitive constraint; the bespoke pairing intent is preserved in frontmatter for the type-design batch review.
- Flipper, not scroll, for any ticker companion — this is the BBC canon (comprehension > density). Ticker companion is a sister `newsTicker`-clipKind preset, not a T-325 prop axis.
- Designed for legibility across ages 5–85 — avoid shrinking below 18 pt on the subtitle (primitive's 18 px default already satisfies).

## Acceptance (parity)
- Reference frame: 60 (= 2000 ms @ 30 fps; steady-state mid-hold; bar + strip + headline + subtitle fully settled).
- PSNR ≥ 42 dB, SSIM ≥ 0.98 (hand-pinned per `parity-fixture-signoff.md` workflow per the F-4 follow-up flagged in T-359b — generator default 35 / 0.95 is overwritten on land; matches T-323 / T-358 / T-359 / T-360 cross-cluster norm).

## Trade-offs (v1 cosmetic divergences from the compass register)
- **Subtitle text renders red, not white.** The `LowerThird` primitive (T-183) renders the optional `title` line at `color: accent` (lower-third.tsx:129). With `accent: '#BB1919'` the subtitle reads in BBC Red on the dark bar — the stub specified `#FFFFFF`. Painting `accent` white to match would also paint the left-edge strip white, killing the BBC Red brand signal. v1 accepts the red subtitle text on the dark bar (still legible at fontSize 18). Allowing independent strip-vs-subtitle coloring (e.g., a new `subtitleColor?` prop) is a candidate primitive-level follow-up under the `T-183z`-family label — same trade-off T-323 documented as D-T323-5.
- **Rendered family is `Plus Jakarta Sans`, not `Source Serif 4 + Source Sans 3` or BBC Reith Serif + Sans.** The primitive hard-codes `fontFamily: 'Plus Jakarta Sans, sans-serif'` (lines 112, 126). The OFL fallback declared in frontmatter is for the type-design batch review's evaluation of declared fonts, not the rendered family. Bespoke-font invariant 6 is satisfied via the OFL-fallback declaration regardless of what renders. Same divergence T-323 hit (D-T323-13).
- **Uniform 6 px border radius, not asymmetric / single-sided corners.** The primitive's card uses `borderRadius: 6` on all four corners. BBC's broadcast lower-thirds in production sometimes feature single-side accents (sharp left edge against the red strip; rounded right edge); v1 uses uniform 6 px — close to the stub's intent; the visual cluster identity (dark bar + red strip + Mixed-Case typography) reads correctly at 6 px uniform. Asymmetric corner radii (e.g., `borderRadiusTopRightPx`) is a candidate primitive-level follow-up under the same `T-183z`-family label.
- **Background opacity rendered at 100 %, not the stub's 85 %.** The primitive's `background` prop accepts a single hex string with no opacity channel. Pre-blending against an assumed canvas color is wrong on arbitrary footage; the 85 % spec is a production-time tunable for video-overlay legibility. v1 parity renders at 100 % on the flat-color parity canvas. Adding a `backgroundOpacity?` prop is a candidate primitive-level follow-up under the same `T-183z`-family label.

## Out of scope
- Multi-stage entrance choreography (red strip 150 ms → bar wipe L→R 400 ms → text slide 200 ms) — primitive-level entrance enum + sub-element timing required, candidate `T-325a` IF Reviewer scrutiny demands.
- Ticker / flipper companion below the bar (per the 2019 BBC rebrand canon; comprehension > density) — semantically a `newsTicker`-clipKind preset; a sister Cluster A `bbc-reith-dark-ticker` preset would be the natural home, candidate `T-325b`.
- Fade-down exit (instead of the primitive's slide-out to the right) — primitive-level exit enum addition, candidate `T-325c`.
- Letter-spacing override (+10–15 tracking) — primitive hard-codes `-0.015em` on name + `0.02em` on title; cosmetic primitive-level concern.

## References
- `docs/compass_artifact.md` § BBC News
- Compass canon note: BBC Reith won a Red Dot Design Award; fallback pairing must preserve serif+sans hierarchy
- ADR-004 (preset system contract)
- T-183 — `LowerThird` primitive (the chyron this preset wires)
- T-323 — first `lowerThird` clipKind binding (clipKind-default; T-325 sits beside as the second `lowerThird` consumer via PRESET_ID_BINDINGS override)
- T-360 — `PRESET_ID_BINDINGS` mechanism (T-325's binding path)
- T-325 — preset promotion + second `lowerThird` clipKind binding via PRESET_ID_BINDINGS override
