---
id: nba-pro-register
cluster: cluster-b
clipKind: scoreBug
source: https://www.nba.com/ + broadcast canon (ESPN NBA / TNT / NBA TV; public reference; no entry in docs/compass_artifact.md)
status: substantive
preferredFont:
  family: NBA Sans
  license: proprietary-byo
fallbackFont:
  family: Inter Display
  weight: 700
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# NBA Pro — score bug

## Visual tokens
- Base bar: dark `#1A1A1A` — the sports-broadcast standard for the across-the-bottom scoring strip seen on ESPN NBA / TNT / NBA TV. Dark enough to read against the cool court hardwood + warm crowd backdrop that dominates an NBA broadcast frame, without going pure black. Pure black `#000000` is the news-broadcaster register (Sky News / BBC Reith / CNN-Classic); the NBA broadcast canon picks a near-black `#1A1A1A` that lets the home/away team-color boxes carry more visual weight against the bar. The `score-bug` primitive (T-332a) accepts `background` as a single hex string with no opacity channel; v1 renders at 100 % opacity. Production NBA broadcasts commonly run the strip at ~92 % over court footage for legibility; the flat-color parity canvas reads correctly at 100 % (see "Trade-offs").
- Home team box: NBA brand red `#C8102E` filled section (the canonical NBA logo red) — distinct from the broadcast register colors that wrap individual NBA teams (Lakers gold, Celtics green, Warriors blue). The snapshot uses Lakers (`LAL`) home with the NBA logo red as the fallback when a team color is not pinned by `PRESET_ID_BINDINGS`; the cluster-B composer task supplies the team-specific kit color (`#FDB927` Lakers gold) at the binding wire step. v1 ships the NBA-brand-red home box.
- Away team box: NBA brand deep blue `#17408B` filled section (the canonical NBA logo blue) — the away box mirrors the brand-tertiary on the right. Snapshot uses Celtics (`BOS`) away. Same composer-task override path applies for the team-specific Celtics green (`#007A33`) if pinned.
- Center clock + period: `#FFFFFF` white text on the dark base for clock + quarter token (`08:42` mid-third-quarter, `Q3` period). Tabular numerics for column-edge alignment of scores (`108` / `102`).
- Bar anchored bottom-center at `position: { x: 280, y: 600 }` on a 1280×720 canvas — matching the T-334 / T-335 NBC SNF + Fox NFL anchor norm for the across-the-bottom scoring-strip register. This is intermediate between the news-broadcaster lower-third's upper-left talent-ID anchor and the racing-leaderboard upper-left N-driver-tower anchor. NBA broadcast canon places the bar tight against the bottom edge during regular game flow, with the LIVE indicator + ad ticker stacked above it.
- Card auto-fits: home box | clock + period column | away box (left-to-right) per the `score-bug` `'football'` style branch (primitive line 335–423; home flex 1, clock minWidth 96, away flex 1). v1 uses the existing `score-bug` primitive's `'football'` style branch unchanged — the layout matches the NBA scoring-strip pattern verbatim. Snapshot constants live in `NBA_PRO_REGISTER_PROPS` (exported from `@stageflip/parity-cli` at the cluster-B composer task's binding-wire step).

