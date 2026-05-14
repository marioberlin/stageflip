---
id: cnn-classic
cluster: news
clipKind: lowerThird
source: docs/compass_artifact.md#cnn
status: substantive
preferredFont:
  family: CNN Sans
  license: proprietary-byo
fallbackFont:
  family: Inter Tight
  weight: 700
  license: ofl
permissions: []
signOff:
  parityFixture: 'signed:2026-05-05'
  typeDesign: 'signed:2026-05-14'
---

# CNN Classic — lower third

## Visual tokens
- Banner: `#FFFFFF` fill (white) — the canonical CNN-Classic chyron card.
- End cap: `#CC0000` flag on the far left (Boston University Red / PMS 2347 C). The flag end-cap IS the brand identifier — never paint the full banner red.
- Headline color `#000000` (black on white); talent ID color `#CC0000` (red — see "Trade-offs" below).
- Banner anchored bottom-left at `insetLeftPx: 64`, `insetBottomPx: 64` (within the stub's "60–80 px from bottom" window).
- Card auto-fits the headline against a `minWidth: 240` floor with `padding: '12px 20px'` and uniform `borderRadius: 6` (the post-2023 single upper-right 8 px radius is a primitive-level concern and is NOT applied in v1 — see "Out of scope").
- v1 uses the existing `LowerThird` primitive (T-183) prop surface: `background`, `accent`, `textColor`, `name`, `title`, `insetLeftPx`, `insetBottomPx`. Snapshot constants live in `CNN_CLASSIC_PROPS` (exported from `@stageflip/parity-cli`).

## Typography
- Headline (`name`): UPPERCASE applied at the snapshot string level (`'BREAKING: SUPREME COURT RULES'`). Rendered at the primitive's default 34 px / fontWeight 700.
- Talent ID (`title`): Mixed Case (`'Anderson Cooper · Chief Anchor'`); rendered at 18 px / fontWeight 500. The `·` (U+00B7 middle dot) separates name and role — single BMP glyph, full coverage in the Plus Jakarta Sans fallback.
- Rendered family v1: `Plus Jakarta Sans` (the primitive's hard-coded inline `fontFamily`). The bespoke `CNN Sans` (proprietary BYO) and OFL fallback `Inter Tight 700` declared in frontmatter exist for the type-design batch review (T-331 / sister cluster-A composer task) — they are NOT honored at render time today; the primitive does not expose a `font.family` prop. Adding one is a candidate `T-183z` primitive-level follow-up, NOT a T-323 carve-out.

## Animation
- Slide-in from the left over `ceil(fps * 0.45)` frames easing `EASE_OUT_QUART`; mid-shot hold; slide-out to the right over the last `ceil(fps * 0.35)` frames easing `EASE_IN_QUART` (per the `LowerThird` primitive contract from T-183).
- Steady-state mid-hold: `translatePct == 0`, `opacity == 1`. The parity golden captures this state at frame 60 (3 s @ 30 fps composition).
- Animated decorations from the broadcast register — LIVE bug pulse, ticker scroll, red-block-wipe text-change transition — are deferred (see "Out of scope").

## Rules
- Use for: speaker chyrons, on-air talent identification, breaking-news contributor banners, urgent-but-ongoing live programming.
- Do not use for: resolved story updates (drop the red flag; use a non-CNN cluster-A preset).
- Do not paint the full banner red. The 6 px-wide red flag end-cap on the left is the identifier.
- Do not crossfade text changes in production compositions — the canonical CNN-Classic transition is a red block wipe L→R; that lives at the orchestration layer, not in this preset (see "Out of scope" T-323d).

## Acceptance (parity)
- Reference frame: 60 (= 2000 ms @ 30 fps; steady-state mid-hold; banner + flag + headline + talent fully settled).
- PSNR ≥ 42 dB, SSIM ≥ 0.98 (hand-pinned per `parity-fixture-signoff.md` workflow per the F-4 follow-up flagged in T-359b — generator default 35 / 0.95 is overwritten on land).

## Trade-offs (v1 cosmetic divergences from the compass register)
- **Talent text renders red, not black.** The `LowerThird` primitive (T-183) renders the optional `title` line at `color: accent` (lower-third.tsx:129). With `accent: '#CC0000'` the talent line reads in CNN red on the white banner — the stub specified `#000000`. Painting `accent` black to match would also paint the flag end-cap black, killing the brand signal. v1 accepts the red talent text. Allowing independent flag-vs-title coloring (e.g., a new `titleColor?` prop) is a candidate primitive-level follow-up.
- **Rendered family is `Plus Jakarta Sans`, not `Inter Tight`.** The primitive hard-codes `fontFamily: 'Plus Jakarta Sans, sans-serif'` (lines 112, 126). The OFL fallback declared in frontmatter is for the type-design batch review's evaluation of declared fonts, not the rendered family. Bespoke-font invariant 6 is satisfied via the declaration regardless of what renders.
- **Uniform 6 px border radius, not single-corner 8 px upper-right.** The primitive's card uses `borderRadius: 6` on all four corners. The post-2023 single upper-right 8 px radius would require a primitive prop. v1 uses uniform 6 px — close to the stub's intent; the visual cluster identity (white banner + red flag + UPPERCASE headline) reads correctly at 6 px uniform.

## Out of scope
- LIVE bug (red pulsing dot, 2 s cycle) — primitive-level follow-up, candidate `T-323a` IF Reviewer scrutiny demands.
- CNN bug (rounded white box, bottom-right) — orchestration-level composition (separate `imageOverlay` clip beside the lower-third), candidate `T-323b`.
- Ticker strip (dark gradient below banner, scrolling text) — semantically a `newsTicker` clipKind (already wired in the resolver per T-356); a sister Cluster A `cnn-classic-ticker` `newsTicker`-clipKind preset would be the natural home, candidate `T-323c`.
- Red block wipe L→R on text change — orchestration-layer transition between two `LowerThird` mounts; not a primitive prop, candidate `T-323d`.

## References
- `docs/compass_artifact.md` § CNN, § CNN Breaking News banner
- ADR-004 (preset system contract)
- T-183 — `LowerThird` primitive (the chyron this preset wires)
- T-323 — preset promotion + first `lowerThird` clipKind binding
