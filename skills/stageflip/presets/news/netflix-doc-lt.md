---
id: netflix-doc-lt
cluster: news
clipKind: lowerThird
source: docs/compass_artifact.md#netflix-documentaries
status: substantive
preferredFont:
  family: Netflix Sans
  license: proprietary-byo
fallbackFont:
  family: DM Sans
  weight: 500
  license: ofl
permissions: []
signOff:
  parityFixture: 'signed:2026-05-05'
  typeDesign: pending-cluster-batch
---

# Netflix Documentary — lower third

## Visual tokens
- **Text-only register** (compass canon line 23 "Clean white `#FFFFFF` text directly on footage"; line 41 "No background box."). Netflix's documentary register ships zero colored chrome — no flag, no card visually present against the canvas. The `LowerThird` primitive (T-183 + T-183z) renders a 6 px-wide accent strip by default; T-183z's `noFlag: boolean` prop suppresses the strip entirely. Snapshot pins `noFlag: true` (T-183z **second** production consumer milestone after T-330 — D-T329-3).
- **No visible card** — the primitive renders a card with `padding: '12px 20px'` + `borderRadius: 6` + `boxShadow: '0 8px 24px rgba(0,0,0,0.24)'`. v1 trade-off: set `background: '#000000'` (canvas-matching black) so the card's fill blends into a dark canvas; the box visually disappears. The hard-coded `boxShadow` may produce a faint visible edge — see "Trade-offs" (D-T329-11-a). Carving out a `shadow?` prop is a `T-183z`-family follow-up.
- **Bottom-left anchor with generous whitespace** (compass canon line 26 "120 px from left, 80 px from bottom @ 1080p"). v1 picks the stub's exact values: `insetLeftPx: 120`, `insetBottomPx: 80`. Mirrors T-330's "float" posture (Apple TV+ uses 140 / 95) — Netflix's documentary register sits a touch closer to the edge than Apple TV+ but still well clear of the far-left 64 of T-323 / T-325 / T-326.
- **Colors** — headline `#FFFFFF` (white-on-black per Netflix's clean register); subtitle `#FFFFFF` via T-183z `subtitleColor` (D-T329-4 — talent-line decoupled from `accent`); `accent: '#FFFFFF'` (irrelevant — `noFlag: true` suppresses rendering). Tied with T-330 (Apple TV+) for most-restrained color register in Cluster A — both pure white on black.
- v1 uses the existing `LowerThird` primitive (T-183 + T-183z) prop surface: `name`, `title`, `accent`, `background`, `textColor`, `insetLeftPx`, `insetBottomPx`, `noFlag`, `subtitleColor`, `font`. Snapshot constants live in `NETFLIX_DOC_LT_PROPS` (exported from `@stageflip/parity-cli`).

## Typography
- **Headline (`name`)**: `'Ava DuVernay'` — Mixed Case applied at the snapshot string level (D-T329-6). Two-word ASCII Latin name; full coverage in DM Sans Medium. Real Netflix doc collaborator (director of *13TH* (2016, Oscar-nominated Netflix Original)). Rendered at the primitive's default 34 px / `fontWeight: 500` per T-183z `font.weight`.
- **Subtitle (`title`)**: `'DIRECTOR'` — **literal ALL CAPS** applied at the snapshot string level (D-T329-6); single-word presenter-role string; ASCII-only. Rendered at 18 px / `fontWeight: 500`. The primitive applies `font.weight` uniformly to both name and title (lines 88–90 of `lower-third.tsx`); v1 picks Medium (500) — closest to the stub's "Medium / SemiBold" name register at the lighter end of the range. Per-line weight (Light title vs Medium name per stub line 30) is NOT honored — primitive has no per-line weight axis.
- **Casing — canonical "headline Mixed Case + title ALL CAPS" snapshot-string pattern** (D-T329-6). The primitive does NOT have a per-line `casing` prop; the casing difference is encoded directly in the prop string values. T-330 (Apple TV+) ships uniformly Mixed Case; T-329 differs because Netflix's "ALL CAPS + wide tracking on the title is the signature; do not collapse to Mixed Case" is an explicit rule (stub line 43). T-329 establishes this pattern as the canonical posture for any future preset whose stub demands per-line casing (HBO/Showtime documentary patterns will reuse it verbatim). Carving out a per-line `casing` prop on the primitive is a `T-183z`-family follow-up.
- **Family**: `DM Sans` weight 500 (Medium) via T-183z `font: { family: 'DM Sans', weight: 500 }` (D-T329-5 — second production consumer milestone). DM Sans Medium is the OFL fallback for Netflix's proprietary `Netflix Sans` Medium (`proprietary-byo`; Netflix-licensed in-house typeface that saves Netflix "millions of dollars" in Gotham licensing per stub line 53); DM Sans ships under SIL Open Font License 1.1 via Google Fonts and is already on the OFL whitelist in `THIRD_PARTY.md` from sister preset corpus. DM Sans is Google's "approachable geometric grotesque" (stub line 31) and closely approximates Netflix Sans's humanist warmth at the same x-height.
- **Letter-spacing**: the primitive hard-codes `letterSpacing: '-0.015em'` (name) / `'0.02em'` (title). The stub's "letter spacing +50–100" (name) / "+150–200" (title) is not exposed as a primitive prop axis; cosmetic primitive-level concern. v1 ships with the primitive's defaults. Wide-tracking on the title (the stub's "+150–200" canonical signature) is NOT honored — `T-183z`-family follow-up if demanded.
- **Latin-only** — Netflix's English-language documentary corpus ships at canon; no bilingual axis to defer.

## Animation
- Slide-in from the left over `ceil(fps * 0.45)` frames easing `EASE_OUT_QUART`; mid-shot hold; slide-out to the right over the last `ceil(fps * 0.35)` frames easing `EASE_IN_QUART` (per the `LowerThird` primitive contract from T-183).
- Steady-state mid-hold: `translatePct == 0`, `opacity == 1`. The parity golden captures this state at frame 60 (= 2000 ms @ 30 fps composition; comfortably mid-hold per D-T329-7).
- The compass stub (line 34) describes a "simple fade-in, 500–1000 ms" OR (line 35) "gentle slide up from below, 600 ms ease-out", a 4–7 s static hold, and a mirrored fade-out (lines 37–38). The primitive does NOT decompose entrance into a fade-only mode, does NOT support a vertical slide axis (slides horizontally only), does NOT support symmetric ease curves (its curves are asymmetric `EASE_OUT_QUART` / `EASE_IN_QUART`), and does NOT support a fade-out exit (slides out horizontally instead). v1 ships only the steady-state register; fade-in, slide-up entrance, symmetric easing, and the mirrored fade-out exit are all primitive-level follow-ups (`T-183z`-family) IF Reviewer scrutiny demands them. Same divergence shape T-323 / T-325 / T-326 / T-330 documented.
- Netflix favors subtlety — no bounce, no elastic (stub line 38). The primitive's asymmetric quart curves are not bouncy or elastic; the v1 register is congruent with the "no bounce" rule even though the curve shape itself diverges from the canon fade.
- LiveDataClip / frontier-tenant data updates are out of scope for `lowerThird` (non-frontier clipKind; ADR-005 frontier track owns).

## Rules
- Use this preset by default when no broadcast-register brand is specified (compass canon line 44 "falls back to documentary-neutral"). Common deployment: documentary credits, talent role-identification on dark-leaning footage, "documentary-neutral default" register.
- **No background box** (compass canon line 41). If the footage is so busy a box is needed, re-framing the shot is the right answer — not adding a box. T-329 honors this rule by passing `noFlag: true` AND `background: '#000000'`; the card visually disappears against a dark canvas.
- Generous padding is non-negotiable — this is typographic art, not information packing (compass canon line 42). Do NOT collapse the inset to far-left (64 px) for cluster-internal consistency; the 120 / 80 inset IS the register.
- **ALL CAPS + wide tracking on the title is the signature; do not collapse to Mixed Case** (compass canon line 43). T-329 honors the ALL CAPS rule via D-T329-6 (snapshot-string casing); wide-tracking is NOT honored (primitive has no `letterSpacing` prop axis — `T-183z`-family follow-up).
- Typography fallback must preserve the "approachable geometric grotesque" register (stub line 31); the OFL fallback `DM Sans` weight 500 declared in frontmatter satisfies this for the type-design batch review. v1 renders in DM Sans Medium (T-183z `font` prop) — closer to compass register than T-323 / T-325 / T-326 which render in Plus Jakarta Sans (the primitive's pre-T-183z default).

## Acceptance (parity)
- Reference frame: 60 (= 2000 ms @ 30 fps; steady-state mid-hold; headline + subtitle fully on screen at full opacity, no slide).
- PSNR ≥ 42 dB, SSIM ≥ 0.98 — written directly into `parity-fixtures/news/netflix-doc-lt/thresholds.json` by the F-4 generator flags `--psnr=42 --ssim=0.98` (D-T329-9). T-329 is the **second preset PR to use F-4 flags** after T-330; the manual `thresholds.json` hand-pin step T-323 / T-325 / T-326 used is retired. The text-only register has the lowest aliasing surface in the cluster — `42 / 0.98` sits comfortably above the noise floor.

## Trade-offs (v1 cosmetic divergences from the compass register)
- **Card boxShadow may be visible at edges.** The `LowerThird` primitive hard-codes `boxShadow: '0 8px 24px rgba(0,0,0,0.24)'` on the card (line 146 of `lower-third.tsx`). With `background: '#000000'` matching a dark canvas the card fill blends in; the shadow may still produce a faint visible edge. Netflix's "no background box" register (compass lines 23, 41) does not call for any shadow at all. Carving out a `shadow?` prop is a `T-183z`-family follow-up. NOT a T-329 fix.
- **Uniform 6 px corner radius.** The primitive's card uses `borderRadius: 6` on all four corners. Netflix doc's text-only register has no card so corners are visually irrelevant when `background === canvas`; documented for completeness. NOT a T-329 fix.
- **Animation curve mismatch + no slide-up entrance.** Primitive uses `EASE_OUT_QUART` (entry) / `EASE_IN_QUART` (exit); horizontal slide-in only. Netflix's register favors a "simple fade-in" (stub line 34) OR "gentle slide up from below" (line 35) — neither is honored by the primitive. Cosmetic; the parity golden is at steady-state mid-hold (frame 60) where the curve is irrelevant. NOT a T-329 fix.
- **No vignette, no separator, no wide-tracking, no per-line weight, no ALL-CAPS via casing prop.** Netflix-doc specific treatments not honored by the primitive: bottom-of-frame vignette is canvas-level work (scene-composer territory); thin separator line between name and title is not a primitive prop; wide-tracking +150–200 on title is not a primitive prop axis; per-line weight (Light title vs Medium name) is not a primitive axis; per-line casing prop is not a primitive axis (T-329 honors the ALL-CAPS title rule via D-T329-6 snapshot-string casing instead). All five sub-divergences sidestepped by the steady-state mid-hold parity golden + snapshot-string ALL CAPS pattern. NOT T-329 fixes — primitive-level / canvas-level `T-183z`-family follow-ups.
- All four divergences SHARE the `T-183z`-family follow-up label. T-329 inherits, does not introduce, does not widen, does not fix.

## Out of scope
- Word-by-word reveals — primitive-level `T-183z`-family carve-out.
- Gentle slide-up entrance (stub line 35) — primitive slides horizontally only; no vertical slide axis.
- Subtle dark gradient vignette at bottom of frame (stub line 24) — canvas-level treatment, not a primitive prop.
- Thin line separator between name and title (stub line 25) — primitive does not render a horizontal separator.
- ALL CAPS title via `casing` prop (per-line casing axis) — primitive has no per-line casing prop; T-329 ships ALL CAPS at the snapshot-string level per D-T329-6 instead.
- Letter-spacing tracking (+50–100 on name, +150–200 on title per stub lines 29–30) — primitive has no `letterSpacing` prop.
- Per-line weight (Medium for name, Light/Regular for title per stub lines 29–30) — primitive applies `font.weight` uniformly per D-T329-5.
- LiveDataClip / frontier-tenant data updates — non-frontier clipKind; ADR-005 frontier track owns.
- Multi-variant goldens (compass stub line 47 "0 / 24 / 48 / 144") — single canonical mid-hold per D-T329-7; entry/exit windows evidenced by the primitive's animation contract via `lower-third.test.tsx`, not per-state goldens.
- Cluster A `news` SKILL.md modification — owned by T-331 (cluster composer task).
- `docs/ops/parity-fixture-signoff.md` modification — procedural-only doc per `MEMORY.md` `feedback_parity_signoff_doc_is_procedural.md`; sign-off lives in preset frontmatter, not in this file.

## References
- `docs/compass_artifact.md` § Netflix documentaries
- Compass canon note: documentary-neutral default register — text-only, no chrome, generous whitespace, DM Sans Medium Mixed-Case headline + ALL-CAPS title white-on-black.
- ADR-004 (preset system contract)
- T-183 — `LowerThird` primitive base (the chyron this preset wires)
- T-183z — `LowerThird` primitive `noFlag` / `subtitleColor` / `font` props (T-329 is the second production consumer after T-330)
- F-4 — `scripts/generate-preset-parity-fixture.ts` `--psnr` / `--ssim` / `--max-failing-frames` flags (T-329 is the second preset PR to use them after T-330)
- T-323 — first `lowerThird` clipKind binding (clipKind-default `cnnClassicBinding`; T-329 sits beside as the fifth `lowerThird` consumer via `PRESET_ID_BINDINGS` override)
- T-325 — second `lowerThird` clipKind binding (first `PRESET_ID_BINDINGS` override `bbcReithDarkBinding`)
- T-326 — third `lowerThird` clipKind binding (second `PRESET_ID_BINDINGS` override `alJazeeraOrangeBinding`)
- T-330 — fourth `lowerThird` clipKind binding (third `PRESET_ID_BINDINGS` override `appleTvLtBinding`; T-329's primary template)
- T-360 — `PRESET_ID_BINDINGS` mechanism (T-329's binding path)
- T-329 — preset promotion + fifth `lowerThird` clipKind binding via `PRESET_ID_BINDINGS` override (this preset)
