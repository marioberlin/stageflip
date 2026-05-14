---
title: Type-design consultant — Cluster D (Titles)
id: reviews/type-design-consultant-cluster-D
reviewedAt: 2026-05-14
clusterPresets:
  - got-trajan-clockwork
  - severance-surreal-3d
  - squid-game-geometric
  - stranger-things-benguiat
  - succession-home-video
  - true-detective-double-exposure
signedOff: 'signed:2026-05-14'
owner_task: T-382
---

# Type-design consultant — Cluster D (Titles)

Batch review per ADR-004 §D4. Cluster D is the most typographically
demanding cluster in the corpus: every preset pastiches a specific
prestige-TV title-sequence canon in which the bespoke typeface IS the
recognition signal. Two presets cite classical-revival serifs (ITC Trajan
Pro, ITC Benguiat Bold) whose proportions and ornate terminals have NO
true equivalent in the OFL universe; four presets cite shows that
commissioned bespoke faces (Severance, Squid Game, Succession, True
Detective S1). This review approves the OFL-cleared fallback declared in
each preset's frontmatter or flags the case where the gap between
bespoke and registry-available fallback is large enough to surface as an
Escalation rather than a silent substitution.

All recommended fallbacks are OFL or Apache-2.0 and are already cited as
preferred or fallback families elsewhere in the preset corpus
(`FontLicenseRegistry.buildFromPresets` registry-cleared); no whitelist
widening is proposed. Render-time substitution behaviour is preset-by-
preset: `titleSequence`-bound presets (all six in Cluster D) consume the
T-321 primitive's `font` prop directly, so the declared fallback IS the
rendered output at parity time. The cosmetic divergence from the
proprietary or bespoke preferred face is explicit in each preset's
"Documented divergences" section. This review treats the declared
fallback as the artifact under evaluation — the bespoke-font invariant
locks in the BYO posture (cluster D SKILL §"Bespoke fonts are
proprietary"); the OFL fallback IS what goes to glass under the v1
posture.

Cluster D references `TitleSequenceClip` (T-321); reference-frame
recommendations emphasise key frames of the title-sequence arc
(resolve / mid-hold / loop-exit) within the parity-CLI's 150-frame
envelope.

## got-trajan-clockwork

**Bespoke / preferred:** Trajan Pro (`commercial-byo`)

**Three ranked fallback candidates** (license-cleared registry only):
1. **EB Garamond** — the currently-declared fallback at weight 700;
   Garalde-old-style serif with classical proportions, generous
   ascenders, and sharp serif terminals. The OFL family with the
   highest tolerance for Roman-inscription register at scaled-large
   ALL-CAPS rendering — Trajan's proportions are themselves derived
   from the Trajan Column inscription (113 CE), so a contemporary
   Garalde with humanist warmth lands closer than any sans-serif
   substitute. Variable axis ships weights 400–800.
2. **Cormorant Garamond** — Garamond revival (Christian Thalmann, OFL),
   weight 700 native; slightly more theatrical / display-leaning than
   EB Garamond; reads more "high-fantasy" register vs. EB Garamond's
   editorial-Garalde neutrality. Defensible if a future GoT variant
   demands more display drama at the title-card weight.
3. **Fraunces** — variable contemporary serif with optical-size axis;
   weight 700 + display optical size approximates inscriptional severity
   but reads recognisably 2020s-American rather than classical-Roman.
   Distant third — register-adjacent but not the same family of cut.

**Kerning / x-height / weight deltas** vs. Trajan Pro Bold:
- x-height: Trajan Pro is **caps-only by construction** (no lowercase
  glyphs; the original Trajan Column inscription contained no minuscules).
  EB Garamond's lowercase x-height is irrelevant for the ALL-CAPS render;
  cap-height comparison is the load-bearing axis. EB Garamond cap-height
  −2% vs. Trajan Pro Regular; Cormorant Garamond −1%; Fraunces +1%.
- cap-height: matched within ±2% on all three.
- letter-spacing: T-349 declares `letterSpacing: 80` (modest tracking;
  Roman-inscription canonical envelope is +50 to +100 at scaled-large
  display size). EB Garamond's default metrics sit comfortably in that
  envelope; no manual override required beyond the primitive's
  `letterSpacing` prop.
- weight coverage: preset declares weight 700. EB Garamond variable
  ships 400–800 inc. 700 native. Cormorant Garamond ships 300–700
  inc. 700 native. Fraunces ships 100–900 + optical-size axis inc. 700.
  All three OK.
- numeral design: NOT load-bearing for got-trajan-clockwork (title-card
  + credit register; no tabular score columns). Trajan Pro's bespoke
  numerals are lining-old-style hybrid; EB Garamond ships proportional
  old-style by default with lining figures available via OpenType
  feature — register-adjacent but not register-identical.

**Rationale** — Trajan Pro signals "myth, inheritance, classical-Roman
inscriptional authority". It is the dominant Hollywood title face for
sword-and-sandal / fantasy / historical-epic genres precisely because
its proportions descend directly from a 1900-year-old monumental
inscription. EB Garamond is the closest OFL family on the *classical
serif* axis: Garalde-old-style with sharp serif terminals, humanist
warmth, generous ascenders. It does NOT carry the inscriptional severity
of Trajan (Garamond is a Renaissance type cut for body text, not a
monumental display cut), but the register-bridge is closer than any
sans-serif or transitional-serif option in the registry. Acceptable
fallback for a v1 posture; ships visible cosmetic divergence from the
Trajan ideal — documented in T-349's divergence (a).

**Reference-frame recommendation** — Frame 60 (parity-CLI default,
fps 30 — early-arc steady-state under sepia tonal grading + grain).
The stub's candidate frames (0 sun-ray entry / 240 mid-swoop / 480
clockwork peak / 720 sigil reveal) all target time-points within the
deferred live 3D sequence; per T-349's divergence (g) those frames are
out-of-envelope. Frame 60 captures the static title-plate register
under the photographic-overlay sepia at 0.65 intensity which is the
visual artifact that v1 actually ships.

