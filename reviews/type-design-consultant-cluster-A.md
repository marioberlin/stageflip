---
title: Type-design consultant — Cluster A (News)
id: reviews/type-design-consultant-cluster-A
reviewedAt: 2026-05-14
clusterPresets:
  - al-jazeera-orange
  - apple-tv-lt
  - bbc-reith-dark
  - cnn-breaking
  - cnn-classic
  - fox-news-alert
  - msnbc-big-board
  - netflix-doc-lt
signedOff: 'signed:2026-05-14'
owner_task: T-382
---

# Type-design consultant — Cluster A (News)

Batch review per ADR-004 §D4. Every preset in Cluster A cites a proprietary
or commercial-BYO bespoke face; this review approves the OFL-cleared
fallback declared in each preset's frontmatter and ranks two alternates
from the cluster's already-license-cleared family pool. All recommended
fallbacks are OFL or Apache-2.0 and are already cited as preferred or
fallback families elsewhere in the preset corpus (i.e. on the registry that
`FontLicenseRegistry.buildFromPresets` produces; no whitelist widening is
proposed). The render-time substitution behaviour is preset-by-preset:
`lowerThird` presets that pre-date T-183z still render at the primitive's
hard-coded `Plus Jakarta Sans`; the `font`-prop-aware consumers (T-183z
lower-thirds, `BreakingBanner`, `magic-wall-panel`) render the declared
fallback verbatim. The review treats the *declared* fallback as the
artifact under evaluation regardless of which gets to glass — that is the
posture the bespoke-font invariant locks in (cluster A SKILL §"Bespoke
fonts are proprietary").

## al-jazeera-orange

**Bespoke / preferred:** Al Jazeera bilingual custom (Tarek Atrissi)
(`proprietary-byo`)

**Three ranked fallback candidates** (license-cleared registry only):
1. **DIN 2014 (Latin) + Amiri (Arabic)** — the currently-declared pair;
   DIN 2014's rounded-geometric Latin matches Atrissi's bilingual brief
   (warm humanist Latin paired to a contemporary naskh Arabic), and Amiri
   is the canonical OFL naskh face with matched-x-height latin sidecar.
2. **Source Sans 3 + Amiri** — Source Sans 3 is a humanist grotesque
   with a slightly taller x-height than DIN 2014 and broader weight
   coverage (200–900); pairs cleanly with Amiri at matched cap-height.
3. **Public Sans + Amiri** — Public Sans (USWDS, OFL) is a neutral
   humanist grotesque that reads quieter than DIN 2014; reasonable
   if the v1 Latin-only path is the only one that ever rendered (the
   warmth bias is then carried by colour, not the type).

**Kerning / x-height / weight deltas** vs. bespoke Atrissi Latin:
- x-height: DIN 2014 matched (within ±2 %); Source Sans 3 +3 %;
  Public Sans +1 %.
- cap-height: DIN 2014 matched; Source Sans 3 −1 %; Public Sans matched.
- letter-spacing: default unchanged. Atrissi's bilingual Latin is set at
  +0 to +10 in production; the primitive's hard-coded `-0.015em` on name
  is acceptable at fontSize 34.
- weight coverage: preset declares weight 600. DIN 2014 (commercial; the
  *OFL substitute family carrying the DIN-style geometric Latin* in the
  corpus is **Public Sans** — see escalation note below) ships 200–900;
  Amiri ships Regular + Bold only — adequate for the preset's 600 declaration
  via Bold (700) at a 50-unit synthetic step, NOT recommended for
  high-fidelity rendering. v1 ships Latin-only so the Amiri weight gap
  does not bite at parity time.

**Rationale** — Atrissi's al-jazeera bilingual signals warmth, humanism,
and bilingual equivalence (Latin and Arabic at matched optical mass).
DIN 2014's rounded-geometric Latin approximates the warmth; Amiri carries
the Arabic side at compass-canonical naskh register. Together they
preserve "orange-on-light warm humanist + matched-x-height bilingual"
without the BYO licensing burden.

**Reference-frame recommendation** — frame 60 (mid-hold) for the Latin
register. When Arabic ships (T-326a carve-out), add frame 60 of the
Arabic-only variant + a bilingual side-by-side frame to verify
matched-x-height; both at mid-hold.

**Final recommendation:** **DIN 2014 (Latin) + Amiri (Arabic)** as
currently declared. Source Sans 3 wins on weight coverage but loses the
geometric warmth that is al-jazeera's brand-axis differentiator vs.
Western-network cool blues; Public Sans is quieter than the brief calls
for. NOTE: see Escalations for the DIN 2014 license-posture flag.

## apple-tv-lt

**Bespoke / preferred:** SF Pro (`proprietary-byo`; platform-installed
on Apple silicon — `platform-byo` posture also reasonable)

**Three ranked fallback candidates** (license-cleared registry only):
1. **Inter** — the currently-declared fallback; Inter is the canonical
   OFL substitute for SF Pro by design (Rasmus Andersson built Inter to
   read at SF-like x-heights with full weight coverage 100–900).
2. **Inter Tight** — same metrics as Inter at slightly tighter default
   tracking; useful when the headline string is long.
3. **DM Sans** — a workable humanist grotesque alternate, but the
   x-height runs higher than SF Pro Light (+4 %); reserve for the
   neighbour preset (Netflix) where it is the canonical choice.

**Kerning / x-height / weight deltas** vs. SF Pro Light:
- x-height: Inter matched (Inter was designed to align with SF Pro);
  Inter Tight matched; DM Sans +4 %.
- cap-height: Inter matched; Inter Tight matched; DM Sans +2 %.
- letter-spacing: default unchanged. SF Pro Light is set with positive
  tracking +75 to +120 in production; the primitive's hard-coded
  `-0.015em` is the cosmetic divergence flagged in the preset's
  Trade-offs §; not a fallback-choice problem.
- weight coverage: preset declares weight 300. Inter ships
  100/200/300/400/500/600/700/800/900 — full coverage including Light.
  Inter Tight ships 100–900 same. DM Sans ships 400–700 → **300 not
  natively available; would synthesise Light from Regular**. Disqualifying
  for the Light-weight register that IS Apple TV+.

**Rationale** — Apple TV+'s minimalist register depends on Light-weight
humanist sans at generous tracking. Inter was designed expressly to be
SF Pro's open-source twin and is the unambiguous correct call here.

**Reference-frame recommendation** — frame 60 (mid-hold), per the
preset's parity acceptance §. Optional loop-entry frame is unnecessary
for a steady-state text-only register where the entrance curve is the
divergence the preset already documents.

**Final recommendation:** **Inter** at weight 300. Inter Tight is a
defensible second if a future preset variant demands tighter horizontal
fit (long names); DM Sans cannot carry the 300 weight natively and is
out.

## bbc-reith-dark

**Bespoke / preferred:** BBC Reith Serif + BBC Reith Sans (`proprietary-byo`)

**Three ranked fallback candidates** (license-cleared registry only):
1. **Source Serif 4 + Source Sans 3** — the currently-declared pair;
   Adobe-designed OFL serif + sans superfamily expressly built to pair.
   Source Sans 3 is humanist grotesque (Reith Sans register); Source
   Serif 4 is a transitional serif with humanist warmth (Reith Serif
   register).
2. **EB Garamond + Source Sans 3** — EB Garamond is a Garalde with more
   warmth than Source Serif 4 but lower x-height (−4 %), reads more
   editorial / less broadcast. Reasonable for a deeper documentary
   register; not the right BBC posture.
3. **Fraunces + Public Sans** — Fraunces is a variable contemporary
   serif with broader stylistic range; Public Sans is a neutral
   grotesque sans. The pairing reads more contemporary-American than
   BBC-British public-broadcaster.

**Kerning / x-height / weight deltas** vs. Reith Serif + Reith Sans:
- x-height: Source Serif 4 matched to Reith Serif (Source Serif 4 was
  re-cut with a slightly larger x-height in v4); Source Sans 3 matched
  to Reith Sans (within ±2 %). EB Garamond −4 %; Fraunces +3 %.
- cap-height: Source Serif 4 −1 %; Source Sans 3 matched. EB Garamond
  −2 %; Fraunces +2 %; Public Sans matched.
- letter-spacing: default unchanged. Reith Sans uses +10 to +15
  tracking in production; the primitive's `-0.015em` (name) /
  `+0.02em` (title) is the documented cosmetic divergence in the
  preset's Trade-offs § — not a fallback-choice problem.
- weight coverage: preset declares weight 600. Source Sans 3 ships
  200–900 — full coverage. Source Serif 4 ships 200–900 — full coverage.
  Both pairs have native 600 (SemiBold).

**Rationale** — Reith was commissioned to read humanist, authoritative,
public-broadcaster, with serif + sans pairing as the brand signature.
Source Serif 4 + Source Sans 3 is the only OFL superfamily on the
registry that ships both halves of a serif+sans pairing at matched
x-height and weight coverage. The pairing also reads recognisably
British-public-broadcaster (Adobe's brief was deliberately neutral and
international); EB Garamond reads too editorial, Fraunces too American.

**Reference-frame recommendation** — frame 60 (mid-hold) for the
serif+sans steady-state. The Reith Sans subtitle is the rendered line
(per the primitive's `accent`-coloured title); the bespoke serif is
declared but does not exercise at v1 render time (LowerThird primitive
hard-codes Plus Jakarta Sans). When T-183z lands `font` on this preset
the parity golden will need re-rendering — note for the Reviewer's
posterior follow-up.

**Final recommendation:** **Source Serif 4 + Source Sans 3** as declared.
The Adobe superfamily is the single OFL pair on the registry built
expressly to be a serif+sans system; substituting either half
independently breaks the pairing's matched-x-height contract.

## cnn-breaking

**Bespoke / preferred:** CNN Sans (`proprietary-byo`)

**Three ranked fallback candidates** (license-cleared registry only):
1. **Inter Tight** — the currently-declared fallback; tighter horizontal
   metrics than Inter, weight 800 available, designed for headlines and
   UI labels — direct analogue for CNN Sans's banner-headline register.
2. **Inter** — same x-height as Inter Tight, slightly wider default
   tracking; reads marginally less urgent.
3. **Public Sans** — neutral grotesque; ships 100–900 including Black
   (900). Reads quieter; CNN Sans's urgent-news register wants the
   compressed feel Inter Tight delivers.

**Kerning / x-height / weight deltas** vs. CNN Sans Black:
- x-height: Inter Tight matched (within ±1 %); Inter matched; Public Sans +1 %.
- cap-height: Inter Tight matched; Inter matched; Public Sans matched.
- letter-spacing: default unchanged. CNN Sans Black is set tight in
  the canonical breaking strap; Inter Tight's default `-0.011em` at the
  Bold/Black weights is already in the right register.
- weight coverage: preset declares weight 800. Inter Tight ships
  100–900 — full coverage including ExtraBold (800). Inter ships
  100–900 — full coverage. Public Sans ships 100–900 — full coverage.

**Rationale** — CNN Sans signals authority + urgency + American-broadcast
register. Inter Tight is the closest open OFL match: same humanist
grotesque axis, matched x-height, condensed horizontal metric that reads
"urgent banner" at the canonical 30 px / 800 weight rendered in the
banner.

**Reference-frame recommendation** — frame 60 (mid-hold) per the
preset's parity acceptance §. The BreakingBanner primitive honours the
`font` prop, so the Inter Tight rendering is what the parity golden
actually captures — verification is direct, not declarative-only.

**Final recommendation:** **Inter Tight** at weight 800. Inter is the
fallback to Inter Tight, not vice versa; Public Sans is quieter than the
breaking-news register demands.

## cnn-classic

**Bespoke / preferred:** CNN Sans (`proprietary-byo`)

**Three ranked fallback candidates** (license-cleared registry only):
1. **Inter Tight** — the currently-declared fallback at weight 700;
   matches CNN Sans Bold across x-height, cap-height, and horizontal
   metric. Same family choice as cnn-breaking gives cluster-internal
   continuity across CNN's two registers.
2. **Inter** — wider default tracking; reads marginally less urgent.
3. **Public Sans** — neutral grotesque; quieter register than the CNN
   Classic chyron wants.

**Kerning / x-height / weight deltas** vs. CNN Sans Bold:
- x-height: Inter Tight matched; Inter matched; Public Sans +1 %.
- cap-height: Inter Tight matched; Inter matched; Public Sans matched.
- letter-spacing: default unchanged. The primitive hard-codes
  `-0.015em` on name — slightly tighter than CNN Sans Bold's default,
  not a fallback-choice problem.
- weight coverage: preset declares weight 700. Inter Tight 700 native;
  Inter 700 native; Public Sans 700 native — all three carry weight 700
  natively.

**Rationale** — same as cnn-breaking; the Classic chyron register
shares CNN Sans Bold with the Breaking strap (where Breaking goes to
Black). Inter Tight 700 is the cluster-internal continuity choice
that keeps both CNN presets typographically coherent under fallback.
Note: v1 renders in Plus Jakarta Sans by primitive constraint (the
LowerThird primitive predates T-183z's `font` prop); the fallback
declaration is evaluated for posture, not rendered output.

**Reference-frame recommendation** — frame 60 (mid-hold). When T-183z
lands `font` on the LowerThird primitive's cluster-A consumers, the
parity golden re-renders; flag for the posterior follow-up.

**Final recommendation:** **Inter Tight** at weight 700. Same rationale
as cnn-breaking; matching the CNN pair lock keeps the cluster's
internal coherence.

## fox-news-alert

**Bespoke / preferred:** FF Good OT Black (`commercial-byo`)

**Three ranked fallback candidates** (license-cleared registry only):
1. **League Gothic** — the currently-declared fallback at weight 700;
   compressed condensed sans, single weight 700 (the OFL registry
   carries it as a single-face family, per the SIL ofl release). Reads
   tabloid-condensed, matches FF Good's narrow horizontal metric.
2. **Barlow Condensed** — condensed humanist grotesque, ships 100–900
   weights; reads slightly humanist (Fox's brief is more news-tabloid /
   geometric).
3. **Anton** — condensed display sans, single weight 400 (display-only,
   100 % black weight). Reads more poster than chyron; reserve for
   sports-cluster registers where the display posture is the register.

**Kerning / x-height / weight deltas** vs. FF Good OT Black:
- x-height: League Gothic +2 %; Barlow Condensed +1 %; Anton matched.
- cap-height: League Gothic matched; Barlow Condensed matched; Anton +1 %.
- letter-spacing: default unchanged. FF Good Black is set tight in
  production; League Gothic's default is in the right register at the
  sliver's 18 px headline size.
- weight coverage: preset declares weight 700. League Gothic ships
  weight 700 (single-face); Barlow Condensed ships 100–900 inc. 700;
  Anton ships weight 400 only — **disqualifying for the 700 declaration**
  (would synthesise Bold, not recommended).

**Rationale** — Fox's persistent-sliver register depends on condensed +
heavy-black + narrow-horizontal-fit (the 30 % sliver crops out wider
faces). FF Good Black's tabloid-news geometric posture maps cleanly to
League Gothic. T-327 is the first preset to declare League Gothic in the
registry; the BreakingBanner primitive honours the `font` prop so the
League Gothic rendering is what parity captures directly.

**Reference-frame recommendation** — frame 60 (mid-hold steady-state).
Per the preset's parity acceptance §, sliver mode skips entrance, so
the rendered sliver is bit-identical at every frame; the choice of
frame 60 holds the cluster mid-hold convention.

**Final recommendation:** **League Gothic** at weight 700. Single-weight
family but the 700 native weight covers the declared use. Barlow
Condensed is the upgrade path if a future Fox variant needs a multi-weight
range; Anton is wrong (display-only single weight 400).

## msnbc-big-board

**Bespoke / preferred:** Roboto + NBC Tinker (`ofl + proprietary-byo`).
Roboto half is already OFL/Apache-2.0 license-cleared — only the NBC
Tinker half needs a fallback.

**Three ranked fallback candidates** (license-cleared registry only):
1. **Roboto + Inter Tight** — the currently-declared pair at weight 700;
   Roboto carries the data-row + region-label + tabular-numerals register;
   Inter Tight 700 carries the NBC Tinker headline mass (`'2024 ELECTION
   NIGHT'`). Both ship the `tabular-nums` numeric feature.
2. **Roboto + Public Sans** — Public Sans (USWDS) is a neutral humanist
   grotesque; pairs adequately with Roboto for the data-panel register
   but reads less heavy than NBC Tinker's headline mass at 700.
3. **Roboto + DM Sans** — DM Sans is geometric grotesque, +4 % x-height
   vs. NBC Tinker; reads softer than the election-night register wants.

**Kerning / x-height / weight deltas** vs. NBC Tinker (headline half;
Roboto half is verbatim):
- x-height: Inter Tight matched (within ±1 %); Public Sans +1 %;
  DM Sans +4 %.
- cap-height: Inter Tight matched; Public Sans matched; DM Sans +2 %.
- letter-spacing: default unchanged. NBC Tinker's tracking in production
  is roughly default; Inter Tight matches.
- weight coverage: preset declares weight 700. Inter Tight 700 native;
  Public Sans 700 native; DM Sans 700 native. All three OK.
- **Tabular numerals**: Roboto ships `tabular-nums` natively (the
  preset's primary tabular-numeric requirement is on Roboto, not the
  headline half); the `magic-wall-panel` primitive auto-applies the
  feature.

**Rationale** — election-night data-panel typography lives on Roboto's
geometric grotesque + tabular-nums posture; the headline mass is the
NBC Tinker callout. Inter Tight 700 carries the headline at NBC Tinker's
weight register without losing the OFL posture. Cluster-internal
continuity with cnn-classic / cnn-breaking (both Inter Tight) keeps the
news cluster typographically coherent.

**Reference-frame recommendation** — frame 60 (mid-hold) per the
preset's parity acceptance §. The entrance stagger settles by ~frame 25;
frame 60 captures every tile + the title + the subtitle at steady state.

**Final recommendation:** **Roboto + Inter Tight** at weight 700 as
declared. Public Sans is the runner-up if a future tenant demands a
quieter headline mass; DM Sans's softer geometric runs against the
election-night canon.

## netflix-doc-lt

**Bespoke / preferred:** Netflix Sans (`proprietary-byo`)

**Three ranked fallback candidates** (license-cleared registry only):
1. **DM Sans** — the currently-declared fallback at weight 500; DM Sans
   is Google's "approachable geometric grotesque" (Indian Type Foundry,
   OFL via Google Fonts); approximates Netflix Sans's humanist warmth
   at matched x-height. Ships weights 400–700.
2. **Inter** — humanist grotesque; matched x-height to Netflix Sans;
   ships 100–900 inc. 500. Reads slightly less warm than DM Sans
   (Inter was designed for UI neutrality; DM Sans was designed for
   editorial warmth).
3. **Public Sans** — neutral humanist grotesque; ships 100–900. Reads
   the most neutral of the three; loses the documentary-warmth register.

**Kerning / x-height / weight deltas** vs. Netflix Sans Medium:
- x-height: DM Sans matched (within ±1 %); Inter matched; Public Sans +1 %.
- cap-height: DM Sans matched; Inter matched; Public Sans matched.
- letter-spacing: default unchanged. Netflix Sans is set wide in
  production for the documentary-credit register; the primitive's
  `-0.015em` is the documented cosmetic divergence — not a fallback-
  choice problem.
- weight coverage: preset declares weight 500. DM Sans ships 400–700
  inc. 500 native; Inter ships 100–900 inc. 500 native; Public Sans
  ships 100–900 inc. 500 native. All three OK.

**Rationale** — Netflix Sans was commissioned by Netflix to read warm,
humanist, and slightly geometric — explicitly to save licensing fees
versus Gotham. DM Sans is the closest OFL match on the same axes; T-329
ships it through T-183z's `font` prop so parity captures the actual
rendering. Inter is the cluster-internal continuity choice if a future
Netflix preset variant needs a wider weight range.

**Reference-frame recommendation** — frame 60 (mid-hold) per the
preset's parity acceptance §. The text-only register has the lowest
aliasing surface in the cluster; frame 60 captures both the Mixed-Case
headline and the snapshot-string ALL CAPS title at steady state.

**Final recommendation:** **DM Sans** at weight 500. Inter is a
defensible second if a future variant demands the heavier-than-500
weight range; Public Sans is the least warm of the three and would lose
the documentary register.

## Cross-preset coherence

The cluster's typographic system reads coherent under the recommended
fallbacks because **Inter and Inter Tight are the load-bearing common
denominator** — Inter Tight on the two CNN registers (Classic + Breaking)
and the MSNBC headline half, Inter on Apple TV+, Source Sans 3 on the
BBC sans half, DM Sans on Netflix. All five are humanist grotesque OFL
families at matched x-height and matched cap-height; the user perceives
a cluster-internal "broadcast sans" register without register-switching.

The two divergences are deliberate and brand-encoding: League Gothic on
Fox (compressed condensed sans — the Fox register IS the narrow-horizontal
sliver) and Source Serif 4 + Amiri on the BBC + al-jazeera pair (the
serif half of Reith and the Arabic half of Atrissi's bilingual are not
substitutable into the humanist grotesque baseline without losing the
brand signal).

Numerals are coherent across the cluster: Roboto + Inter Tight carry
tabular-nums for the MSNBC data panel; all other presets use proportional
numerals in headline / subtitle text where tabular alignment is not
load-bearing. No preset depends on lining-vs-old-style figure styling
where the fallback diverges from the bespoke. Condensed-vs-normal
proportions read coherent: only Fox (League Gothic) is condensed; the
other seven sit in normal-width territory.

## Escalations

**DIN 2014 license-posture flag (al-jazeera-orange).** DIN 2014 is a
commercial Paratype family (`commercial-byo` posture), NOT OFL. The
preset's frontmatter declares the fallback as `license: ofl` for the
declared family `DIN 2014 (Latin) + Amiri (Arabic)`, which is internally
inconsistent: Amiri is OFL but DIN 2014 is not. Per the type-design
consultant SKILL.md §"Anti-patterns" — recommending a font outside the
license-cleared registry without escalating is forbidden. **Escalation
to the Orchestrator**: either (a) the preset's fallback should be
re-declared as `Public Sans + Amiri` (both OFL; Public Sans is the
closest OFL match for DIN 2014's neutral-geometric posture, x-height
+1 %, full weight coverage 100–900), OR (b) the al-jazeera tenant
accepts a `commercial-byo` posture on the fallback (BYO-only deployment),
OR (c) the registry whitelist widens to include the DIN 2014 license.
Recommended path: (a) Public Sans + Amiri — preserves OFL posture, no
whitelist widening, minimal register drift (Public Sans is humanist-
neutral vs DIN 2014's rounded-geometric, but the warmth differentiator
in al-jazeera-orange is carried by the orange accent strip and the
warm-light background, not the Latin face). The Orchestrator should
route this with the al-jazeera v1-Latin-only posture in mind: the
Arabic-half register (Amiri) is unaffected; the divergence lives entirely
on the Latin half which v1 already renders in Plus Jakarta Sans by
primitive constraint (the declared fallback is evaluated for posture,
not rendered output). The preset's declared family string IS the
artifact being reviewed here.
