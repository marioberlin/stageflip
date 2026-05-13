---
id: sky-news-pro-register
cluster: cluster-a
clipKind: lowerThird
source: https://news.sky.com/ + Wikipedia "Sky News" (public reference; no entry in docs/compass_artifact.md)
status: substantive
preferredFont:
  family: Sky Text
  license: proprietary-byo
fallbackFont:
  family: Plus Jakarta Sans
  weight: 700
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# Sky News Pro — lower third

## Visual tokens
- Bar: solid black `#000000` fill — the canonical Sky News lower-third register. Authoritative news-broadcaster posture, slightly more urgent than BBC Reith but less tabloid than CNN's UPPERCASE chevron-driven authority. The black bar provides high-contrast scaffolding for the red-strip brand mark and white text. As with the BBC + CNN consumers, the `LowerThird` primitive (T-183) accepts `background` as a single hex string with no opacity channel; v1 renders at 100 % opacity. Sky News production broadcasts commonly run the bar at ~85 % opacity over footage for legibility; on a flat-color parity canvas the solid black reads correctly at 100 % (see "Trade-offs").
- Accent strip: Sky News Red `#E10600` — rendered as a 6 px-wide flex child on the **left edge** of the composite (`borderRadius: 3`); this red strip IS the Sky News brand identifier. Never paint the full bar red.
- Headline color `#FFFFFF` (white on black); subtitle color renders in `#E10600` (Sky News Red — see "Trade-offs" below; not the stub-specified white).
- Bar anchored bottom-left at `insetLeftPx: 64`, `insetBottomPx: 56` — intermediate between BBC Reith's `insetBottomPx: 48` (sits visually lowest) and CNN-Classic's `insetBottomPx: 64`. Sky News broadcast canon places the bar a touch above the lower-frame margin reserved for the LIVE indicator + ticker stack.
- Card auto-fits the headline against a `minWidth: 240` floor with `padding: '12px 20px'` and uniform `borderRadius: 6` (Sky News broadcasts often use a sharper left edge against the red strip with a slightly rounder right edge; the primitive renders all four corners uniform — see "Trade-offs").
- v1 uses the existing `LowerThird` primitive (T-183) prop surface: `background`, `accent`, `textColor`, `name`, `title`, `insetLeftPx`, `insetBottomPx`. Snapshot constants live in `SKY_NEWS_PRO_REGISTER_PROPS` (exported from `@stageflip/parity-cli` at the cluster sign-off step).