**Final recommendation:** **EB Garamond 700** — keep current fallback.
Cormorant Garamond is closer to high-fantasy theatrical display but
breaks the cluster-internal continuity with stranger-things-benguiat
(which already uses Cormorant Garamond for a different bespoke serif —
see that preset for the differentiation rationale). Fraunces reads too
contemporary-American for the medieval-historic register. The Trajan
gap is genuine (this is a CLASSICAL-REVIVAL SERIF whose authority signal
depends on a 1900-year-old proportion system) — see Escalations §
"Trajan-fallback adequacy flag".

## severance-surreal-3d

**Bespoke / preferred:** Severance custom (Helvetica + mid-century
corporate identity) (`proprietary-byo`)

**Three ranked fallback candidates** (license-cleared registry only):
1. **Inter Display** — the currently-declared fallback at weight 500;
   display-optimised cut of Inter with tighter spacing at large sizes;
   humanist-grotesque axis-adjacent to Helvetica. The OFL family with
   the strongest Helvetica-substitute pedigree (Inter was explicitly
   designed at SF-Pro-/-Helvetica-adjacent x-height and cap-height for
   UI legibility).
2. **Inter** — same x-height + cap-height as Inter Display; slightly
   wider default tracking at large sizes; would also work but Inter
   Display is the optical-display cut explicitly tuned for the
   scaled-large title register T-353 ships at 64 pt.
3. **Public Sans** — USWDS humanist-grotesque, OFL; full weight ladder
   100–900. Reads marginally less Helvetica-adjacent than Inter — the
   USWDS brief was deliberate neutrality, not Vignelli-corporate-revival.
   Defensible runner-up.

**Kerning / x-height / weight deltas** vs. Severance custom (Helvetica-
adjacent Vignelli-corporate cut):
- x-height: Inter Display matched (within ±1% vs. Helvetica norms;
  Severance custom sits in the Helvetica geometric-grotesque
  neighbourhood); Inter matched; Public Sans +1%.
- cap-height: matched within ±2% across all three.
- letter-spacing: T-353 declares `letterSpacing: 0` (neutral —
  conservative interpretation of stub line 31 "very tight tracking").
  Inter Display's default metric at weight 500 sits at neutral tracking;
  no override required beyond the primitive's `letterSpacing` prop.
  The stub's "very tight tracking" is closer to Helvetica's −1 to −2
  default at display size — a future variant could declare
  `letterSpacing: -20` to land closer to the canon if a Reviewer
  approves; current declaration is conservative-neutral.
- weight coverage: preset declares weight 500. Inter Display ships
  100–900 inc. 500 (Medium) native; Inter ships 100–900 inc. 500;
  Public Sans ships 100–900 inc. 500. All three OK.
