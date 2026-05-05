---
id: al-jazeera-orange
cluster: news
clipKind: lowerThird
source: docs/compass_artifact.md#al-jazeera-english
status: substantive
preferredFont:
  family: Al Jazeera bilingual custom (Tarek Atrissi)
  license: proprietary-byo
fallbackFont:
  family: DIN 2014 (Latin) + Amiri (Arabic)
  weight: 600
  license: ofl
permissions: []
signOff:
  parityFixture: 'signed:2026-05-05'
  typeDesign: pending-cluster-batch
---

# Al Jazeera Orange — lower third

## Visual tokens
- Bar: light `#F7F7F5` fill — the canonical Al Jazeera English orange-on-light register; warm humanist register that distinguishes Al Jazeera from Western networks' cool-blue posture (compass canon: orange-on-light is the brand differentiator). Departure from T-323 `cnn-classic` (white banner) and T-325 `bbc-reith-dark` (dark bar) — al-jazeera sits in a **third** background register within Cluster A: light-but-warm, near-white (`#F7F7F5` is `#FFFFFF` shifted ~3 % toward warm grey).
- Accent strip: `#F7941D` (Al Jazeera Orange) — rendered as a 6 px-wide flex child on the **left edge** of the composite (`borderRadius: 3`); this orange strip IS the al-jazeera brand identifier vs. Western-networks' cool blues. Stub line 24 specifies a gradient `#F7941D` → `#E87722` (orange → amber); v1 picks the dominant orange `#F7941D` for the flat accent strip — the primitive's `accent` prop is a single hex string with no gradient channel (see "Trade-offs"). Never paint the full bar orange.
- Headline color `#222222` (near-black on light, slightly softer than pure black for the warm humanist register); subtitle color renders in `#F7941D` (Al Jazeera Orange — see "Trade-offs"; not the stub-specified `#222222`).
- Bar anchored bottom-left at `insetLeftPx: 64`, `insetBottomPx: 48` — closer to the bottom than T-323's `cnn-classic` (al-jazeera bars sit visually lower in the frame, like BBC's Reith). Matches T-325's anchor for cluster-internal consistency.
- Card auto-fits the headline against a `minWidth: 240` floor with `padding: '12px 20px'` and uniform `borderRadius: 6` (the al-jazeera broadcast canon includes asymmetric / single-side accents in production; the primitive renders all four corners uniform 6 px; see "Trade-offs").
- v1 uses the existing `LowerThird` primitive (T-183) prop surface: `background`, `accent`, `textColor`, `name`, `title`, `insetLeftPx`, `insetBottomPx`. Snapshot constants live in `AL_JAZEERA_ORANGE_PROPS` (exported from `@stageflip/parity-cli`).