## Typography
- Headline (`name`): Mixed Case applied at the snapshot string level (`'Mark Austin'`). Rendered at the primitive's default 34 px / fontWeight 700 — close to the broadcast register's 32–34 pt range. Mixed Case (NOT UPPERCASE) is the British-broadcaster register's signature; UPPERCASE would read as American-tabloid, contrary to Sky News's authoritative-but-not-shouting voice (between BBC's humanist register and CNN's chevron-driven authoritarian).
- Subtitle (`title`): Mixed Case (`'Senior News Anchor'`); rendered at 18 px / fontWeight 500. Three-word presenter role; ASCII-only; full coverage in the Plus Jakarta Sans fallback.
- Rendered family v1: `Plus Jakarta Sans` (the primitive's hard-coded inline `fontFamily`). The bespoke `Sky Text` (proprietary BYO) and the OFL fallback `Plus Jakarta Sans 700` declared in frontmatter exist for the type-design batch review (sister cluster-A composer task) — the OFL fallback happens to match the primitive's hard-coded family in this case, so the rendered family is faithful to the declared fallback. Adding a `font.family` prop to the `LowerThird` primitive remains a candidate `T-183z` primitive-level follow-up.
- Letter-spacing: the primitive hard-codes `letterSpacing: '-0.015em'` on the name and `letterSpacing: '0.02em'` on the title. Sky News broadcast typography uses a similar tight-name + open-subtitle posture, so the primitive's defaults align with the register without divergence.

## Animation
- Slide-in from the left over `ceil(fps * 0.45)` frames easing `EASE_OUT_QUART`; mid-shot hold; slide-out to the right over the last `ceil(fps * 0.35)` frames easing `EASE_IN_QUART` (per the `LowerThird` primitive contract from T-183). At 30 fps: ~450 ms entrance, ~350 ms exit.
- Steady-state mid-hold: `translatePct == 0`, `opacity == 1`. The parity golden captures this state at frame 60 (= 2000 ms @ 30 fps composition).
- Sky News broadcast canon shares the slide-in-from-left entrance choreography with the BBC + CNN registers; the timing constants (450 ms entrance / 350 ms exit) match the primitive's default contract.
- Animated decorations from the broadcast register — LIVE indicator pulse, ticker scroll, breaking-news red-strip flash — are deferred (see "Out of scope").

## Rules
- Use when an authoritative, news-broadcaster register is called for — on-air talent identification, presenter / role chyrons, contributor attribution. Sky News register sits between BBC Reith's humanist authority and CNN's tabloid authority; choose Sky News Pro for British-broadcaster tone with slightly more urgency than BBC.
- Do not use for breaking-news / urgent-alert contexts (use a `breakingBanner`-clipKind preset like `cnn-breaking` or `fox-news-alert`).
- Do not paint the full bar red. The 6 px-wide Sky News Red `#E10600` accent strip on the left is the brand identifier — pulling the strip to white (to recover the white-subtitle stub spec) would destroy the brand signal.
- Mixed Case (NOT UPPERCASE) for both headline and subtitle. UPPERCASE breaks the British-broadcaster register and migrates the visual onto American-tabloid territory (CNN's UPPERCASE chevron).
- Do not substitute the red strip for any other accent color. The strip IS the brand mark and ties the chyron to Sky News's broader on-air identity (LIVE indicator, ticker, breaking-news flash all use the same `#E10600`).
- Designed for live-news on-air talent identification across the full Sky News broadcast day — same legibility requirements as BBC Reith (subtitle ≥ 18 pt; primitive's 18 px default satisfies).

## Acceptance (parity)
- Reference frame: 60 (= 2000 ms @ 30 fps; steady-state mid-hold; bar + strip + headline + subtitle fully settled).
- PSNR ≥ 42 dB, SSIM ≥ 0.98 (hand-pinned per `parity-fixture-signoff.md` workflow per the F-4 follow-up flagged in T-359b — generator default 35 / 0.95 is overwritten on land; matches T-323 / T-324 / T-325 / T-358 / T-359 / T-360 cross-cluster norm).

## Trade-offs (v1 cosmetic divergences from the compass register)
- **Subtitle text renders red, not white.** The `LowerThird` primitive (T-183) renders the optional `title` line at `color: accent` (lower-third.tsx:129). With `accent: '#E10600'` the subtitle reads in Sky News Red on the black bar — broadcast canon places the subtitle in white. Painting `accent` white to match would also paint the left-edge strip white, killing the Sky News Red brand signal. v1 accepts the red subtitle text on the black bar (still legible at fontSize 18 against `#000000`). Allowing independent strip-vs-subtitle coloring (e.g., a new `subtitleColor?` prop) is a candidate primitive-level follow-up under the `T-183z`-family label — same trade-off T-323 + T-325 documented as D-T323-5 / D-T325 trade-off 1.
- **Rendered family is `Plus Jakarta Sans`, not the proprietary `Sky Text`.** The primitive hard-codes `fontFamily: 'Plus Jakarta Sans, sans-serif'` (lines 112, 126). The OFL fallback declared in frontmatter happens to match the hard-coded family for this preset, so the rendered family is faithful to the declared fallback — a quiet upgrade vs BBC + CNN where the declared OFL family diverged from the rendered family. The proprietary `Sky Text` (BYO) declared in frontmatter exists for the type-design batch review's evaluation of declared fonts and is not honored at render time.
- **Uniform 6 px border radius, not asymmetric sharp-left / rounded-right corners.** The primitive's card uses `borderRadius: 6` on all four corners. Sky News's broadcast lower-thirds occasionally feature a sharper left edge against the red strip with a slightly rounder right edge; v1 uses uniform 6 px — close to the canonical intent; the visual cluster identity (black bar + red strip + Mixed-Case typography) reads correctly at 6 px uniform. Asymmetric corner radii (e.g., `borderRadiusTopRightPx`) is a candidate primitive-level follow-up under the same `T-183z`-family label.
- **Background opacity rendered at 100 %, not the production ~85 %.** The primitive's `background` prop accepts a single hex string with no opacity channel. Pre-blending against an assumed canvas color is wrong on arbitrary footage; the 85 % spec is a production-time tunable for video-overlay legibility. v1 parity renders at 100 % on the flat-color parity canvas. Adding a `backgroundOpacity?` prop is a candidate primitive-level follow-up under the same `T-183z`-family label.

## Out of scope
- LIVE indicator (white "LIVE" badge + red pulse, persistent during live programming) — primitive-level concern; the `LowerThird` primitive does not expose a `liveIndicator` slot. Sister `breakingBanner` or `imageOverlay` composition territory, candidate `T-507a` IF Reviewer scrutiny demands.
- Ticker / flipper companion below the bar — semantically a `newsTicker`-clipKind preset; a sister Cluster A `sky-news-ticker` preset is the natural home. T-510 (News Pro premium news-ticker) covers the pack's ticker register.
- Breaking-news red-strip flash (the strip pulsing during urgent on-air moments) — primitive-level animation enum addition, candidate `T-507b` IF Reviewer scrutiny demands.
- Asymmetric corner radii (sharp left against the strip; rounder right) — primitive-level cosmetic concern under the `T-183z`-family label.

## References
- https://news.sky.com/ — canonical Sky News website (brand colors observed in production: `#E10600` red strip + black bar)
- Wikipedia "Sky News" — broadcast brand history and on-air register notes
- ADR-004 (preset system contract)
- T-183 — `LowerThird` primitive (the chyron this preset wires)
- T-323 — first `lowerThird` clipKind binding (`cnn-classic`, clipKind-default arm)
- T-325 — second `lowerThird` clipKind binding (`bbc-reith-dark`, first `PRESET_ID_BINDINGS` override; structural template for this preset)
- T-360 — `PRESET_ID_BINDINGS` mechanism (binding path for non-default `lowerThird` consumers)
- T-506 — News Pro pack skeleton (this preset's parent pack; landed the three placeholder register slots)
- T-507 — Sky News register substantive fill (this PR; first of three register slots; T-508 ITV + T-509 RAI fill the remaining slots; T-510 fills the news-ticker)