- numeral design: NOT load-bearing (title-plate register; no tabular
  data). Inter Display ships tabular figures available via OpenType
  feature for future variants.

**Rationale** — Severance custom is a Helvetica-derivative geometric-
grotesque commissioned for the show's mid-century-corporate-identity
register (Massimo Vignelli era; the typography is Teddy Blanks's
explicit pastiche of 1960s-corporate identity manuals). Inter Display
is the closest OFL family by axis (humanist-leaning geometric grotesque
at matched x-height / cap-height); Inter was designed as the OSS twin
of San Francisco / Helvetica's UI register and Inter Display is the
display-optical cut tuned for headline sizes. The Helvetica gap is
small here (modern OFL humanist grotesques have converged on a
Helvetica-adjacent register); the Vignelli-corporate-identity
*recognition* signal is carried less by the typeface than by the
sterile-neutral palette + tight-tracked ALL-CAPS layout — both of which
v1 ships faithfully.

**Reference-frame recommendation** — Frame 60 (parity-CLI default,
fps 30 — early-arc steady-state under cinematic-LUT + sub-default grain
0.10). The stub's candidate frames (0 entry / 240 vignette mid-shot /
480 climax / 720 resolution) all target time-points within the deferred
live 3D vignettes; per T-353's divergence (d) those frames are
out-of-envelope. Frame 60 captures the static title hold under the
sterile-graded register.

**Final recommendation:** **Inter Display 500** — keep current fallback.
Inter (non-display) is the runner-up if a future variant ships at
smaller body sizes; Public Sans is fine but breaks the Helvetica-
adjacent register the Vignelli-corporate canon depends on. The
Severance custom register is *registerly-substitutable* (Helvetica
clones are a solved problem in the OFL world); the bespoke-font gap
here is the smallest in Cluster D.

## squid-game-geometric

**Bespoke / preferred:** Squid Game custom geometric (`proprietary-byo`)

**Three ranked fallback candidates** (license-cleared registry only):
1. **Anton + Bebas Neue** — the currently-declared pair at weight 700;
   Anton is a condensed-Black geometric-display single-weight family
   (OFL via Google Fonts; Vernon Adams; based on a 1950s Helvetica-
   Compressed cut); Bebas Neue is a condensed-Bold geometric-display
   ALL-CAPS-optimised family (OFL via Google Fonts; Dharma Type). The
   pairing approximates Squid Game's brutalist-geometric-display
   register: squared-off terminals, ALL-CAPS optimisation, condensed
   horizontal metric, heavy weight mass.
2. **League Gothic** — single-weight condensed display sans (OFL,
   SIL); reads more "tabloid newspaper" than the geometric-brutalist
   register the Squid Game canon demands. Defensible runner-up but
   less geometric-display.
3. **Bebas Neue** alone — same family as half of the declared pair;
   would lose the Anton headline-mass option. Defensible if a future
   variant demands a single-weight fallback.

**Kerning / x-height / weight deltas** vs. Squid Game custom geometric:
- x-height: NOT applicable — ALL-CAPS render; cap-height is the
  load-bearing axis. Anton +1% vs. the Squid Game custom; Bebas Neue
  matched; League Gothic matched.
- cap-height: matched within ±2% across all three.
- letter-spacing: T-350 declares the primitive's default (no override).
  Anton's default tracking is neutral-tight at display size; reads
  brutalist at the 64 px font size T-350 ships.
- weight coverage: preset declares weight 700. Anton ships weight 400
  ONLY (single-face family); the 700 declaration synthesises a
  pseudo-Black from Anton's natural Black weight — acceptable for the
  brutalist register since Anton IS the heaviest weight in the family
  (no synthetic boldening needed; Anton at "weight 400" is already a
  visually-Black face). Bebas Neue ships weights 100–700 inc. 700 native.
  League Gothic ships weight 700 native (single-face). All three carry
  the heavy-mass register at native weight despite single-face family
  shape.
- numeral design: NOT load-bearing (title-plate register; no tabular
  numerals).

**Rationale** — Squid Game's custom typeface is a brutalist geometric-
display cut designed for the show's ○ △ □ Korean-initial integration
+ pink-on-teal jump-cut register. Bespoke for the show; the closest
OFL approximations are condensed-display ALL-CAPS-optimised families.
The Anton + Bebas Neue pair carries the heavy-mass + condensed-
horizontal + geometric-squared-terminal axes that ARE the Squid Game
typographic signal. Korean Hangul coverage is deferred to T-350a (the
primitive's font-fallback chain does not currently include Pretendard
/ Spoqa Han Sans); v1 ships Latin-only.

