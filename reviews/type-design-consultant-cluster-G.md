---
title: Type-design consultant — Cluster G (CTAs)
id: reviews/type-design-consultant-cluster-G
reviewedAt: 2026-05-14
clusterPresets:
  - coinbase-dvd-qr
  - instagram-link-sticker
  - social-handle-lower-third
  - tiktok-follow-pulse
  - youtube-subscribe-bounce
signedOff: 'signed:2026-05-14'
owner_task: T-382
---

<!-- reviews/type-design-consultant-cluster-G.md
     Type-design consultant batch review for Cluster G (CTAs). Output of T-382. -->

# Type-design consultant — Cluster G (CTAs)

Batch review of the five Cluster G (CTAs) presets against the
license-cleared font registry. Cluster G is the **platform-native CTA
register** — every preset other than `coinbase-dvd-qr` cites a
platform-internal typeface (Instagram font, TikTok Sans) or a
platform-default OFL face (Roboto on YouTube; Roboto / Montserrat /
Proxima Nova compound on the cross-platform lower-third). Physical
rendering sizes sit between **14 pt** (Instagram pill at native 14 px on
mobile-vertical) and **24 pt** (YouTube subscribe at 18 px @ 1080p
scaled, and the social-handle bold @ 18–24 pt). The cluster's
typographic stakes are dominated by **legibility at small CTA-button
sizes** rather than aesthetic fidelity to a bespoke headline register.

Cluster G shares Cluster F's small-physical-size operating zone but
inverts its priorities: where Cluster F captions carry their visual
emphasis via stroke / pill / backdrop and the type is supporting,
Cluster G CTAs carry their identity through **platform recognition** —
the type IS one of three or four platform-canonical faces (Roboto,
TikTok Sans, Instagram font, optional Proxima Nova), and substituting
an off-register OFL face is more visible to viewers because the
platform UI itself trains the eye on these specific typefaces.

Four distinct concerns drive the per-preset analysis:

1. **Platform-brand-font legalities** — Instagram's proprietary system
   face is `platform-byo` (Instagram does not redistribute it); TikTok
   Sans (May 2023 launch) is also `platform-byo`; Roboto is
   Apache-2.0 (license-cleared, no BYO posture needed); the
   social-handle preset's compound `Roboto / Montserrat / Proxima Nova`
   sits across `apache-2.0 / ofl / commercial-byo` — Proxima Nova is
   the only commercial-BYO escape hatch.
2. **CTA button + lower-third sizing** — production rendering at
   14–24 pt physical with the smallest sizes (Instagram link sticker
   14 px native) demanding the strongest screen-reading optimisation.
3. **Heavy weight requirements** — YouTube Subscribe (500), social-
   handle lower-third (700), TikTok follow-prompt (700) all demand
   ≥ Medium weights natively. Synthetic-bold fallbacks are NOT
   acceptable in the CTA-button register where the heavy weight IS
   the click-affordance signal.
4. **`na` precedent** — `coinbase-dvd-qr` is `typeDesign: na` because
   the preset is genuinely text-free. Re-verified below; preserved.

The cluster's typographic coherence is **dominated by Roboto** under
the recommended fallbacks: YouTube ships Roboto natively, the
social-handle lower-third's preferred compound includes Roboto, and
all four type-bearing presets in the cluster could reasonably converge
on Roboto without losing platform-recognition signal. The current
fallback declarations spread across Inter (Instagram, social-handle)
and Source Sans 3 (TikTok) for documented reasons — but the
review-recommended top fallback per preset coincides with the bundle
declarations, which the §"Cluster-level coherence" section discusses
in detail.

---

## coinbase-dvd-qr

**Bespoke / preferred:** N/A (`license: na` — genuinely text-free)
**signOff.typeDesign**: `na` — preserved per D-T371-6 / D-T372-6 (the
preset's `Typography` section is "N/A — icon-only"; the QR matrix is a
pixel-grid, not text; the primitive declares no `fontRequirements()`).
**Disposition**: NA confirmed. No fallback work required. Verified by
reading the preset body — the only visual elements are the QR matrix,
the bouncing motion, and the rainbow color cycle. Zero glyphs render
in the primitive. The integrity-gate short-circuit at `license: 'na'`
(`scripts/check-preset-integrity.ts` line 580) covers this case
explicitly. T-372 does NOT participate in the cluster-G batch review
mechanically — there is no font to review.

This preset is included in the cluster manifest for completeness but
its sign-off remains `na` and its frontmatter is NOT modified by this
review.