## Typography
- Team codes (`home.code` / `away.code`): UPPERCASE 3-letter broadcast tokens (`LAL` / `BOS`) — broadcast canon for space-constrained scoring strips. The primitive renders `home.code` / `away.code` verbatim per `applyCasing` short-circuit on numeric leading character (D-T332a-12). v1 snapshot uses already-uppercase strings; `casing: 'as-is'` (matches T-333 / T-334 / T-335 norm).
- Mixed-Case full team names (`Lakers` / `Celtics`) appear on the production broadcast adjacent to or above the score bug — out of scope for the `score-bug` `'football'` branch (no full-name slot). Adding a `home.name` / `away.name` slot is a candidate `T-332b`-family primitive-level follow-up under the same `score-bug` enhancement label.
- Scores (`home.score` / `away.score`): numeric `108` / `102` — typical late-game NBA scoring. The primitive's `applyCasing` short-circuit on leading-digit text leaves numeric strings untouched (primitive lines 233–235). Tabular numerics at the root style guarantee column-edge alignment regardless of digit count (`108` / `102` align cleanly).
- Clock token: `08:42` — mid-third-quarter (typical NBA quarter-clock canonical mid-period sample, matching T-333 PL's `67:42` second-half norm + T-334 Fox NFL's `04:32` Q3 mid-quarter + T-335 NBC SNF's `08:14` Q2 mid-quarter mid-period choices). Period token: `Q3` (NBA broadcast canon — quarters, not halves). The primitive renders period below the clock in `fontSize: 12` per the `'football'` branch.
- Rendered family v1: `Inter Display` weight 700 — the OFL fallback declared in frontmatter. The primitive's `font` prop is honored at render time (primitive lines 286–303: `fontFamily: props.font?.family ?? DEFAULT_FONT_FAMILY`), so the rendered family in this case IS the OFL fallback — unlike the `lowerThird` primitive which hard-codes its own family. Bespoke `NBA Sans` (proprietary BYO) declared in frontmatter exists for the type-design batch review (sister cluster-B composer task) and is the BYO substitution when a tenant supplies the licensed file.

## Animation
- Slide-in from the bottom over `ceil(fps * 0.35)` frames easing `EASE_OUT_QUART`; mid-game indefinite hold; slide-out to the bottom over the last `ceil(fps * 0.25)` frames easing `EASE_IN_QUART`. At 30 fps: ~350 ms entrance, ~250 ms exit — sharper than the news-broadcaster lower-third's 450 ms entrance, in keeping with the more dynamic sports-broadcast register.
- Steady-state mid-hold: `translatePct == 0`, `opacity == 1`. The parity golden captures this state at frame 60 (= 2000 ms @ 30 fps composition) — matches T-333 / T-334 / T-335 score-bug parity-fixture frame-pinning norm.
- The `score-bug` primitive (T-332a) is static in v1 — entrance/exit choreography is provided by the composing `frame-clip` envelope at the binding wire step, NOT by the primitive itself. Score-change pulse (120 ms brightness flash on the team box whose score updated), possession-glow pulse (sister T-335 NBC SNF carve-out), quarter-end clock-stop flash, and live-update mid-hold ticker (point-by-point updates) are deferred (see "Out of scope").

## Rules
- Use when an NBA basketball-broadcast scoring register is called for — across-the-bottom game-state strip on live game footage, replay sequences, halftime/intermission lower-frame attribution. NBA-Pro register sits within Cluster B's sports-broadcast family next to T-333 Premier League (football horizontal), T-334 Fox NFL (American-football chrome-less), T-335 NBC SNF (American-football center-circle + network-mark). Choose NBA-Pro for the basketball quarter-period register specifically.
- Do not use for non-basketball sports (use `premier-league-field-of-play` for association football / `fox-nfl-no-chrome` or `nbc-snf` for American football / a future MLB preset T-514 for baseball / a future F1 preset T-515 for Formula 1).
- Do not paint the full bar NBA red. The home-team box's red fill is the brand identifier on that section; the rest of the bar (`#1A1A1A`) carries the dark-on-court legibility. Pulling the base bar to NBA red would saturate the strip and destroy the home-vs-away color contrast.
- UPPERCASE 3-letter team codes (NOT Mixed-Case). The scoring-strip register is space-constrained; full team names go elsewhere on the production broadcast (above the strip or to its side) and are out of scope for the `score-bug` `'football'` branch.
- Score digits left at the primitive's default `fontSize: 28`, `fontWeight: 800` (primitive lines 320–322). NBA broadcast canon uses a slightly larger score digit than the team code; the primitive's defaults are close enough to the broadcast register for v1.
- Designed for live NBA game footage across the regular season + playoffs broadcast — same legibility requirements as the T-333 / T-334 / T-335 scoring-strip presets (team codes ≥ 24 pt; primitive's 28 px default satisfies).

## Acceptance (parity)
- Reference frame: 60 (= 2000 ms @ 30 fps; steady-state mid-hold; base bar + home box + clock + period + away box fully settled).
- PSNR ≥ 42 dB, SSIM ≥ 0.98 (hand-pinned per `parity-fixture-signoff.md` workflow per the F-4 follow-up flagged in T-359b — generator default 35 / 0.95 is overwritten on land; matches T-323 / T-324 / T-325 / T-333 / T-334 / T-335 / T-358 / T-359 / T-360 / T-507 / T-508 / T-509 cross-cluster norm).

## Trade-offs (v1 cosmetic divergences from the compass register)
- **No full team names rendered.** The `score-bug` `'football'` branch (primitive line 335–423) exposes only `home.code` / `away.code` 3-letter slots — no `home.name` / `away.name` full-name slot. NBA broadcast canon commonly renders `Lakers` / `Celtics` Mixed-Case adjacent to or above the scoring strip; v1 accepts the 3-letter-only register. Adding `home.name` + `away.name` optional slots is a candidate `T-332b`-family primitive-level follow-up.
- **Team box colors are NBA-brand red + deep blue, not Lakers gold + Celtics green.** The snapshot uses the canonical NBA-logo red `#C8102E` (home) + NBA-logo blue `#17408B` (away) as the fallback when the cluster-B composer task has not pinned a team-specific kit color via `PRESET_ID_BINDINGS`. Lakers gold `#FDB927` + Celtics green `#007A33` are the canonical kit colors for this matchup; the composer-task wire step is the place to override them. v1 ships the NBA-brand fallback so the preset reads as a generic NBA register that any team-matchup can wire into.
- **No `down` / `centerCircle` / `direction` / `networkLogo` decorations.** The `'football'` branch's optional props are NFL-specific (down-and-distance) or NBC-SNF-specific (center circle, network logo, direction chevrons). NBA broadcasts do not use down-and-distance, possession indicators (NBA possession arrows are a different visual primitive), or center-circle network marks on the scoring strip. v1 ships a clean home | clock | away layout.
- **Period token is `Q3` (3 chars), not `3RD QTR` or `THIRD QUARTER` long-form.** The primitive's period slot renders below the clock at `fontSize: 12` — a long-form string would clip or overflow at the primitive's default width. NBA broadcast canon uses both the short and long forms depending on bar width; v1 picks the short form for safe layout. A long-form variant is a candidate per-binding override.
- **Background opacity rendered at 100 %, not the production ~92 %.** The primitive's `background` prop accepts a single hex string with no opacity channel. Pre-blending against an assumed court color is wrong on arbitrary footage; the 92 % spec is a production-time tunable for video-overlay legibility. v1 parity renders at 100 % on the flat-color parity canvas. Adding a `backgroundOpacity?` prop is a candidate primitive-level follow-up under the `T-332b`-family label.

## Out of scope
- Score-change pulse (120 ms brightness flash on the home or away box whose score just updated) — primitive-level animation enum addition under the `T-332b`-family label; sister carve-out to the T-334 Fox NFL touchdown comic-book celebration + T-335 NBC SNF possession-change animation.
- Quarter-end clock-stop flash (the clock pulsing red when reaching 0:00) — primitive-level animation under the same `T-332b`-family label.
- Possession-arrow indicator (NBA's alternating-possession visual at the scorer's-table boundary) — semantically a separate sports-overlay primitive, not a `score-bug` enhancement. Candidate primitive-level follow-up `T-332c`.
- Team-foul-count + bonus indicator — a column to the right or left of the score bug; primitive-level slot addition under the `T-332b`-family label.
- Live point-by-point ticker companion — semantically a sister `newsTicker` preset (mirrors T-510 News Pro premium news-ticker); future Cluster B follow-up if Reviewer scrutiny demands.
- Network-logo glyph on the scoring strip (ESPN / TNT / NBA TV) — the `'football'` branch's `networkLogo` slot lives inside the optional center-circle treatment; NBA broadcasts place the network mark separately above or beside the bar.

## References
- https://www.nba.com/ — canonical NBA league website (brand colors observed: NBA logo red `#C8102E` + NBA logo blue `#17408B`)
- Broadcast canon: ESPN NBA / TNT / NBA TV scoring-strip register (public reference; in-game scoring-strip pattern documented across decades of NBA broadcasts)
- ADR-004 (preset system contract)
- T-332a — `score-bug` primitive (the scoring-strip this preset wires; `'football'` style branch)
- T-333 — first `scoreBug` clipKind binding (`premier-league-field-of-play`, first `PRESET_ID_BINDINGS` override; structural template for this preset)
- T-334 — Fox NFL No-Chrome (second `'football'` style consumer; backdrop-gradient + possession-glow + down-and-distance optional props)
- T-335 — NBC Sunday Night Football (third `'football'` style consumer; center-circle + network-logo + direction-chevron optional props)
- T-360 — `PRESET_ID_BINDINGS` mechanism (binding path for non-default `scoreBug` consumers)
- T-378 — `nba-ar-replay` (`arOverlay`-clipKind sister preset; same NBA cluster-B family, different primitive)
- T-511 — Sports Networks pack skeleton (this preset's parent pack; landed the four placeholder register slots)
- T-512 — NBA Pro register substantive fill (this PR; first of four register slots; T-513 NFL Pro + T-514 MLB + T-515 F1 Pro fill the remaining slots and bump the pack to v0.2.0 GA)