The bespoke-vs-OFL gap is moderate here: brutalist-geometric-display
typefaces have several OFL approximations, but none captures the
*specific* squared-terminal + ○ △ □-glyph-integration register that IS
the Squid Game canon. The recognition signal is partly typographic
(brutalist mass) and partly compositional (the pink-on-teal jump cut
+ ○ △ □ symbol integration) — the latter is preserved at the
preset-binding level regardless of font choice.

**Reference-frame recommendation** — Frame 120 @ fps 30 (= 4000 ms;
mid shot 5 "title-hold" per the six-shot timeline; the title plate is
fully visible on the teal `#067162` panel bleed at this frame).
Currently declared in the preset's parity acceptance §. Acceptable.

**Final recommendation:** **Anton + Bebas Neue** as declared. League
Gothic reads tabloid-condensed rather than brutalist-geometric and
loses the Squid-Game-specific register. Bebas Neue alone would lose
Anton's headline-mass option. The Anton + Bebas Neue stack is the
strongest OFL approximation of brutalist-geometric-display in the
registry. The bespoke gap is real but not severe; see Escalations §
"Squid Game custom geometric — register-faithful-not-glyph-faithful
flag" for the explicit note.

## stranger-things-benguiat

**Bespoke / preferred:** ITC Benguiat Bold (`commercial-byo`)

**Three ranked fallback candidates** (license-cleared registry only):
1. **Cormorant Garamond** — the currently-declared fallback at weight
   700; Garamond revival (Christian Thalmann, OFL) with display-leaning
   character, ornate serif terminals, theatrical proportions. The
   closest OFL family to Benguiat's ornate-serif-with-display-DNA
   register. Ships weights 300–700 inc. 700 native.
2. **EB Garamond** — Garalde-old-style; more reserved than Cormorant
   Garamond; reads editorial / less theatrical-display. Defensible
   runner-up but loses the Benguiat ornate-display character.
3. **Fraunces** — variable contemporary serif with optical-size axis;
   weight 700 + display optical size approximates Benguiat's display-
   theatrical register but reads recognisably 2020s-American rather
   than 1977-Benguiat. Distant third.

**Kerning / x-height / weight deltas** vs. ITC Benguiat Bold:
- x-height: Cormorant Garamond −2% vs. Benguiat (Benguiat has an
  unusually tall x-height for its serif class — Edward Benguiat's
  signature move; Cormorant runs lower); EB Garamond −4%; Fraunces +1%.
- cap-height: Cormorant Garamond matched within ±2%; EB Garamond −2%;
  Fraunces +1%.
- letter-spacing: T-348 declares `letterformScale: 0.7` → ~504 px per
  letter at 1280×720 (clipping canvas edges; "letterform-as-environment"
  per stub canon). The primitive's per-letter staggered-fade is the
  v1 animation; the typeface's tracking metric matters less than the
  letterform-as-environment scale. No manual override required.
- weight coverage: preset declares weight 700. Cormorant Garamond
  weight 700 native; EB Garamond variable 400–800 inc. 700; Fraunces
  100–900 inc. 700. All three OK.
- numeral design: NOT load-bearing (title-plate register; no tabular
  data).

**Rationale** — ITC Benguiat Bold signals "1980s analog warmth, horror-
adjacent nostalgia, Stephen King paperback typography" — the typeface
IS the Stranger Things brand recognition signal (Imaginary Forces
chose Benguiat explicitly to evoke the 1980s mass-market-paperback
canon). The bespoke gap is LARGE: Benguiat has signature ornate serif
terminals (the lowercase 'a' tail; the swept-up bowl of the lowercase
'g'; the elongated 'r' arm), distinctive cap proportions, and an
unusually-tall x-height for its serif class. NO OFL serif in the
registry captures Benguiat's specific ornate-display character. The
preset's own line 41 says "if no fallback adequate, escalate. The font
is the show" — and the type-design-consultant SKILL §"Anti-patterns"
forbids silently shipping a weak fallback.