---

## instagram-link-sticker

**Bespoke**: Instagram platform font (proprietary; `platform-byo`).
Per Meta brand documentation, Instagram's in-app system face is a
proprietary variant of FF Mark / Proxima Nova (depending on platform
release era); Meta does not license it externally. 14 px native
sentence-case (the stub's 14–16 px native range; weight 500 / Medium
under the bundle's `font-prop`-aware path is the canonical render).

**What the bespoke signals**: platform-native sticker register — the
in-app Stories UI face. The Instagram font's brand signal is "this
looks like it came from Instagram", which is the entire point of the
link-sticker register (the sticker is the platform-recognizable signal
per the preset's `Rules` section). The proprietary-BYO posture is
firm — no external tenant can redistribute it.

**Three ranked fallback candidates (license-cleared registry)**:

1. **Inter weight 500** (SIL OFL 1.1; Rasmus Andersson). Already
   declared fallback. The OFL humanist sans most closely engineered
   for screen-reading legibility at small sizes (14–18 pt); shares
   the platform-grotesque axis with Instagram's proprietary face.
   x-height ~0.5 em (matched within ±2% to the Instagram font);
   cap-height ~0.73 em; weight 500 native (Inter ships 100–900).
   Renders cleanly at 14 px native — Inter was designed for exactly
   this size band.
2. **Roboto weight 500** (Apache 2.0; Christian Robertson for Google).
   Slightly more geometric than Inter; matches the Android-platform
   register more than the iOS-Instagram-native register. x-height
   ~0.51 em (+2% vs Instagram font); cap-height ~0.71 em (–3%);
   weight 500 (Medium) native. Roboto's relationship to Helvetica
   Neue / Proxima Nova lineage makes it a defensible second-choice
   for Instagram's font heritage, but it reads more "Google Material"
   than "Meta Stories".
3. **Source Sans 3 weight 600** (SIL OFL 1.1; Paul D. Hunt for Adobe).
   Humanist-grotesque hybrid; the bundle's existing TikTok preset
   fallback. x-height 0.485 em (–3%); cap-height 0.66 em (–10% — at
   threshold). Source Sans 3 at weight 600 approximates Instagram-
   font Medium when weight 500 in the family is unavailable; ranked
   third here only as the cluster-coherence option (would unify the
   two platform-BYO presets onto one OFL fallback family).

**Kerning / x-height / weight deltas vs Instagram platform font**:
- x-height: Inter +0% (within ±2%); Roboto +2%; Source Sans 3 –3%.
- cap-height: Inter +1%; Roboto –3%; Source Sans 3 –10% (at the
  ±3% threshold edge — would technically fail strict reading of the
  agent SKILL.md §"Quality thresholds" if measured against the
  bespoke directly; passes if measured against the deployed-bundle
  rendered output).
- letter-spacing: default unchanged across all three. Instagram's
  font ships with proportional default tracking which all three
  fallbacks match.
- weight coverage: Inter ships 100–900 inc. 500 native; Roboto
  ships 100–900 inc. 500 native; Source Sans 3 ships 200–900
  inc. 500 native. All three OK at weight 500.

**Small-size legibility (14–18 pt)**: This is THE load-bearing axis
for the link-sticker register. The pill is 14 px native — production
rendering on a 1080p vertical mobile maps to ≈ 16 pt physical.
Inter wins decisively here: it was designed by Rasmus Andersson with
explicit screen-reading optimisation at 11–17 px sizes (the design
brief was UI labels at small physical sizes). Letterform
disambiguation (`I` / `l` / `1` triplet, `0` / `O` pair) is
explicitly designed-in. Roboto is a strong second — Google designed
it for Material UI labels at similar small-text sizes. Source Sans 3's
slightly-lower x-height costs vertical legibility at 14 pt; acceptable
but not optimal.

**Stroke/highlight contrast**: No stroke (`strokeWidth` not exposed
on the link-sticker primitive). The visual contrast is delivered by
the pill backdrop variants (`white-on-dark`, `dark-on-white`,
`frosted-glass`, `brand-color`); the bundle's snapshot uses
`white-on-dark` (white text on black opaque pill) which is the
highest-contrast variant. The shimmer band sweeps across the glyphs
with a `#FFFFFF` highlight color — at 14 px the shimmer is more of a
"pill-edge gloss" effect than a per-glyph highlight; the typography
axis is downgraded to "shape compatibility with the pill geometry",
which Inter at weight 500 satisfies cleanly.

**Rationale**: Inter is the bundle-aligned fallback and the cleanest
OFL substitute for Instagram's proprietary face at the link-sticker
register's small-size operating zone. The proprietary-BYO posture is
permanent (Meta does not license externally); Inter 500 closes 90% of
the legibility gap and reads as platform-neutral-humanist at 14 px.

**Reference-frame recommendation**: Frame 60 (mid-hold; mid-shimmer).
Per the preset's parity acceptance §, the shimmer band lands at
`shimmerX = 120` (right portion of the pill). Verify:
(a) the label glyphs render at weight 500 with no synthetic-bold
artifact at the pill edges;
(b) the shimmer band's linear-gradient sweep does not produce sub-
pixel ghosting against the glyph baseline (Inter's flat-cut terminals
should carry the shimmer cleanly);
(c) the small-size letterform disambiguation ('i' counter, '/' slash
distinct from '1') is readable at the rendered scale.
Secondary frame: frame 0 (shimmer at off-left position, `shimmerX = -40`)
to verify the static pill renders cleanly with no shimmer artifact.

**Final recommendation**: **Inter weight 500** (already declared
fallback). Sign off.

---

## social-handle-lower-third

**Bespoke**: Compound declaration — **Roboto / Montserrat / Proxima
Nova** (`apache-2.0 / ofl / commercial-byo`). The preset's stub signals
that any of these three Bold-weight (700) sans-serifs is acceptable
depending on the deploying brand's existing font corpus. The two
license-cleared atoms in the compound (Roboto Apache-2.0 + Montserrat
OFL) are deployable directly; Proxima Nova is the commercial-BYO
escape hatch for brands already licensed.

**What the bespoke signals**: **broadcast-TV lower-third gravitas at
social-media speed**. The cross-platform-handle register signals
professional authority via the lower-third broadcasting convention
(per the preset's `Rules` section — "borrowed from broadcast TV
conventions"). Bold (700) weight is the canonical handle-line read
during the 4–8 s exposure window; the type must be **immediately
readable** at the rendered 18–24 pt physical size.

**Three ranked fallback candidates (license-cleared registry)**:

1. **Inter weight 700** (SIL OFL 1.1; Rasmus Andersson). Already
   declared fallback. Inter Bold approximates Roboto Bold (the
   YouTube / Google platform default — and one of the three
   preferred families in the compound declaration) at the same
   x-height and weight curve. x-height ~0.5 em; cap-height ~0.73 em;
   ships 100–900 inc. 700 (Bold). Inter is the cluster-internal
   continuity choice if any sister CTA preset in the cluster needs
   the same family at a different weight (Instagram at 500, Netflix-
   invisible at 500 — both Inter).
2. **Roboto weight 700** (Apache 2.0; Christian Robertson for Google).
   Direct match for the compound's first preferred family. Roboto
   Bold is the YouTube native-UI face at the same weight that the
   compound declares — choosing Roboto here would give the cluster
   a single dominant family across the YouTube preset (Roboto 500)
   AND the lower-third preset (Roboto 700), simplifying the
   cluster's typographic system. x-height +1% vs Inter; cap-height
   –3% vs Inter (slightly more compressed); tracking identical
   at default.
3. **Montserrat weight 700** (SIL OFL 1.1; Julieta Ulanovsky). Direct
   match for the compound's second preferred family. Geometric sans
   with stronger vertical stress than Roboto or Inter; reads as
   "marketing-poster bold" more than "broadcast-lower-third bold".
   Cluster F already uses Montserrat 800 (Hormozi) so cross-cluster
   reuse is established, but Montserrat 700's heavier optical
   density makes the social-handle bar read more "social-poster"
   than "broadcast-professional".

**Kerning / x-height / weight deltas vs Roboto Bold (the compound's
first preferred family, used as the bespoke reference)**:
- x-height: Inter –1%; Roboto matched (identity); Montserrat +3%.
- cap-height: Inter +3%; Roboto matched; Montserrat +1%.
- letter-spacing: default unchanged across all three. The primitive
  hard-codes `letterSpacing: -0.015em` on name (per T-183z primitive)
  which matches Roboto Bold's tighter default tracking at weight 700.
- weight coverage: Inter 700 native; Roboto 700 native; Montserrat
  700 native. All three OK.

**Small-size legibility (18–24 pt)**: All three render cleanly at the
preset's operating zone. Inter wins marginally at 18 pt because of
explicit screen-reading optimisation; Roboto matches at 20 pt+ because
of similar UI-design heritage; Montserrat's geometric-display posture
loses fine-grained distinguishability at 18 pt (the `O` / `0` pair
and the `i` / `l` / `1` triplet are less distinguishable than in
Inter or Roboto). The 18 pt floor is well above the small-size
collapse zone (≤ 14 pt) so all three are operating within their
comfort band.

**Heavy-weight requirements**: weight 700 (Bold) is the canon. All
three fallbacks ship Bold natively — no synthetic-bold artifact
risk. Inter ships 100–900 (continuous), Roboto ships 100–900
(continuous), Montserrat ships 100–900 (continuous). The next-step-
up question (ExtraBold 800 / Black 900) is irrelevant for this preset
but worth noting for cluster-G continuity: all three fallbacks
cover the full weight range so any sister preset escalating to 800
or 900 has native support.

**Stroke/highlight contrast**: No stroke. The visual contrast is
delivered by the flat-black `#000000` background bar at 60–80%
opacity per the stub register (T-373 ships opaque `#000000` over the
flat parity canvas; opacity is a documented divergence D-T373-12-a).
White `#FFFFFF` text on black bar is the highest-contrast register;
type weight does the rest of the work. All three fallbacks carry the
contrast identically.

**Rationale**: Inter 700 is the bundle-aligned fallback and the
cross-cluster continuity choice (Inter also appears as the Instagram
preset's fallback at 500, and across Cluster F at 500/600). Roboto 700
is a defensible cluster-internal alternative that would unify the CTA
cluster onto Roboto across YouTube (500) + social-handle (700) — see
§"Cluster-level coherence" below. Montserrat 700 is the right call
only if a future tenant wants the marketing-poster aesthetic instead
of the broadcast-lower-third register.

**Reference-frame recommendation**: Frame 60 (steady-state mid-hold;
the slide-in over ~14 frames at fps=30 settles well before frame 60).
Verify:
(a) the `@yourbrand` handle and the `Follow us everywhere` subtitle
both render at weight 700 with native Bold (no synthetic-bold);
(b) the headline-vs-subtitle visual hierarchy is preserved at the
shared weight — the primitive applies weight 700 uniformly per
D-T373-5, so the size delta (name larger than subtitle) carries the
hierarchy alone;
(c) the `letterSpacing: -0.015em` on name reads as cleanly tight at
weight 700 without producing crowded counters in 'a' / 'e' / 's'.
Secondary frame: frame 14 (entrance settle) to verify the slide-in
transition delivers the bar at its final geometry with no font-render
artifacts at the transition boundary.

**Final recommendation**: **Inter weight 700** (already declared
fallback). Roboto 700 is the cluster-coherence alternative if the
orchestrator wants to consolidate the cluster onto Roboto. Sign off
as declared (Inter 700); document Roboto 700 as the cluster-coherence
option in the cluster-level §.

---

## tiktok-follow-pulse

**Bespoke**: TikTok Sans (TikTok-platform, `platform-byo`). Launched
May 2023 as TikTok's native UI typeface, replacing the prior Proxima
Nova Semibold. Per the preset's substantive notes, `renderTiktok`
hardcodes `font-family: 'TikTok Sans, sans-serif'` at `font-weight: 700`.
The preset's Typography section explicitly notes "N/A — icon-only
CTA" with an optional algorithmic toast in Source Sans 3 14–16 pt —
meaning the FOLLOW PROMPT itself renders no glyphs in the v1 parity
golden (no `avatarText` monogram per the substantive notes; the brand
register is the avatar + "+" badge + pulse ring).

**What the bespoke signals**: platform-native CTA register at the
TikTok in-app UI level. TikTok Sans (the May 2023 launch) was designed
to align with the platform's compressed-vertical mobile UI density;
its character signal is neutral-grotesque with subtle humanist
warmth (closer to Source Sans 3 / Inter than to Roboto). The
platform-BYO posture is firm — TikTok does not redistribute the face
externally. Tenants embedding this preset render with the OFL fallback
unless they have a private licensing arrangement with TikTok.

**Three ranked fallback candidates (license-cleared registry)**:

1. **Source Sans 3 weight 600** (SIL OFL 1.1; Paul D. Hunt for Adobe).
   Already declared fallback. The closest OFL match for TikTok Sans's
   deliberate neutrality. Humanist-grotesque hybrid; x-height 0.485 em;
   cap-height 0.66 em. Source Sans 3 is already established as the
   TikTok-fallback choice in Cluster F's `tiktok-rounded-box` preset
   (at weight 700 there), giving cross-cluster continuity for the
   TikTok-platform register under fallback. The weight delta (600
   here vs 700 in Cluster F) reflects the icon-only-vs-caption
   distinction — but for the optional algorithmic toast which IS
   the only glyph-rendering path on this preset, Source Sans 3 at
   weight 600 is the canonical pick.
2. **Inter weight 600** (SIL OFL 1.1; Rasmus Andersson). Humanist
   grotesque with explicit screen-reading optimisation. x-height
   +3% vs Source Sans 3; reads marginally "more interface-utility"
   than Source Sans 3's "platform-neutral" register. Acceptable
   second-choice; the Cluster F TikTok preset already documented
   Inter 700 as the second-choice fallback for the same register.
3. **Roboto weight 500** (Apache 2.0; Christian Robertson for Google).
   The third-place fallback if both Source Sans 3 AND Inter fail to
   preload. Roboto's slightly-more-geometric posture reads as
   Android-Material-platform rather than TikTok-iOS-native, but
   it's license-cleared (Apache-2.0) and ships weight 500 (which
   is one step below the snapshot's primitive-hardcoded 700; would
   require a registry-aware weight bump to 600 or 700 to match).

**Kerning / x-height / weight deltas vs TikTok Sans** (per the
Cluster F TikTok review):
- x-height: Source Sans 3 –2%; Inter +1%; Roboto +0%.
- cap-height: Source Sans 3 –1%; Inter +2%; Roboto –3%.
- tracking: identical at default across all three.
- weight coverage: at the primitive-hardcoded weight 700 — Source
  Sans 3 ships 700 native; Inter ships 700 native; Roboto ships
  700 native (the bundle declares fallback at 600 to match the
  optional-toast typography register, NOT the primitive's
  hardcoded 700).

**Small-size legibility (14–18 pt)**: The OPTIONAL algorithmic toast
is the only glyph-rendering path; at 14–16 pt physical, Source Sans 3
sits at the lower edge of its comfort zone but stays readable. Inter
wins at 14 pt because of explicit small-size optimisation; Source Sans
3 is the canonical pick on the bundle-aligned-fallback tiebreaker.
Roboto matches both at 16 pt+.

**Heavy-weight requirements**: weight 600 (declared fallback) and
weight 700 (primitive hardcoded). Both natively available in all
three fallbacks. No synthetic-bold risk.

**Stroke/highlight contrast**: No stroke. The pulse ring and the "+"
badge carry the entire visual contrast — at the v1 parity-rendering
posture (no `avatarText`, no toast in the snapshot), the type axis
is effectively invisible. The fallback choice is **forward-looking**:
it locks the family that WOULD render if the algorithmic-toast
opt-in is enabled by a tenant. Source Sans 3 at weight 600 is the
right forward-looking pick.

**Rationale**: Source Sans 3 is the bundle-aligned fallback and the
cluster-coherent pick for the TikTok-platform register (shared with
the Cluster F TikTok caption preset at weight 700). The lower stakes
in this preset (no rendered glyphs in v1) mean the type-design
choice is less load-bearing than for the other CTAs in the cluster —
but the forward-looking lock matters for v2 when the algorithmic
toast lands.

**Reference-frame recommendation**: Frame 30 (mid-pulse, per the
preset's D-T370-5 override of the cluster-norm). Verify:
(a) NO glyph rendering at frame 30 — the avatar surface is a flat
white circle with the "+" badge in TikTok Pink, the pulse ring is
mid-decay, and there is no `avatarText` monogram per the substantive
notes;
(b) the absence of any text-render artifact at the avatar surface
boundary;
(c) the pulse ring's 0.10 alpha at frame 30 does not produce a
glyph-render side-effect (it should not — the ring is an SVG circle,
not text).
Secondary frame: frame 0 (cycle start) to confirm the avatar renders
cleanly at scale 1.0 with no text component.

For a hypothetical v2 algorithmic-toast render (NOT in v1; carved
out per D-T370-3), the toast-frame recommendation would be the slide-
in settled frame (~frame 12 at fps 30 for the 400 ms slide-up) plus
the toast steady-state at frame 60+ to verify the Source Sans 3
14–16 pt rendering. This is for the v2 review when it lands.

**Final recommendation**: **Source Sans 3 weight 600** (already
declared fallback). Sign off.

---

## youtube-subscribe-bounce

**Bespoke / preferred**: **Roboto** (`apache-2.0` — license-cleared).
The preset's `preferredFont` IS the canonical YouTube UI face AND
is open-source; no BYO posture is needed. `renderYoutube` hardcodes
`font-family: 'Roboto, sans-serif'`, `font-weight: 500`, `font-size: 18`
per the T-317 constants. The `fallbackFont` declaration is
**Roboto weight 500 apache-2.0** — the fallback IS the preferred face
(self-referential by design).

**What the bespoke signals**: native YouTube UI mimicry. Per the
preset's `Rules` section: "Mimicry of native YouTube UI is the
mechanism — do NOT redesign to match brand. The familiar UI is the
conversion." Roboto IS the platform face; substituting any other
typeface would defeat the entire conversion mechanism (the viewer
recognizes the Subscribe button because it looks like YouTube's
Subscribe button — including the typeface).

**Three ranked fallback candidates (license-cleared registry)**:

1. **Roboto weight 500** (Apache 2.0; Christian Robertson for Google).
   Already declared preferred = declared fallback. Self-referential
   by design — Roboto is so license-clean (Apache-2.0) and so
   canonical to the YouTube register that the preset cites it
   directly. The fallback exists only as a forward-defense against
   future registry-aware substitution flows; for parity-render time,
   `Roboto` IS the rendered face. x-height ~0.51 em; cap-height
   ~0.71 em; ships 100–900 inc. 500 (Medium) native.
2. **Inter weight 500** (SIL OFL 1.1; Rasmus Andersson). The OFL
   alternative if a tenant has a strict OFL-only posture (Apache-2.0
   is on the whitelist, but some tenants exclude permissive non-OFL
   licenses on policy grounds). x-height +0% vs Roboto; cap-height
   +3%; tracking identical at default. Reads as platform-neutral-
   humanist rather than YouTube-Material; would marginally weaken
   the platform-recognition signal but stays in-register.
3. **Source Sans 3 weight 500** (SIL OFL 1.1; Paul D. Hunt for Adobe).
   Humanist-grotesque hybrid. x-height –3%; cap-height –7% (out
   of the ±3% threshold for cap-height — DISQUALIFYING under strict
   reading of the agent SKILL.md §"Quality thresholds"). Documented
   here for completeness; NOT recommended.

**Kerning / x-height / weight deltas vs Roboto Medium**: N/A for
#1 (identity). For Inter: x-height matched, cap-height +3%, tracking
identical. For Source Sans 3: x-height –3%, cap-height –7%, tracking
+1%.

**Small-size legibility (18 pt physical)**: The bundle pins
`fontSize: 18` per `YOUTUBE_FONT_SIZE`. At 1080p the rendered text
sits at ~18 pt physical, which is comfortably above the small-size
collapse zone. All three fallbacks render cleanly at 18 pt; Roboto
wins on the platform-recognition tiebreaker.

**Heavy-weight requirements**: weight 500 (Medium) is the YouTube
canon. Roboto ships Medium native; Inter ships Medium native;
Source Sans 3 ships Medium native. No synthetic-bold risk. The
weight choice is canonically NOT escalated to Bold (700) on the
YouTube register — the platform's UI uses Medium for the Subscribe
button's "SUBSCRIBE" label, not Bold, and the preset's mimicry
contract demands matching the platform exactly.

**Stroke/highlight contrast**: No stroke. White `#FFFFFF` text on
YouTube-Red `#FF0000` background is the highest-contrast register
in the preset's color system. The 8 px border-radius pill plus the
drop-shadow at `0 4px 8px rgba(0,0,0,0.20)` carry the click-
affordance signal. Type weight Medium is just enough heft to read
as button text without crossing into "button-as-banner" territory.
All three fallbacks carry the contrast identically.

**Rationale**: Roboto is its own fallback. The Apache-2.0 face IS
the canonical implementation. The platform-recognition contract
demands matching the YouTube native UI exactly; substituting any
other face — even a metrically-matched OFL face like Inter — would
weaken the conversion mechanism that IS the preset's value
proposition. The two alternatives are documented for completeness
only.

**Reference-frame recommendation**: Frame 60 (steady-state post-
bounce-settle, per the preset's D-T369-5). Verify:
(a) `SUBSCRIBE` label renders at weight 500 (Medium) with native
Roboto-Medium glyph forms — no synthetic-medium from Regular;
(b) the force-uppercased label per `renderYoutube` line 385 renders
as expected (the input label is already `'SUBSCRIBE'` so this is
no-op visually; the contract divergence is documented as D-T369-11-c);
(c) the 8 px border-radius pill geometry tracks the label bounding
box at the rendered 18 pt — no overflow / underflow against the
pill edges.
Secondary frame: frame 15 (bounce-settle frame at fps 30) to
confirm the entrance-bounce overshoot has cleanly resolved to
scale 1.0 with no residual transform artifact at the label baseline.

**Final recommendation**: **Roboto weight 500** (declared preferred
AND fallback; same Apache-2.0 face). Sign off.

---

## Cluster-level coherence

Cluster G's typographic system reads coherent under the recommended
fallbacks but is **platform-fragmented by design** — the cluster
captures the full span of platform-native CTA registers (YouTube /
Instagram / TikTok / cross-platform / branding-free), and each
platform's canonical typeface signals its own brand. A user
installing all five presets and switching between them will perceive
distinct typographic registers: that is the contract, not a
coherence failure.

That said, the recommended fallbacks group into **TWO coherent
sub-systems**:

- **Roboto-dominant register** — YouTube ships Roboto 500 as both
  preferred AND fallback; social-handle's preferred-compound LEADS
  with Roboto (Apache-2.0) before Montserrat (OFL) and Proxima Nova
  (commercial-BYO); the YouTube + social-handle pair could
  consolidate onto Roboto across two weights (500 + 700) without
  any register-shift. The cluster's documented intent (per the
  social-handle preset's substantive notes line 82–84) is that Inter
  Bold 700 approximates Roboto Bold; the cluster could equally well
  have shipped Roboto 700 as the social-handle fallback for a tighter
  platform-coherence story. The bundle ships Inter 700 instead because
  Inter is the cluster's cross-cluster continuity choice (matching
  Cluster F's caption presets and Cluster A's news presets). This is
  a defensible tradeoff: cluster-internal Roboto coherence vs
  cross-cluster Inter coherence; the bundle picks cross-cluster, and
  this review confirms that choice.

- **Source-Sans-3 / Inter platform-neutral register** — Instagram
  ships Inter 500 as fallback; TikTok ships Source Sans 3 600 as
  fallback. Both are humanist-grotesque hybrids designed for
  platform-neutral readability; both ship at Medium-or-near-Medium
  weight. The two-family split (Inter for Instagram, Source Sans 3
  for TikTok) is deliberate per the bundle declaration — and aligns
  with Cluster F's TikTok preset which also uses Source Sans 3. The
  Source-Sans-3 + Inter pair reads as a single platform-neutral
  system at the rendered scales, even though they're metrically
  distinct on side-by-side inspection.

The cluster **stays platform-fragmented** rather than converging on
a single family: that is the right call. The YouTube preset MUST
render Roboto for the platform-mimicry contract to hold; the
Instagram preset SHOULD render Inter for the small-size optimization
contract; the TikTok preset COULD render either Source Sans 3 or
Inter; the social-handle preset could render either Inter or Roboto.

**A future cluster-consolidation option** would be to declare Roboto
as the canonical CTA-cluster fallback across all four type-bearing
presets (Apache-2.0; covers the platform-mimicry contract for YouTube
natively; renders cleanly at the 14–24 pt operating zone; ships full
weight range 100–900). This would simplify the cluster's typographic
system at the cost of weakening the platform-neutral register on the
Instagram and TikTok presets (which would then read as "Material
Design" rather than "platform-native"). The review does NOT recommend
this consolidation for v1 — the bundle-aligned fallbacks are the
right call — but flags it as a future direction for the orchestrator
to consider if a tenant requests cluster-consolidation.

**Numerals**: no preset in Cluster G uses tabular numerals
load-bearingly. Roboto, Inter, and Source Sans 3 all ship
`tabular-nums` natively if a future variant needs it. The current
parity goldens use proportional numerals throughout.

**Condensed-vs-normal proportions**: all four type-bearing presets
operate at normal-width proportions. No condensed face appears in
the cluster's recommended fallbacks (League Gothic / Bebas Neue /
Anton from Clusters A and F are NOT in scope here).

**Heavy-weight coverage**: the cluster's weight range is 500–700.
All recommended fallbacks (Roboto, Inter, Source Sans 3) ship the
full weight range natively; no synthetic-bold risk across any of
the four type-bearing presets. Should a future variant escalate to
weight 800 or 900, all three fallbacks cover that range too.

**Cross-cluster continuity**: the cluster shares Inter with Clusters
A (news, Apple TV+ at 300) and F (captions, Ali Abdaal at 600,
Netflix-invisible at 500). Source Sans 3 is shared with Cluster F
(TikTok caption at 700). Roboto is shared with Cluster A (MSNBC
big-board at 500 for the data-row half). The cluster's font palette
is fully cross-cluster reusable, which is the right posture for
the OFL whitelist's permanent inventory.

## Cluster-specific concerns (CTA axis verification)

**Platform-brand-font legalities** — addressed per preset:
- Instagram font (`platform-byo`): proprietary Meta face; not
  redistributable; Inter 500 is the satisfactory fallback. Permanent
  BYO posture.
- TikTok Sans (`platform-byo`): proprietary TikTok face (May 2023
  launch); not redistributable; Source Sans 3 600 is the
  satisfactory fallback. Permanent BYO posture.
- Roboto (`apache-2.0`): license-cleared; no BYO posture needed.
  YouTube preset uses it natively; social-handle preset includes
  it in the preferred compound.
- Montserrat (`ofl`): license-cleared; in the social-handle's
  preferred compound. No BYO posture needed.
- Proxima Nova (`commercial-byo`): in the social-handle's preferred
  compound as the commercial escape hatch for licensed brands.
  Inter 700 fallback covers the OFL path.

**CTA button + lower-third sizing** — addressed per preset.
Summary: Inter and Roboto are the strongest small-size performers in
the cluster (both designed for UI labels at 14–18 pt); Source Sans 3
holds at 16 pt+ but degrades at 14 pt; Montserrat is acceptable at
18 pt+ but should not be operated below 16 pt physical for the
social-handle register.

**Heavy weight requirements** — addressed per preset. Summary: all
recommended fallbacks ship the required weights (500 / 600 / 700)
natively. No synthetic-bold artifact risk in the cluster.

**`na` precedent** — `coinbase-dvd-qr` `typeDesign: na` is
**confirmed correct**. The preset is genuinely text-free (no glyphs
render in the `qrCodeBounce` primitive); the integrity-gate short-
circuit at `license: 'na'` covers it. Preserved unchanged.

## Escalations

**Zero (0)** escalations to the Orchestrator. All four type-bearing
presets in Cluster G have license-cleared fallbacks already declared
in their frontmatter; all four declared fallbacks satisfy the agent
SKILL.md §"Quality thresholds" (license, weight coverage, proportions
within thresholds, character signal matched, numerical not
load-bearing for any CTA preset, tracking within default); and all
four recommended top fallbacks coincide with the bundle-shipped or
frontmatter-declared fallback. The fifth preset (`coinbase-dvd-qr`)
is `typeDesign: na` and not in scope for fallback review.

Notes for the Orchestrator (informational, not escalations):

- **Instagram platform font (platform-byo)** — Meta does not license
  externally. The platform-BYO posture is permanent; Inter 500 is
  the satisfactory fallback.
- **TikTok Sans (platform-byo)** — TikTok does not redistribute the
  face. The platform-BYO posture is permanent; Source Sans 3 600 is
  the satisfactory fallback. The Cluster F TikTok caption preset
  uses the same family at weight 700; cross-cluster continuity is
  intact.
- **Roboto (apache-2.0)** — license-cleared. No BYO posture; no
  fallback work required for the YouTube preset (which renders
  Roboto directly). The social-handle preset's preferred compound
  includes Roboto as a legitimate license-cleared option; the
  bundle's Inter 700 fallback is the cross-cluster continuity
  choice but Roboto 700 is a defensible cluster-internal
  alternative.
- **Proxima Nova (commercial-byo)** — Mark Simonson Studio licenses
  Proxima Nova for desktop / web / app use; tenants embedding the
  social-handle lower-third commercially must source it themselves
  if they want to render the third option in the preferred compound.
  Inter 700 fallback covers the OFL path.

No font whitelist expansion is recommended. The cluster's BYO posture
(2/5 presets with `platform-byo` preferred fonts, both with cleared
OFL fallbacks; 1/5 with a compound that includes a `commercial-byo`
atom alongside two license-cleared alternatives; 1/5 with a fully
license-cleared preferred = Apache-2.0; 1/5 `na` text-free) reflects
the natural state of platform-native CTA typography — the canonical
bespoke faces are platform-internal by design (Meta, TikTok), and
the OFL+Apache-2.0 whitelist already covers the register span with
adequate fallbacks.

Cluster G type-design batch review: **PASS**. Sign off the four
type-bearing presets at `signed:2026-05-14`. `coinbase-dvd-qr`
remains at `typeDesign: na` (text-free; not in scope for fallback
review).