## Typography
- Headline (`name`): Mixed Case applied at the snapshot string level (`'Marwan Bishara'`). Rendered at the primitive's default 34 px / fontWeight 700 — close to the stub's 28–32 pt range. Mixed Case (NOT UPPERCASE) is the correct register for presenter / contributor / analyst lower-thirds; ALL CAPS is reserved for show-titles + breaking-banner clipKinds (T-324 / T-327 territory). Two-word ASCII Latin name; full coverage in the Plus Jakarta Sans fallback.
- Subtitle (`title`): Mixed Case (`'Senior Political Analyst'`); rendered at 18 px / fontWeight 500. Three-word presenter role; ASCII-only; full coverage in the Plus Jakarta Sans fallback.
- Rendered family v1: `Plus Jakarta Sans` (the primitive's hard-coded inline `fontFamily`). The bespoke `Al Jazeera bilingual custom (Tarek Atrissi)` (proprietary BYO) and the OFL fallback `DIN 2014 (Latin) + Amiri (Arabic)` declared in frontmatter exist for the type-design batch review (T-331 / sister cluster-A composer task) — they are NOT honored at render time today; the primitive does not expose a `font.family` prop. Adding one is a candidate `T-183z` primitive-level follow-up, NOT a T-326 carve-out (mirrors T-323's D-T323-13 / T-325's D-T325-12-b posture).
- Letter-spacing: the primitive hard-codes `letterSpacing: '-0.015em'` on the name and `letterSpacing: '0.02em'` on the title. The stub's tracking expectations for DIN-like rounded-geometric Latin are not contradicted here in any structural way; cosmetic primitive-level concern if Reviewer demands a different metric.
- v1 ships **Latin only** — Arabic companion (`الجزيرة`) deferred to T-326a IF Reviewer demands. The `LowerThird` primitive has a single-string `name` + single-string `title`; no `secondaryName` / `secondaryTitle` / bilingual / direction / script axis; no RTL/bidi text-rendering pass; no matched-x-height Arabic font preload (Amiri is not in the FontManager). Same posture T-350 took for Hangul (`squid-game-geometric` D-T350-12: "v1 Latin only; Hangul deferred").

## Animation
- Slide-in from the left over `ceil(fps * 0.45)` frames easing `EASE_OUT_QUART`; mid-shot hold; slide-out to the right over the last `ceil(fps * 0.35)` frames easing `EASE_IN_QUART` (per the `LowerThird` primitive contract from T-183).
- Steady-state mid-hold: `translatePct == 0`, `opacity == 1`. The parity golden captures this state at frame 60 (= 2000 ms @ 30 fps composition).
- The stub describes a multi-stage entrance choreography (animated orange accent bar leading, 500 ms), Arabic-and-Latin parallel reveal, and a reverse slide R←L exit. The primitive does NOT decompose entrance into per-element timings, does NOT support a bilingual reveal as a `LowerThird` prop axis, and does NOT support a reverse-direction exit (its exit is to the right). v1 ships only the steady-state register; the multi-stage entrance, bilingual reveal, and reverse-slide exit are deferred to primitive-level follow-ups (`T-183z`-family) IF Reviewer scrutiny demands them. Same divergence shape T-323 + T-325 hit.
- LiveDataClip / frontier-tenant data updates (stub line 38) are out of scope for `lowerThird` (non-frontier clipKind; ADR-005 frontier track owns).

## Rules
- Use when a warm humanist, presenter / role-identification register is called for — contributor identification, on-screen attribution, presenter-and-role lower-third where Al Jazeera's signature orange-on-light warmth is the brand signal.
- Do not use for breaking-news / urgent-alert contexts (use a `breakingBanner`-clipKind preset).
- Do not paint the full bar orange. The 6 px-wide Al Jazeera Orange `#F7941D` accent strip on the left is the brand identifier — pulling the strip neutral (e.g., to recover the dark `#222222` subtitle stub spec) would destroy the brand signal vs. Western-network blues.
- Do not substitute a warm-red or yellow for "warmer" (compass canon line 43). Al Jazeera Orange is the differentiator; warm-red trends toward CNN-Classic; yellow trends toward Sky News register.
- The bilingual signature (Latin + Arabic companion) is canonical to al-jazeera identity. v1 ships Latin-only by primitive constraint; T-326a is the carve-out path for bilingual rendering (new prop axis + RTL/bidi pass + Arabic font preload). Latin-only does not violate compass-register intent — the orange-on-light, dark-text, DIN-like Latin posture is itself the brand signal.
- Typography fallback must preserve both a rounded-geometric Latin and a matched-x-height Arabic; the OFL fallback `DIN 2014 (Latin) + Amiri (Arabic)` declared in frontmatter satisfies this for the type-design batch review. v1 renders in Plus Jakarta Sans by primitive constraint.
- ALL CAPS is reserved for show-titles + breaking-banner clipKinds (e.g., `'INSIDE STORY'`, `'BREAKING NEWS'`); the steady-state presenter / role-identification lower-third is Mixed Case canonically.

## Acceptance (parity)
- Reference frame: 60 (= 2000 ms @ 30 fps; steady-state mid-hold; bar + strip + headline + subtitle fully settled).
- PSNR ≥ 42 dB, SSIM ≥ 0.98 (hand-pinned per the F-4 follow-up flagged in T-359b — generator default `35 / 0.95` is overwritten on land; matches T-323 / T-325 / T-358 / T-359 / T-360 cross-cluster norm). The stub's `40 / 0.96` was rationalised on bilingual-kerning variance which is N/A for v1 Latin-only.

## Trade-offs (v1 cosmetic divergences from the compass register)
- **Subtitle text renders orange, not dark `#222222`.** The `LowerThird` primitive (T-183) renders the optional `title` line at `color: accent` (lower-third.tsx:129). With `accent: '#F7941D'` the subtitle reads in Al Jazeera Orange on the light bar — the stub specified `#222222`. Painting `accent` dark to match would also paint the left-edge strip dark, killing the orange brand signal that differentiates al-jazeera from Western-network blues (compass canon line 43). v1 accepts the orange subtitle on the light bar (orange-on-light has lower contrast than dark-on-light but remains legible at fontSize 18). Allowing independent strip-vs-subtitle coloring (e.g., a new `subtitleColor?` prop) is a candidate primitive-level follow-up under the `T-183z`-family label — same trade-off T-323 + T-325 documented.
- **Rendered family is `Plus Jakarta Sans`, not `DIN 2014 + Amiri` or the bespoke `Al Jazeera bilingual custom (Tarek Atrissi)` pairing.** The primitive hard-codes `fontFamily: 'Plus Jakarta Sans, sans-serif'` (lines 112, 126). The OFL fallback declared in frontmatter is for the type-design batch review's evaluation of declared fonts, not the rendered family. Bespoke-font invariant 6 is satisfied via the OFL-fallback declaration regardless of what renders. Same divergence T-323 hit (D-T323-13) and T-325 hit (D-T325-12-b).
- **Uniform 6 px border radius, not asymmetric / single-sided corners.** The primitive's card uses `borderRadius: 6` on all four corners. al-jazeera's broadcast lower-thirds in production sometimes feature single-side accents (sharp left edge against the orange strip; rounded right edge); v1 uses uniform 6 px — close to the stub's intent; the visual cluster identity (light bar + orange strip + Mixed-Case typography) reads correctly at 6 px uniform. Asymmetric corner radii is a candidate primitive-level follow-up under the same `T-183z`-family label.
- **Flat single-color accent, not the orange→amber gradient.** The primitive's `accent` prop is a single hex string; gradient mode is not supported. Stub line 24 specifies `#F7941D` → `#E87722` (orange → amber gradient on the left strip); v1 picks the dominant orange `#F7941D` and renders flat. The gradient is a candidate primitive-level follow-up (`T-183z`-family `accent-gradient` mode, e.g., `accent: string | { from: string; to: string }`). al-jazeera-specific divergence (T-323 + T-325 had no gradient spec).

## Out of scope
- Arabic companion (`الجزيرة` second-language slot; bilingual rendering with RTL/bidi pass and matched-x-height Arabic font preload) — primitive-level prop-axis carve-out, candidate **`T-326a`** IF Reviewer scrutiny demands. Mirrors T-350's D-T350-12 Hangul-deferred posture.
- Multi-stage entrance choreography (animated orange accent bar leading, 500 ms; arabic-and-latin parallel reveal) — primitive-level entrance enum + sub-element timing required, candidate `T-183z`-family follow-up.
- Reverse slide R←L exit (instead of the primitive's slide-out to the right) — primitive-level exit enum addition, candidate `T-183z`-family follow-up.
- Kraft-paper / textured background finish for TV-only variants (stub line 27) — primitive's `background` prop is a single hex string with no texture/pattern overlay support; primitive-level `T-183z`-family carve-out.
- Extended bar width to accommodate bilingual text (stub line 26) — tied to bilingual deferral; v1 single-language Latin uses primitive's default `minWidth: 240` driven by content. When bilingual lands in T-326a, the primitive needs a `minWidth` override or organic content widening.
- Show-titles ALL CAPS register (stub line 33) — register selection within al-jazeera identity; show-titles + breaking-banner clipKinds (T-324 / T-327) own ALL CAPS.
- LiveDataClip / frontier-tenant data updates (stub line 38) — non-frontier clipKind; ADR-005 frontier track owns.
- Cluster A `news` SKILL.md modification — owned by T-331 (cluster composer task).
- `docs/ops/parity-fixture-signoff.md` modification — procedural-only doc per `MEMORY.md` `feedback_parity_signoff_doc_is_procedural.md`; sign-off lives in preset frontmatter, not in this file.

## References
- `docs/compass_artifact.md` § Al Jazeera English, § Al Jazeera (News section)
- Compass canon note: orange-on-light is the al-jazeera differentiator vs. Western-networks' cool blues; bilingual (Latin + Arabic) is the canonical signature
- ADR-004 (preset system contract)
- T-183 — `LowerThird` primitive (the chyron this preset wires)
- T-323 — first `lowerThird` clipKind binding (clipKind-default; T-326 sits beside as the third `lowerThird` consumer via PRESET_ID_BINDINGS override)
- T-325 — second `lowerThird` clipKind binding (first PRESET_ID_BINDINGS override; T-326's primary template)
- T-360 — `PRESET_ID_BINDINGS` mechanism (T-326's binding path)
- T-350 — Cluster D first preset; precedent for "v1 Latin only; non-Latin script deferred to Ta carve-out" (D-T350-12 Hangul deferral)
- T-326 — preset promotion + third `lowerThird` clipKind binding via PRESET_ID_BINDINGS override (this preset)
- Carve-out task (potential): **T-326a** — `LowerThird` primitive bilingual second-language slot (Latin + Arabic, RTL/bidi rendering, matched-x-height Arabic font preload). Ships ONLY if Reviewer demands inline OR a future tenant requires bilingual rendering.