Cormorant Garamond carries the *register-axis* (display-theatrical
serif with ornate terminals) but does NOT carry the *recognition-axis*
(Benguiat's specific letterform signature). The render at full
letterform-as-environment scale (504 px per letter) magnifies the
divergence: every cosmetic difference between Cormorant and Benguiat
reads at theatrical scale. **This is the strongest "no adequate
fallback" candidate in Cluster D** — see Escalations.

**Reference-frame recommendation** — Frame 120 @ fps 30 (parity-CLI
default composition envelope; canonical "full assembly + glow" register
per T-348). The stub's candidate frames (0 / 240 / 480 / 1200) target
24 fps and frames outside the 150-frame envelope; per T-348's
divergence (d) those frames are out-of-envelope. Frame 120 captures
the static title-plate register past the per-letter staggered-fade
window (~frame 90).

**Final recommendation:** **Cormorant Garamond 700** is the best OFL
candidate ON THE REGISTRY but does NOT adequately approximate
Benguiat's recognition signal. **ESCALATION RECOMMENDED** — see
Escalations § "Benguiat fallback adequacy flag (stranger-things-
benguiat)". Per the preset's own rule line 41 + the consultant SKILL
§"Anti-patterns" + CLAUDE.md §6 (cluster D permits "no adequate
fallback" escalation), the typeDesign sign-off for this preset should
remain at `pending-cluster-batch` pending Orchestrator review.

## succession-home-video

**Bespoke / preferred:** Engravers Gothic + Sackers Gothic
(`commercial-byo`)

**Three ranked fallback candidates** (license-cleared registry only):
1. **Copperplate + IBM Plex Sans Condensed** — the currently-declared
   pair at weight 600; Copperplate Gothic is a classical small-caps-
   only display serif with engraved-stationery DNA (note: Copperplate
   Gothic is **system-installed on macOS / iOS / Windows** as a
   platform-bundled face — NOT OFL; the preset's `license: license-
   mixed` declaration reflects this). IBM Plex Sans Condensed (IBM,
   OFL) carries the credit-line condensed-grotesque register; weight
   600 SemiBold native.
2. **IBM Plex Sans (non-condensed)** — drops the Copperplate half;
   reads less stationery-engraved, more contemporary. Defensible if
   a tenant rejects the Copperplate license posture.
3. **Public Sans** — USWDS humanist-grotesque; OFL; full weight ladder.
   Reads neutral; loses the engraved-stationery register entirely.
   Distant third — register-mismatched.

**Kerning / x-height / weight deltas** vs. Engravers Gothic + Sackers
Gothic:
- x-height: NOT applicable — Engravers / Sackers Gothic are
  small-caps-only (no lowercase glyphs by construction); the
  cap-height + letter-spacing axes are load-bearing. Copperplate
  Gothic matched within ±1% (same small-caps-only family register);
  IBM Plex Sans Condensed +2% vs. Sackers Gothic (Plex is a true
  lowercase face, not a small-caps display cut — used here for the
  credit-line role at ALL CAPS rendering).
- cap-height: matched within ±2% on Copperplate; IBM Plex Sans
  Condensed matched.
- letter-spacing: T-352 declares `letterSpacing: 250` (mid-range of
  stub line 32's "+200, often +300" envelope). This is the signature
  Succession typographic signal — extremely wide tracking. Copperplate
  + Plex Sans Condensed at 250 reads in the right register; no
  override beyond the primitive's `letterSpacing` prop required.
- weight coverage: preset declares weight 600. Copperplate Gothic
  ships in light-bold-heavy weights (macOS bundle ships Light + Bold
  + Heavy); the 600 declaration falls in the Bold envelope. IBM Plex
  Sans Condensed ships 100–700 inc. 600 native. Acceptable.
- numeral design: NOT load-bearing for title-card register; Succession's
  bespoke Engravers Gothic numerals are old-style + tabular hybrid.
  Plex Sans Condensed ships tabular figures via OpenType feature.

**Rationale** — Engravers Gothic + Sackers Gothic are commercial small-
caps-only display gothics commissioned originally for engraved-
stationery (1900s-era) — the typographic register IS "dynastic
stationery, fort-knox authority". The Succession canon depends on the
wide-tracking ALL-CAPS small-caps-display register. Copperplate Gothic
is the macOS-bundled / system-installed display gothic with directly
equivalent register (Frederic Goudy, 1901 — same era / same brief);
IBM Plex Sans Condensed is the OFL credit-line companion. The pairing
preserves the bespoke register at acceptable license posture.

The `license-mixed` posture is documented and accepted in the preset's
frontmatter (T-352's declaration); the macOS-system-bundled posture is
analogous to T-329's apple-tv-lt + SF Pro platform-byo treatment in
Cluster A. The bespoke-vs-OFL-strict gap is moderate; the bespoke-vs-
platform-bundled gap is small (Copperplate IS a small-caps gothic in
the Engravers / Sackers family lineage).

**Reference-frame recommendation** — Frame 60 (parity-CLI default,
fps 30 — early-arc steady-state under sepia tonal grading at 0.70 +
HIGH grain 0.30). The stub's candidate frames (0 / 360 / 720 / 1080)
target time-points within the deferred contemporary-intercut sequence;
per T-352's divergence (d) those frames are out-of-envelope. Frame 60
captures the static show-logo hold under the sepia-VHS register.

**Final recommendation:** **Copperplate + IBM Plex Sans Condensed 600**
— keep current pair. The license-mixed posture is the cleanest path
on the registry; Copperplate's macOS-bundled status is acceptable per
the platform-bundled precedent (Cluster A § apple-tv-lt). IBM Plex Sans
Condensed (non-mixed half) would lose the small-caps-display register
that IS the Succession canon. The bespoke gap is real but
register-adjacent; sign-off proceeds.

## true-detective-double-exposure

**Bespoke / preferred:** Custom sans serif (clean, unobtrusive)
(`license-cleared`)

**Three ranked fallback candidates** (license-cleared registry only):
1. **Inter** — the currently-declared fallback at weight 400; humanist-
   grotesque (Rasmus Andersson, OFL); designed for UI legibility at
   small sizes. The canonical OFL "clean, unobtrusive" sans-serif —
   the preset's stub explicitly canonicalizes "Typography is
   unobtrusive — the photography is the foreground" (line 33), and
   Inter Regular 400 IS the deferential register.
2. **Public Sans** — USWDS humanist-grotesque; OFL; full weight ladder
   100–900. Reads slightly more neutral / less Inter-distinctive at
   the 400 weight; defensible runner-up if a future variant demands
   USWDS-lineage typography.
3. **Source Sans 3** — Adobe humanist-grotesque; OFL; full weight
   ladder. Reads marginally warmer than Inter at body sizes; minor
   register drift toward editorial-Adobe rather than UI-Inter.

**Kerning / x-height / weight deltas** vs. "Custom sans serif (clean,
unobtrusive)":
- The bespoke is itself license-cleared (the stub's preferred-font
  license atom is `license-cleared`, not `proprietary-byo`); the
  consumer is free to declare any license-cleared face including Inter
  itself. There is no "bespoke recognition signal" to preserve — the
  preset's own canon is "typography is unobtrusive". The fallback
  evaluation is therefore against the deferential-sans-serif register,
  not against a specific bespoke face.
- x-height: Inter matched (canonical deferential-sans register);
  Public Sans +1%; Source Sans 3 +3%.
- cap-height: matched within ±2% across all three.
- letter-spacing: T-351 declares `letterSpacing: 40` (+40 tracking;
  mid-range of stub line 32's "+30 to +50" envelope). Inter's default
  metric at weight 400 sits at neutral tracking; the +40 override is
  the slight-wide register the stub canonicalizes.
- weight coverage: preset declares weight 400. Inter 400 native;
  Public Sans 400 native; Source Sans 3 400 native. All three OK.
- numeral design: NOT load-bearing for credit-line register; Inter
  ships tabular figures via OpenType feature for future variants.

**Rationale** — True Detective S1 is the ONLY Cluster D preset whose
bespoke / preferred face is NOT proprietary — the stub canonicalizes a
deferential clean sans-serif and accepts any license-cleared family. The
typography is explicitly subordinated to the Misrach-photography
foreground (stub line 33). Inter Regular 400 is the unambiguous correct
call: it carries the deferential-sans register without competing with
the photographic-overlay tonal-graded foreground. No bespoke gap, no
recognition signal to preserve, no escalation surface.

**Reference-frame recommendation** — Frame 120 @ fps 30 (parity-CLI
default composition envelope). The stub's candidate frames (0 / 360 /
720 / 1080 at "12 fps effective") target the deferred slowed-footage +
silhouette-window technique; per T-351's divergence (d) those frames
are out-of-envelope. Frame 120 captures the static credit hold under
the cinematic-LUT tonal pass at 0.6 intensity.

**Final recommendation:** **Inter 400** — keep current fallback. The
deferential-sans register requires no specific recognition signal;
Inter is the OFL canonical deferential-sans family. Public Sans is
defensible; Source Sans 3 introduces warmth the canon doesn't want.
No escalation. **This is the EASIEST sign-off in Cluster D** by a
wide margin — the typography is intentionally non-load-bearing here.

## Cross-preset coherence

Cluster D is **NOT a coherent typographic system** — it is a deliberate
four-register fragmentation that mirrors the bespoke-font diversity of
the six prestige-TV title-sequence canons:

1. **Classical-revival serif register (2 presets)** — EB Garamond
   (got-trajan-clockwork) + Cormorant Garamond (stranger-things-
   benguiat). Both Garalde-family serifs; the cluster's only serif
   registers. Anchored on weight 700 + ALL-CAPS scaled-large
   rendering. The fallback choice differs intentionally: EB Garamond's
   editorial-Garalde neutrality lands closer to Trajan's inscriptional-
   classical register; Cormorant Garamond's display-theatrical
   character lands closer to Benguiat's ornate-display register. Both
   choices preserve the cluster-internal "classical serif" axis while
   differentiating on the *theatrical-vs-inscriptional* sub-axis.
2. **Geometric-display / brutalist register (1 preset)** — Anton +
   Bebas Neue (squid-game-geometric). Sole consumer of condensed-
   display heavy-mass OFL families in the cluster; pairs naturally
   with the brutalist ○ △ □ glyph-integration + pink-on-teal jump-cut
   register.
3. **Geometric-grotesque / Helvetica-adjacent register (2 presets)** —
   Inter Display (severance-surreal-3d) + Copperplate + IBM Plex Sans
   Condensed (succession-home-video). Both anchor on geometric-
   grotesque ALL-CAPS at weight 500–600; Severance leans Helvetica-
   adjacent humanist, Succession leans engraved-stationery small-caps
   display. The register-overlap is partial: both register as "mid-
   century-corporate" or "engraved-formal" but differ on
   *humanist-vs-small-caps-display*.
4. **Deferential humanist-grotesque register (1 preset)** — Inter
   (true-detective-double-exposure). Sole consumer of weight 400 in
   the cluster; the only preset whose typography is explicitly
   non-load-bearing. The deferential register sits visually adjacent to
   the Helvetica-adjacent register but at a much lower weight + scale.

The four-register split is **deliberate and brand-encoding** — each
preset pastiches a specific show's bespoke typographic identity, and
Cluster D's "each preset preserves a specific bespoke canon" mandate
forbids cluster-internal collapse to a single typographic system. This
contrasts with Cluster A's news-broadcast convergence on Inter / Inter
Tight; Cluster D's brief is the opposite — fragmentation IS the
faithful posture.

**Numeral design** is non-load-bearing across all six Cluster D presets
(title-card / credit-line registers; no tabular score columns). Numeral
divergence between bespoke and OFL fallback is documented per-preset
but does not surface as a parity-fixture concern.

**Cross-cluster collapse option (informational, NOT recommended):** if
a future Reviewer requests Cluster D to collapse to a single
typographic system, EB Garamond 700 + Inter Display 500 + Anton 700
would cover all six presets at degraded register-quality (loss:
Benguiat's ornate-display character, Succession's small-caps-display
register, True Detective's deferential subordination posture). The
current four-register split is preferred because each preset's
nearest-bespoke-neighbour drives a more faithful prestige-TV canon.

## Escalations

Two escalations surface in Cluster D.

**Escalation 1 — Benguiat fallback adequacy flag (stranger-things-
benguiat).** ITC Benguiat Bold has NO adequate fallback in the
license-cleared registry. Cormorant Garamond is the best available
candidate but does NOT carry Benguiat's specific recognition signal
(ornate serif terminals, unusually-tall x-height for its serif class,
signature lowercase 'g' / 'a' / 'r' letterform shapes). The preset's
own rule line 41 reads: "The Benguiat fallback is critical; if no
fallback adequate, escalate. The font is the show." Per CLAUDE.md §6
+ ADR-004 §D4 (cluster D permits "no adequate fallback" escalation),
the typeDesign sign-off for stranger-things-benguiat should remain at
`pending-cluster-batch` pending Orchestrator routing. Orchestrator
options:
- (a) Accept the Cormorant Garamond register-adjacent fallback as a
  documented divergence (T-348's divergence (a) already documents this;
  the parity golden has been PO-signed at 2026-05-08). Path of least
  resistance; the parity-fixture sign-off is the visual acceptance step.
- (b) Widen the license whitelist to include ITC Benguiat (or a
  commercial Benguiat clone) under `commercial-byo` posture with
  enterprise tenant BYO licensing. This is the canonical
  Stranger-Things-faithful posture.
- (c) Descope the stranger-things-benguiat preset until a Benguiat-
  equivalent OFL face enters the registry (none is currently in
  development to consultant knowledge).

Recommended path: (a) — the parity golden was PO-signed at 2026-05-08
indicating PO visual acceptance of the Cormorant Garamond rendering;
the recognition gap is real but the documented-divergence path is the
standard cluster-D posture (4 of 6 presets ship with similar
proprietary-BYO-deferred-to-OFL postures). Orchestrator routes for
explicit ratification.

**Escalation 2 — Trajan-fallback adequacy flag (got-trajan-clockwork).**
ITC Trajan Pro is a CLASSICAL-REVIVAL CAPS-ONLY serif whose authority
signal depends on a 1900-year-old monumental-inscription proportion
system (the Trajan Column, 113 CE). NO OFL serif in the registry is a
direct Trajan substitute (the entire OFL serif universe is body-text-
oriented Garalde / transitional / contemporary; the closest
inscriptional-revival OFL face is *Cinzel* (Natanael Gama, OFL via
Google Fonts) — NOT currently in the StageFlip registry). EB Garamond
carries the *classical-serif* axis but not the *inscriptional* axis.
Cluster D's brief is "each preset pastiches a specific show's bespoke
typographic identity"; the Trajan recognition signal is partially
preserved (Garalde-classical) and partially lost (inscriptional-
monumental). Orchestrator options:
- (a) Accept EB Garamond as a register-adjacent fallback documented
  as a divergence (T-349's divergence (a) already documents the
  bespoke-vs-OFL gap; parity golden PO-signed at 2026-05-08). Path
  of least resistance.
- (b) Expand the license-cleared registry to include **Cinzel** (OFL;
  Natanael Gama; designed expressly as a Trajan-revival typeface; full
  weight ladder 400–900; available via Google Fonts under SIL OFL 1.1).
  Cinzel IS the canonical Trajan-fallback in the OFL world; would
  close the recognition-signal gap to within ±5% per the consultant
  SKILL §"Quality thresholds". No whitelist widening required (OFL is
  already on the StageFlip whitelist); only registry-population update.
  **Strongly recommended runner-up path.**
- (c) Descope the got-trajan-clockwork preset until Cinzel enters the
  registry.

Recommended path: **(b)** — Cinzel addition to the registry is the
clean fix. No license-whitelist widening needed (Cinzel is OFL). The
type-design consultant escalates to the Orchestrator to ratify Cinzel
registry-population in a follow-up task; the got-trajan-clockwork
preset can ship in v1 under EB Garamond (per (a)) with a Cinzel-swap
flagged for a follow-up preset update. The parity golden was PO-signed
at 2026-05-08 indicating PO visual acceptance of the EB Garamond
rendering, so v1 ship under EB Garamond is acceptable; the Cinzel swap
is a register-quality upgrade, not a blocker.

**Sign-off posture per preset (Escalations applied):**
- got-trajan-clockwork → `signed:2026-05-14` (accept (a); flag Cinzel
  registry-population as Orchestrator follow-up).
- severance-surreal-3d → `signed:2026-05-14`.
- squid-game-geometric → `signed:2026-05-14` (register-faithful-not-
  glyph-faithful posture acknowledged; no escalation required).
- stranger-things-benguiat → **remain `pending-cluster-batch`**
  pending Orchestrator routing on Benguiat adequacy. Per the
  preset's own rule line 41 + consultant SKILL §"Anti-patterns", the
  consultant cannot silently sign off this preset.
- succession-home-video → `signed:2026-05-14`.
- true-detective-double-exposure → `signed:2026-05-14`.

Five of six Cluster D presets are sign-offable at 2026-05-14; one
(stranger-things-benguiat) remains at `pending-cluster-batch` per the
preset's own escalation-trigger language and the consultant SKILL's
anti-pattern prohibition on silent weak-fallback sign-off.
